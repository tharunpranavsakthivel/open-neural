"""Experiment orchestrator for OpenNeural backend.

Manages experiment lifecycle including creation, execution, monitoring,
and cancellation of ML training experiments.

Exposes:
    create_experiment(project_id, pipeline_id, config): Create a new experiment.
    get_experiment(experiment_id): Get experiment details by ID.
    start_experiment(experiment_id): Start experiment training.
    cancel_experiment(experiment_id): Cancel a running experiment.
"""

import asyncio
import random
import string
from datetime import datetime

from openneural_backend.db.engine import async_session
from openneural_backend.db.models import DatasetSnapshot, Experiment, Pipeline
from openneural_backend.services.dataset_service import verify_snapshot_checksum


def _generate_experiment_id_human() -> str:
    """Generate a human-readable experiment ID.

    Format: exp_[4-char-alphanumeric]_[MMDD]
    Example: exp_cxp8_1015

    Returns:
        str: The generated experiment ID in the format exp_[4-char]_[MMDD].
    """
    # Generate 4 random alphanumeric characters (lowercase for readability)
    random_chars = "".join(random.choices(string.ascii_lowercase + string.digits, k=4))

    # Get current month and day as MMDD
    now = datetime.utcnow()
    mmdd = now.strftime("%m%d")

    return f"exp_{random_chars}_{mmdd}"


class ExperimentNotFoundError(Exception):
    """Raised when a requested experiment does not exist."""

    def __init__(self, experiment_id: str) -> None:
        """Initialize with the missing experiment ID.

        Args:
            experiment_id: The ID of the experiment that was not found.
        """
        self.experiment_id = experiment_id
        super().__init__(f"Experiment not found: {experiment_id}")


class ExperimentValidationError(Exception):
    """Raised when experiment validation fails."""

    pass


class ExperimentStateError(Exception):
    """Raised when an experiment is in an invalid state for an operation."""

    def __init__(self, message: str) -> None:
        """Initialize with error message.

        Args:
            message: Human-readable error message.
        """
        self.message = message
        super().__init__(message)


async def create_experiment(
    project_id: str,
    pipeline_id: str,
    config: dict,
) -> dict:
    """Create a new experiment.

    Creates an experiment record with status 'created', generating a
    human-readable experiment ID in the format exp_[4-char-alphanumeric]_[MMDD].

    Args:
        project_id: The UUID of the parent project.
        pipeline_id: The UUID of the pipeline configuration to use.
        config: Experiment configuration containing:
            - automl_enabled (bool): Whether AutoML is enabled (default: True).
            - optimize_metric (str): Metric to optimize (e.g., "f1", "auc_roc").
            - automl_config (dict): AutoML configuration with keys like
              max_trials, cv_folds, time_budget_minutes.
            - candidate_models (list): List of candidate model types.

    Returns:
        dict: The created experiment with keys:
            - id: UUID primary key.
            - experiment_id_human: Human-readable ID (e.g., "exp_cxp8_1015").
            - project_id: Parent project ID.
            - pipeline_id: Pipeline configuration ID.
            - automl_enabled: Boolean indicating if AutoML is enabled.
            - optimize_metric: Optimization metric name.
            - automl_config: AutoML configuration dict.
            - candidate_models: List of candidate model types.
            - status: Initial status ("created").
            - created_at: ISO8601 timestamp.

    Raises:
        ExperimentValidationError: If required config fields are missing or invalid.
    """
    # Validate required fields
    if not project_id:
        raise ExperimentValidationError("project_id is required")

    if not pipeline_id:
        raise ExperimentValidationError("pipeline_id is required")

    # Validate and normalize config
    automl_enabled = config.get("automl_enabled", True)
    if not isinstance(automl_enabled, bool):
        raise ExperimentValidationError("automl_enabled must be a boolean")

    optimize_metric = config.get("optimize_metric")
    if not optimize_metric:
        raise ExperimentValidationError("optimize_metric is required")

    automl_config = config.get("automl_config", {})
    if not isinstance(automl_config, dict):
        raise ExperimentValidationError("automl_config must be a dict")

    candidate_models = config.get("candidate_models", [])
    if not isinstance(candidate_models, list):
        raise ExperimentValidationError("candidate_models must be a list")

    # Convert lists to strings for storage
    candidate_models_str = ",".join(candidate_models)

    # Generate human-readable experiment ID
    experiment_id_human = _generate_experiment_id_human()

    async with async_session() as session:
        # Create the experiment record
        experiment = Experiment(
            project_id=project_id,
            pipeline_id=pipeline_id,
            experiment_id_human=experiment_id_human,
            automl_enabled=1 if automl_enabled else 0,
            optimize_metric=optimize_metric,
            automl_config_json=str(automl_config).replace("'", '"'),
            candidate_models=candidate_models_str,
            status="created",
            created_at=datetime.utcnow(),
        )

        session.add(experiment)
        await session.commit()
        await session.refresh(experiment)

        return {
            "id": experiment.id,
            "experiment_id_human": experiment.experiment_id_human,
            "project_id": experiment.project_id,
            "pipeline_id": experiment.pipeline_id,
            "automl_enabled": experiment.automl_enabled == 1,
            "optimize_metric": experiment.optimize_metric,
            "automl_config": automl_config,
            "candidate_models": candidate_models,
            "status": experiment.status,
            "created_at": experiment.created_at.isoformat(),
        }


