"""Unit tests for the experiment orchestrator manager.

Validates experiment ID formatting, status transitions (created -> running -> done),
cancellation behavior and status cleanup, and interrupted state detection on shutdown/restart.
"""

import asyncio
import re
from datetime import datetime
from unittest.mock import patch

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from openneural_backend.db.models import Experiment, Pipeline, Project
from openneural_backend.orchestrator.experiment_manager import (
    _generate_experiment_id_human,
    cancel_experiment,
    create_experiment,
    get_experiment,
    start_experiment,
)
from openneural_backend.shutdown import ShutdownManager


@pytest.fixture(autouse=True)
async def setup_experiment_manager_session(tmp_data_dir, db_session) -> None:
    """Overwrites experiment_manager and trainer's local async_session references with the test sessionmaker."""
    import openneural_backend.orchestrator.experiment_manager as em
    import openneural_backend.orchestrator.trainer as tr
    from openneural_backend.db.engine import async_session

    em.async_session = async_session
    tr.async_session = async_session
    yield


@pytest.mark.anyio
async def test_generate_experiment_id_format() -> None:
    """Verify that the generated human-readable experiment ID matches the required format exp_[a-z0-9]{4}_\\d{4}."""
    exp_id = _generate_experiment_id_human()
    assert re.match(r"^exp_[a-z0-9]{4}_\d{4}$", exp_id) is not None


@pytest.mark.anyio
async def test_create_experiment_success(
    db_session: AsyncSession,
    sample_project: Project,
    sample_pipeline: Pipeline,
) -> None:
    """Verify that create_experiment creates a valid experiment with status 'created'."""
    config = {
        "automl_enabled": True,
        "optimize_metric": "f1",
        "automl_config": {"max_trials": 3, "cv_folds": 3},
        "candidate_models": ["logistic_regression"],
    }

    result = await create_experiment(
        project_id=sample_project.id,
        pipeline_id=sample_pipeline.id,
        config=config,
    )

    assert result["status"] == "created"
    assert re.match(r"^exp_[a-z0-9]{4}_\d{4}$", result["experiment_id_human"])
    assert result["project_id"] == sample_project.id
    assert result["pipeline_id"] == sample_pipeline.id
    assert result["automl_enabled"] is True

    # Check database persistence
    fetched = await get_experiment(result["id"])
    assert fetched["status"] == "created"
    assert fetched["experiment_id_human"] == result["experiment_id_human"]


@pytest.mark.anyio
async def test_status_transitions_created_to_running_to_done(
    db_session: AsyncSession,
    sample_project: Project,
    sample_pipeline: Pipeline,
) -> None:
    """Verify status transitions created -> running -> done during start and training execution."""
    config = {
        "automl_enabled": False,
        "optimize_metric": "r2",
        "candidate_models": ["ridge_regression"],
    }

    # Step 1: Create experiment (status: created)
    exp_data = await create_experiment(
        project_id=sample_project.id,
        pipeline_id=sample_pipeline.id,
        config=config,
    )
    assert exp_data["status"] == "created"

    experiment_id = exp_data["id"]

    # Mock dependencies to bypass actual verification and heavy training logic
    async def mock_run_experiment(exp_id: str) -> None:
        # Simulate training setting status to done
        from openneural_backend.db.engine import async_session

        async with async_session() as session:
            res = await session.execute(
                select(Experiment).where(Experiment.id == exp_id)
            )
            experiment = res.scalar_one()
            experiment.status = "done"
            experiment.completed_at = datetime.utcnow()
            await session.commit()

    with patch(
        "openneural_backend.orchestrator.experiment_manager.verify_snapshot_checksum"
    ) as mock_verify_checksum, patch(
        "openneural_backend.orchestrator.trainer.run_experiment",
        side_effect=mock_run_experiment,
    ):
        # Step 2: Start experiment (status transitions to running)
        started_data = await start_experiment(experiment_id)
        assert started_data["status"] == "running"
        assert started_data["started_at"] is not None

        # Verify running status in database
        fetched_running = await get_experiment(experiment_id)
        assert fetched_running["status"] == "running"

        # Give background asyncio task a moment to execute the mock_run_experiment
        await asyncio.sleep(0.1)

        # Step 3: Verify training completes and transitions status to done
        fetched_done = await get_experiment(experiment_id)
        assert fetched_done["status"] == "done"
        assert fetched_done["completed_at"] is not None


@pytest.mark.anyio
async def test_cancel_experiment_transition(
    db_session: AsyncSession,
    sample_project: Project,
    sample_pipeline: Pipeline,
) -> None:
    """Verify that calling cancel_experiment on a running experiment transitions status to cancelled."""
    config = {
        "automl_enabled": False,
        "optimize_metric": "f1",
        "candidate_models": ["logistic_regression"],
    }

    exp_data = await create_experiment(
        project_id=sample_project.id,
        pipeline_id=sample_pipeline.id,
        config=config,
    )
    experiment_id = exp_data["id"]

    # Simulate long training loop using an infinite sleep or block
    async def mock_long_run_experiment(exp_id: str) -> None:
        await asyncio.sleep(100.0)

    with patch(
        "openneural_backend.orchestrator.experiment_manager.verify_snapshot_checksum"
    ) as mock_verify_checksum, patch(
        "openneural_backend.orchestrator.trainer.run_experiment",
        side_effect=mock_long_run_experiment,
    ):
        # Start the experiment to transition to running
        await start_experiment(experiment_id)

        # Verify state is running
        running_data = await get_experiment(experiment_id)
        assert running_data["status"] == "running"

        # Step 4: Cancel experiment and assert status transitions to cancelled
        cancel_data = await cancel_experiment(experiment_id)
        assert cancel_data["status"] == "cancelled"
        assert cancel_data["completed_at"] is not None

        # Check database status is cancelled
        fetched_cancelled = await get_experiment(experiment_id)
        assert fetched_cancelled["status"] == "cancelled"


@pytest.mark.anyio
async def test_interrupted_detection_on_restart(
    db_session: AsyncSession,
    sample_project: Project,
    sample_pipeline: Pipeline,
    tmp_data_dir,
) -> None:
    """Verify that any running experiments are detected and transitioned to interrupted on restart/shutdown."""
    config = {
        "automl_enabled": False,
        "optimize_metric": "f1",
        "candidate_models": ["logistic_regression"],
    }

    exp_data = await create_experiment(
        project_id=sample_project.id,
        pipeline_id=sample_pipeline.id,
        config=config,
    )
    experiment_id = exp_data["id"]

    # Manually transition status to 'running' in the database to simulate crash scenario
    res = await db_session.execute(
        select(Experiment).where(Experiment.id == experiment_id)
    )
    experiment = res.scalar_one()
    experiment.status = "running"
    await db_session.commit()

    # Re-verify that it's running
    running_state = await get_experiment(experiment_id)
    assert running_state["status"] == "running"

    # Use ShutdownManager to clean up/mark running experiments as interrupted
    shutdown_manager = ShutdownManager(data_dir=str(tmp_data_dir))
    shutdown_manager._mark_running_experiments_as_interrupted()

    # Expire session cache so SQLAlchemy actually hits the DB and sees the update
    db_session.expire_all()

    # Re-fetch experiment from db to verify transition to 'interrupted'
    # Use a new select query to avoid session cache returning stale data
    res = await db_session.execute(
        select(Experiment).where(Experiment.id == experiment_id)
    )
    experiment_refetched = res.scalar_one()
    assert experiment_refetched.status == "interrupted"
    assert experiment_refetched.completed_at is not None
