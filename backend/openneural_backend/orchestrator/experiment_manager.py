"""Experiment orchestrator for OpenNeural backend.

Manages experiment lifecycle including creation, execution, monitoring,
and cancellation of ML training experiments.

Exposes:
    create_experiment(project_id, pipeline_id, config): Create a new experiment.
    get_experiment(experiment_id): Get experiment details by ID.
    start_experiment(experiment_id): Start experiment training.
    cancel_experiment(experiment_id): Cancel a running experiment.
"""

import random
import string
from datetime import datetime

from openneural_backend.db.engine import async_session
from openneural_backend.db.models import Experiment


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