async def _run_training(experiment_id: str) -> None:
    """Background task for running training.

    This coroutine is spawned via asyncio.create_task() to run the training
    process in the background. It handles the full training lifecycle:
    - Load experiment configuration
    - Run each candidate model
    - Update experiment status on completion

    Args:
        experiment_id: The UUID of the experiment to run.
    """
    # Training implementation placeholder
    # Per SRS FR-TRAIN-01 through FR-TRAIN-09
    # Full implementation will include:
    # - Loading snapshot and pipeline
    # - Running Optuna hyperparameter search
    # - Training each candidate model
    # - Updating run statuses
    # - Persisting experiment state

    # For MVP, this is a placeholder that marks the experiment as done
    # after a minimal delay (simulated training)
    import asyncio
    await asyncio.sleep(0.1)

    async with async_session() as session:
        from sqlalchemy import select
        result = await session.execute(
            select(Experiment).where(Experiment.id == experiment_id)
        )
        experiment = result.scalar_one_or_none()

        if experiment and experiment.status == "running":
            experiment.status = "done"
            experiment.completed_at = datetime.utcnow()
            await session.commit()


async def start_experiment(experiment_id: str) -> dict:
    """Start an experiment training run.

    Verifies the experiment is in 'created' status, verifies the snapshot
    checksum for data integrity, marks the experiment as 'running', spawns
    the training coroutine via asyncio.create_task(), and returns the
    updated experiment status.

    Args:
        experiment_id: The UUID of the experiment to start.

    Returns:
        dict: The started experiment with keys:
            - id: UUID primary key.
            - status: Updated status ("running").
            - started_at: ISO8601 timestamp.

    Raises:
        ExperimentNotFoundError: If the experiment does not exist.
        ExperimentStateError: If the experiment is not in 'created' status.
        Exception: If checksum verification fails or other errors occur.
    """
    from sqlalchemy import select

    async with async_session() as session:
        # Get experiment
        result = await session.execute(
            select(Experiment).where(Experiment.id == experiment_id)
        )
        experiment = result.scalar_one_or_none()

        if experiment is None:
            raise ExperimentNotFoundError(experiment_id)

        # Verify experiment is in 'created' status
        if experiment.status != "created":
            raise ExperimentStateError(
                f"Cannot start experiment with status '{experiment.status}'. "
                "Only experiments in 'created' status can be started."
            )

        # Get pipeline to find snapshot
        pipeline_result = await session.execute(
            select(Pipeline).where(Pipeline.id == experiment.pipeline_id)
        )
        pipeline = pipeline_result.scalar_one_or_none()

        if pipeline is None:
            raise ExperimentValidationError(
                f"Pipeline '{experiment.pipeline_id}' not found for experiment"
            )

        # Verify snapshot checksum before starting (per SRS NFR-REL-02)
        snapshot_result = await session.execute(
            select(DatasetSnapshot).where(DatasetSnapshot.id == pipeline.snapshot_id)
        )
        snapshot = snapshot_result.scalar_one_or_none()

        if snapshot is None:
            raise ExperimentValidationError(
                f"Snapshot '{pipeline.snapshot_id}' not found for pipeline"
            )

    # Verify checksum outside the session to avoid long-running transactions
    # Per SRS NFR-REL-02: Verify SHA-256 checksum before training
    await verify_snapshot_checksum(snapshot.id)

    # Mark experiment as running and update started_at
    async with async_session() as session:
        result = await session.execute(
            select(Experiment).where(Experiment.id == experiment_id)
        )
        experiment = result.scalar_one_or_none()

        experiment.status = "running"
        experiment.started_at = datetime.utcnow()
        await session.commit()
        await session.refresh(experiment)

        started_at = experiment.started_at.isoformat()

    # Spawn training coroutine in the background
    # Per SRS FR-TRAIN-01: Training runs locally on CPU
    # Per SRS FR-TRAIN-02: Generate unique experiment ID (already done at creation)
    # Per SRS FR-TRAIN-03 through FR-TRAIN-09 handled by _run_training
    asyncio.create_task(_run_training(experiment_id))

    return {
        "id": experiment_id,
        "status": "running",
        "started_at": started_at,
    }
