"""Unit tests for the export service.

Validates ONNX, joblib, PDF, CSV, and manifest exports.
"""

import json
from pathlib import Path

import joblib
import numpy as np
import onnx
import pandas as pd
import pytest
from sklearn.linear_model import LogisticRegression
from sqlalchemy.ext.asyncio import AsyncSession

from openneural_backend.db.models import (
    Evaluation,
    Experiment,
    Pipeline,
    Project,
    Run,
    SubgroupAnalysis,
)
from openneural_backend.services.export_service import (
    export_model_joblib,
    export_model_onnx,
    export_predictions_csv,
    export_report_pdf,
    generate_manifest,
)


@pytest.fixture(autouse=True)
def setup_export_service_session(db_session) -> None:
    """Overwrites export_service local async_session reference with the test sessionmaker."""
    import openneural_backend.services.export_service as es
    from openneural_backend.db.engine import async_session

    es.async_session = async_session
    yield


@pytest.mark.anyio
async def test_export_model_onnx_success(
    db_session: AsyncSession,
    sample_project: Project,
    sample_pipeline: Pipeline,
    tmp_path: Path,
) -> None:
    """Verify that export_model_onnx converts a scikit-learn model to valid ONNX."""
    experiment = Experiment(
        project_id=sample_project.id,
        pipeline_id=sample_pipeline.id,
        experiment_id_human="exp_onx1_0001",
        automl_enabled=False,
        optimize_metric="f1",
        automl_config_json="{}",
        candidate_models="logistic_regression",
        status="done",
    )
    db_session.add(experiment)
    await db_session.commit()
    await db_session.refresh(experiment)

    run = Run(
        experiment_id=experiment.id,
        model_type="logistic_regression",
        status="done",
        hyperparams_json="{}",
        cv_metrics_json="{}",
        test_metrics_json="{}",
    )
    db_session.add(run)
    await db_session.commit()
    await db_session.refresh(run)

    # Train a simple LogisticRegression model and save it to the run directory
    # Expected directory: {tmp_data_dir}/experiments/{experiment_id}/runs/{run_id}/model.joblib
    from openneural_backend.config import Settings

    data_dir = Settings.get().data_dir
    run_dir = data_dir / "experiments" / experiment.id / "runs" / run.id
    run_dir.mkdir(parents=True, exist_ok=True)

    X = np.array([[1.0, 2.0], [2.0, 3.0], [3.0, 4.0], [4.0, 5.0]])
    y = np.array([0, 0, 1, 1])
    model = LogisticRegression()
    model.fit(X, y)

    joblib.dump(model, run_dir / "model.joblib")

    # Export model to ONNX
    dest_dir = tmp_path / "export_dest"
    dest_dir.mkdir(parents=True, exist_ok=True)

    res = await export_model_onnx(run.id, dest_dir)
    assert res["status"] == "success"
    assert res["artifact_type"] == "model_onnx"
    assert Path(res["file_path"]).exists()

    # Verify ONNX loadable
    onnx_model = onnx.load(res["file_path"])
    assert onnx_model is not None
    onnx.checker.check_model(onnx_model)


@pytest.mark.anyio
async def test_export_model_joblib_success(
    db_session: AsyncSession,
    sample_project: Project,
    sample_pipeline: Pipeline,
    tmp_path: Path,
) -> None:
    """Verify that export_model_joblib creates a valid copy loadable by joblib."""
    experiment = Experiment(
        project_id=sample_project.id,
        pipeline_id=sample_pipeline.id,
        experiment_id_human="exp_jbl1_0001",
        automl_enabled=False,
        optimize_metric="f1",
        automl_config_json="{}",
        candidate_models="logistic_regression",
        status="done",
    )
    db_session.add(experiment)
    await db_session.commit()
    await db_session.refresh(experiment)

    run = Run(
        experiment_id=experiment.id,
        model_type="logistic_regression",
        status="done",
        hyperparams_json="{}",
        cv_metrics_json="{}",
        test_metrics_json="{}",
    )
    db_session.add(run)
    await db_session.commit()
    await db_session.refresh(run)

    from openneural_backend.config import Settings

    data_dir = Settings.get().data_dir
    run_dir = data_dir / "experiments" / experiment.id / "runs" / run.id
    run_dir.mkdir(parents=True, exist_ok=True)

    model = LogisticRegression()
    joblib.dump(model, run_dir / "model.joblib")

    dest_dir = tmp_path / "export_dest"
    res = await export_model_joblib(run.id, dest_dir)
    assert res["artifact_type"] == "model_joblib"
    assert Path(res["file_path"]).exists()

    loaded_model = joblib.load(res["file_path"])
    assert isinstance(loaded_model, LogisticRegression)


