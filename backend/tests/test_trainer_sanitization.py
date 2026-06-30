import hashlib
import json
from pathlib import Path

import pandas as pd
import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from openneural_backend.db.models import DatasetSnapshot, Experiment, Pipeline, Project
from openneural_backend.orchestrator.trainer import run_experiment


@pytest.fixture(autouse=True)
async def setup_trainer_session(tmp_data_dir, db_session) -> None:
    """Overwrites trainer's local async_session references with the test sessionmaker."""
    import openneural_backend.orchestrator.trainer as tr
    from openneural_backend.db.engine import async_session

    tr.async_session = async_session
    yield


@pytest.mark.anyio
async def test_run_experiment_sanitization(
    db_session: AsyncSession,
    sample_project: Project,
    tmp_data_dir: Path,
) -> None:
    """Verify that preprocessing block parameters are correctly sanitized to remove the target column.

    We configure a pipeline with a `drop_nulls` block explicitly targeting
    the target/label column. Normally, because the target column is dropped from
    X prior to pipeline fit/transform, this would raise a ValueError.
    We assert that the trainer sanitizes this block, dropping the target column,
    and also drops any rows with nulls in the target column, completing the training successfully.
    """
    # 1. Create a dataset parquet file with missing target values (nulls)
    # Target column is "target_col", some rows have nulls
    data = {
        "feature_1": [1.0, 2.0, 3.0, 4.0, 5.0, 6.0, 7.0, 8.0, 9.0, 10.0],
        "feature_2": [10.0, 20.0, 30.0, 40.0, 50.0, 60.0, 70.0, 80.0, 90.0, 100.0],
        "target_col": [0.0, 1.0, None, 1.0, 0.0, 1.0, 0.0, None, 1.0, 0.0],
    }
    df = pd.DataFrame(data)
    parquet_path = tmp_data_dir / "sanitization_test.parquet"
    df.to_parquet(parquet_path)

    # 2. Compute correct sha256 checksum
    with open(parquet_path, "rb") as f:
        correct_checksum = hashlib.sha256(f.read()).hexdigest()

    # 3. Save snapshot in DB
    snapshot = DatasetSnapshot(
        project_id=sample_project.id,
        version_label="Sanitization Test Snapshot",
        original_path=str(parquet_path),
        stored_path=str(parquet_path),
        file_name="sanitization_test.parquet",
        file_size_bytes=parquet_path.stat().st_size,
        row_count=10,
        col_count=3,
        schema_json=json.dumps(
            [
                {"name": "feature_1", "inferred_type": "float"},
                {"name": "feature_2", "inferred_type": "float"},
                {"name": "target_col", "inferred_type": "boolean"},
            ]
        ),
        checksum_sha256=correct_checksum,
    )
    db_session.add(snapshot)
    await db_session.commit()
    await db_session.refresh(snapshot)

    # 4. Create a pipeline containing a block that checks "target_col"
    pipeline_config = {
        "blocks": [
            {
                "type": "drop_nulls",
                "params": {"columns": ["feature_1", "target_col"]},
            },
            {
                "type": "scale_numeric_standard",
                "params": {"columns": ["feature_2"]},
            },
            {
                "type": "train_val_test_split",
                "params": {
                    "train": 0.6,
                    "val": 0.2,
                    "test": 0.2,
                    "stratify_column": "target_col",
                },
            },
        ]
    }

    pipeline = Pipeline(
        project_id=sample_project.id,
        snapshot_id=snapshot.id,
        name="Sanitization Pipeline",
        config_json=json.dumps(pipeline_config),
        validated=1,
    )
    db_session.add(pipeline)
    await db_session.commit()
    await db_session.refresh(pipeline)

    # 5. Create an experiment
    experiment = Experiment(
        experiment_id_human="exp_sanit_test",
        project_id=sample_project.id,
        pipeline_id=pipeline.id,
        status="created",
        automl_enabled=False,
        optimize_metric="f1",
        automl_config_json=json.dumps({"max_trials": 1, "cv_folds": 2}),
        candidate_models="logistic_regression",
    )
    db_session.add(experiment)
    await db_session.commit()
    await db_session.refresh(experiment)

    # 6. Execute training
    res = await run_experiment(experiment.id)

    assert res["status"] == "done"
    assert res["best_run_id"] is not None

    # Re-fetch experiment to verify state and make sure it is indeed "done"
    db_session.expire_all()
    await db_session.refresh(experiment)
    assert experiment.status == "done"