@pytest.mark.anyio
async def test_export_predictions_csv_success(
    db_session: AsyncSession,
    sample_project: Project,
    sample_pipeline: Pipeline,
    tmp_path: Path,
) -> None:
    """Verify export_predictions_csv creates a CSV file with correct columns."""
    experiment = Experiment(
        project_id=sample_project.id,
        pipeline_id=sample_pipeline.id,
        experiment_id_human="exp_csv1_0001",
        automl_enabled=False,
        optimize_metric="f1",
        automl_config_json="{}",
        candidate_models="logistic_regression",
        status="done",
    )
    db_session.add(experiment)
    await db_session.commit()
    await db_session.refresh(experiment)

    run = Run(
        experiment_id=experiment.id,
        model_type="logistic_regression",
        status="done",
        hyperparams_json="{}",
        cv_metrics_json="{}",
        test_metrics_json="{}",
    )
    db_session.add(run)
    await db_session.commit()
    await db_session.refresh(run)

    # Save mock predictions parquet
    from openneural_backend.config import Settings

    data_dir = Settings.get().data_dir
    run_dir = data_dir / "experiments" / experiment.id / "runs" / run.id
    run_dir.mkdir(parents=True, exist_ok=True)

    df = pd.DataFrame(
        {
            "row_index": [0, 1, 2],
            "y_true": [0, 1, 0],
            "y_pred": [0, 1, 1],
            "y_proba": [0.1, 0.9, 0.7],
        }
    )
    df.to_parquet(run_dir / "predictions.parquet")

    dest_dir = tmp_path / "export_dest"
    res = await export_predictions_csv(run.id, dest_dir)
    assert res["artifact_type"] == "predictions"
    assert Path(res["file_path"]).exists()

    # Check columns
    exported_df = pd.read_csv(res["file_path"])
    assert "row_index" in exported_df.columns
    assert "predicted_label" in exported_df.columns
    assert "true_label" in exported_df.columns
    assert (
        "prob_0" in exported_df.columns
        or "prob_positive" in exported_df.columns
        or any(c.startswith("prob") for c in exported_df.columns)
    )


@pytest.mark.anyio
async def test_export_report_pdf_success(
    db_session: AsyncSession,
    sample_project: Project,
    sample_pipeline: Pipeline,
    tmp_path: Path,
) -> None:
    """Verify that export_report_pdf produces a valid, non-empty evaluation report PDF."""
    # Let's populate the database with complete metrics, evaluations, and subgroup analyses for the report
    experiment = Experiment(
        project_id=sample_project.id,
        pipeline_id=sample_pipeline.id,
        experiment_id_human="exp_pdf1_0001",
        automl_enabled=True,
        optimize_metric="f1",
        automl_config_json="{}",
        candidate_models="logistic_regression",
        status="done",
    )
    db_session.add(experiment)
    await db_session.commit()
    await db_session.refresh(experiment)

    run = Run(
        experiment_id=experiment.id,
        model_type="logistic_regression",
        status="done",
        hyperparams_json="{}",
        cv_metrics_json="{}",
        test_metrics_json=json.dumps(
            {"f1": 0.82, "accuracy": 0.85, "precision": 0.81, "recall": 0.83}
        ),
    )
    db_session.add(run)
    await db_session.commit()
    await db_session.refresh(run)

    evaluation = Evaluation(
        run_id=run.id,
        split="test",
        metrics_json=json.dumps(
            {"f1": 0.82, "accuracy": 0.85, "precision": 0.81, "recall": 0.83}
        ),
        confusion_matrix_json=json.dumps({"tn": 10, "fp": 2, "fn": 3, "tp": 15}),
        threshold=0.5,
    )
    db_session.add(evaluation)
    await db_session.commit()
    await db_session.refresh(evaluation)

    subgroup = SubgroupAnalysis(
        evaluation_id=evaluation.id,
        slice_name="gender=Female",
        slice_config='{"column": "gender", "value": "Female"}',
        n=100,
        metrics_json=json.dumps({"f1": 0.65, "precision": 0.62, "recall": 0.68}),
    )
    db_session.add(subgroup)
    await db_session.commit()

    dest_dir = tmp_path / "export_dest"
    res = await export_report_pdf(experiment.id, dest_dir)
    assert res["artifact_type"] == "report"
    assert Path(res["file_path"]).exists()
    assert Path(res["file_path"]).stat().st_size > 0


@pytest.mark.anyio
async def test_generate_manifest_success(tmp_path: Path) -> None:
    """Verify that generate_manifest produces export_manifest.json with correct SHA-256 checksums."""
    # Write a small file to checksum
    file_path = tmp_path / "dummy_model.onnx"
    file_path.write_bytes(b"some dummy onnx model bytes")

    import hashlib

    sha256 = hashlib.sha256(b"some dummy onnx model bytes").hexdigest()

    exported_files = [
        {
            "status": "success",
            "artifact_type": "model_onnx",
            "file_path": str(file_path),
            "checksum_sha256": None,  # Let it recompute
        }
    ]

    manifest_path = await generate_manifest(tmp_path, "exp_onx1_0001", exported_files)
    assert manifest_path.exists()

    with open(manifest_path) as f:
        manifest_data = json.load(f)

    assert manifest_data["experiment_id"] == "exp_onx1_0001"
    assert len(manifest_data["artifacts"]) == 1
    assert manifest_data["artifacts"][0]["type"] == "model_onnx"
    assert manifest_data["artifacts"][0]["checksum_sha256"] == sha256


@pytest.mark.anyio
async def test_get_run_and_experiment_failures(db_session: AsyncSession) -> None:
    """Verify that _get_run_and_experiment raises RunNotFoundError / ExperimentNotFoundError correctly."""
    from unittest.mock import AsyncMock, MagicMock

    import openneural_backend.services.export_service as es
    from openneural_backend.services.export_service import (
        ExperimentNotFoundError,
        RunNotFoundError,
        _get_run_and_experiment,
    )

    # Test non-existent run
    with pytest.raises(RunNotFoundError):
        await _get_run_and_experiment("non_existent_run_id")

    # Test existing run but missing experiment using mock of the sessionmaker
    mock_run = Run(
        id="run_with_missing_experiment",
        experiment_id="missing_exp_id",
        model_type="logistic_regression",
        status="done",
        hyperparams_json="{}",
        cv_metrics_json="{}",
        test_metrics_json="{}",
    )

    mock_session = AsyncMock()
    call_count = 0

    async def mock_execute(statement, *args, **kwargs):
        nonlocal call_count
        call_count += 1
        if call_count == 1:
            mock_res = MagicMock()
            mock_res.scalar_one_or_none.return_value = mock_run
            return mock_res
        else:
            mock_res = MagicMock()
            mock_res.scalar_one_or_none.return_value = None
            return mock_res

    mock_session.execute = mock_execute

    class MockSessionCM:
        async def __aenter__(self):
            return mock_session

        async def __aexit__(self, exc_type, exc_val, exc_tb):
            pass

    orig_async_session = es.async_session
    es.async_session = lambda: MockSessionCM()

    try:
        with pytest.raises(ExperimentNotFoundError):
            await _get_run_and_experiment("run_with_missing_experiment")
    finally:
        es.async_session = orig_async_session


@pytest.mark.anyio
async def test_get_experiment_failures() -> None:
    """Verify that _get_experiment raises ExperimentNotFoundError correctly."""
    from openneural_backend.services.export_service import (
        ExperimentNotFoundError,
        _get_experiment,
    )

    with pytest.raises(ExperimentNotFoundError):
        await _get_experiment("non_existent_experiment_id")


@pytest.mark.anyio
async def test_export_services_failures(tmp_path: Path) -> None:
    """Verify exported functions fail gracefully on non-existent IDs."""
    from openneural_backend.services.export_service import (
        ExperimentNotFoundError,
        RunNotFoundError,
        export_model_joblib,
        export_model_onnx,
        export_predictions_csv,
        export_report_pdf,
    )

    with pytest.raises(RunNotFoundError):
        await export_model_onnx("non_existent_run_id", tmp_path)

    with pytest.raises(RunNotFoundError):
        await export_model_joblib("non_existent_run_id", tmp_path)

    with pytest.raises(RunNotFoundError):
        await export_predictions_csv("non_existent_run_id", tmp_path)

    with pytest.raises(ExperimentNotFoundError):
        await export_report_pdf("non_existent_experiment_id", tmp_path)
