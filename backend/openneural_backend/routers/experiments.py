"""Experiments router for OpenNeural backend.

Provides endpoints for experiment management: create, start, cancel, get status.
"""

import psutil
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from openneural_backend.db.engine import get_async_session
from openneural_backend.db.models import Pipeline, Project
from openneural_backend.models.registry import list_models
from openneural_backend.orchestrator.estimator import estimate_training_time
from openneural_backend.orchestrator.experiment_manager import (
    ExperimentNotFoundError,
    ExperimentStateError,
    ExperimentValidationError,
    cancel_experiment,
    create_experiment,
    start_experiment,
)
from openneural_backend.services.dataset_service import ChecksumMismatchError

router = APIRouter(prefix="/projects/{project_id}/experiments", tags=["experiments"])


class AutoMLConfig(BaseModel):
    """AutoML configuration for experiment."""

    max_trials: int = Field(25, description="Maximum number of AutoML trials", ge=1)
    cv_folds: int = Field(5, description="Number of cross-validation folds", ge=2)
    time_budget_minutes: int = Field(8, description="Time budget in minutes", ge=1)


class ExperimentCreateRequest(BaseModel):
    """Request model for creating a new experiment."""

    pipeline_id: str = Field(..., description="ID of the pipeline to use")
    automl_enabled: bool = Field(True, description="Whether AutoML is enabled")
    optimize_metric: str = Field("f1", description="Metric to optimize")
    automl_config: AutoMLConfig = Field(
        default_factory=AutoMLConfig,
        description="AutoML configuration",
    )
    candidate_models: list[str] = Field(
        ...,
        description="List of candidate model types",
    )

    @field_validator("optimize_metric")
    @classmethod
    def validate_optimize_metric(cls, v: str) -> str:
        """Validate optimization metric is supported."""
        valid_metrics = ["f1", "auc_roc", "precision", "recall", "rmse", "mae", "r2"]
        if v not in valid_metrics:
            raise ValueError(
                f"Invalid optimize_metric '{v}'. Must be one of: {valid_metrics}"
            )
        return v


class ExperimentCreateResponse(BaseModel):
    """Response model for experiment creation."""

    id: str
    experiment_id_human: str
    status: str
    created_at: str


@router.post(
    "", response_model=ExperimentCreateResponse, status_code=status.HTTP_201_CREATED
)
async def create_experiment_endpoint(
    project_id: str,
    request: ExperimentCreateRequest,
    session: AsyncSession = Depends(get_async_session),
) -> ExperimentCreateResponse:
    """Create a new experiment.

    Validates the pipeline belongs to the project, validates candidate models
    are registered for the project's task type, creates the experiment record,
    and returns the created experiment details.

    Args:
        project_id: The project ID.
        request: Experiment creation request containing pipeline_id and config.
        session: Database session.

    Returns:
        ExperimentCreateResponse: Created experiment with id, experiment_id_human,
            status, and created_at.

    Raises:
        HTTPException 404: If project or pipeline not found.
        HTTPException 400: If validation fails (e.g., candidate_models invalid).
    """
    # Validate project exists and get task type
    project_result = await session.execute(
        select(Project).where(Project.id == project_id)
    )
    project = project_result.scalar_one_or_none()
    if project is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project '{project_id}' not found",
        )

    # Validate pipeline exists and belongs to this project
    pipeline_result = await session.execute(
        select(Pipeline).where(
            Pipeline.id == request.pipeline_id,
            Pipeline.project_id == project_id,
        )
    )
    pipeline = pipeline_result.scalar_one_or_none()
    if pipeline is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Pipeline '{request.pipeline_id}' not found in project '{project_id}'",
        )

    # Validate candidate_models are all registered for this task type
    registered_models = list_models(task_type=project.task_type)
    invalid_models = [
        model for model in request.candidate_models if model not in registered_models
    ]
    if invalid_models:
        available = list(registered_models.keys())
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Invalid candidate models for task type '{project.task_type}': "
                f"{invalid_models}. Available models: {available}"
            ),
        )

    # Prepare config for experiment_manager
    config = {
        "automl_enabled": request.automl_enabled,
        "optimize_metric": request.optimize_metric,
        "automl_config": request.automl_config.model_dump(),
        "candidate_models": request.candidate_models,
    }

    # Create experiment via experiment_manager
    try:
        experiment = await create_experiment(
            project_id=project_id,
            pipeline_id=request.pipeline_id,
            config=config,
        )
    except ExperimentValidationError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )

    return ExperimentCreateResponse(
        id=experiment["id"],
        experiment_id_human=experiment["experiment_id_human"],
        status=experiment["status"],
        created_at=experiment["created_at"],
    )


@router.get("")
async def list_experiments(project_id: str) -> list[dict]:
    """List all experiments for a project.

    Args:
        project_id: The project ID.

    Returns:
        list[dict]: List of experiment summaries.
    """
    raise HTTPException(status_code=501, detail="Not implemented")


@router.get("/{experiment_id}")
async def get_experiment(project_id: str, experiment_id: str) -> dict:
    """Get an experiment by ID.

    Args:
        project_id: The project ID.
        experiment_id: The experiment ID.

    Returns:
        dict: Experiment details.
    """
    raise HTTPException(status_code=501, detail="Not implemented")


class ExperimentStartResponse(BaseModel):
    """Response model for experiment start."""

    status: str
    started_at: str


@router.post("/{experiment_id}/start", response_model=ExperimentStartResponse)
async def start_experiment_endpoint(
    project_id: str,
    experiment_id: str,
    session: AsyncSession = Depends(get_async_session),
) -> ExperimentStartResponse:
    """Start an experiment training run.

    Verifies the experiment exists and belongs to the project, verifies
    the snapshot checksum for data integrity, marks the experiment as
    'running', spawns the training coroutine, and returns the status.

    Args:
        project_id: The project ID.
        experiment_id: The experiment ID.
        session: Database session.

    Returns:
        ExperimentStartResponse: Status and started_at timestamp.

    Raises:
        HTTPException 404: If project or experiment not found.
        HTTPException 400: If experiment is not in 'created' status.
        HTTPException 500: If checksum verification fails.
    """
    # Validate project exists
    project_result = await session.execute(
        select(Project).where(Project.id == project_id)
    )
    project = project_result.scalar_one_or_none()
    if project is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project '{project_id}' not found",
        )

    # Validate experiment exists and belongs to this project
    from openneural_backend.db.models import Experiment

    exp_result = await session.execute(
        select(Experiment).where(
            Experiment.id == experiment_id,
            Experiment.project_id == project_id,
        )
    )
    experiment = exp_result.scalar_one_or_none()
    if experiment is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Experiment '{experiment_id}' not found in project '{project_id}'",
        )

    # Start the experiment via experiment_manager
    try:
        result = await start_experiment(experiment_id)
    except ExperimentNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Experiment '{experiment_id}' not found",
        )
    except ExperimentStateError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
    except ExperimentValidationError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
    except ChecksumMismatchError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        )

    return ExperimentStartResponse(
        status=result["status"],
        started_at=result["started_at"],
    )


class ExperimentStatusResponse(BaseModel):
    """Response model for experiment status.

    Returns real-time experiment status including progress percentage,
    CPU and RAM usage, and per-run status with metrics.
    """

    status: str = Field(
        ...,
        description="Experiment status (created, running, done, cancelled, interrupted)",
    )
    progress_pct: float = Field(..., description="Progress percentage (0-100)")
    cpu_pct: float = Field(..., description="Current CPU usage percentage")
    ram_used_gb: float = Field(..., description="Used RAM in GB")
    ram_total_gb: float = Field(..., description="Total RAM in GB")
    runs: list[dict] = Field(
        ..., description="List of run statuses with model_type, status, and metrics"
    )


@router.get("/{experiment_id}/status", response_model=ExperimentStatusResponse)
async def get_experiment_status(
    project_id: str,
    experiment_id: str,
    session: AsyncSession = Depends(get_async_session),
) -> ExperimentStatusResponse:
    """Get real-time experiment status with progress.

    Returns the current experiment status, progress percentage calculated as
    done_runs / total_runs * 100, system resource usage (CPU, RAM), and
    detailed status for each model run including metrics if available.

    Args:
        project_id: The project ID.
        experiment_id: The experiment ID.
        session: Database session.

    Returns:
        ExperimentStatusResponse: Real-time status with progress, resource usage,
            and per-run details.

    Raises:
        HTTPException 404: If project or experiment not found.
    """
    import json

    # Validate project exists
    project_result = await session.execute(
        select(Project).where(Project.id == project_id)
    )
    project = project_result.scalar_one_or_none()
    if project is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project '{project_id}' not found",
        )

    # Get experiment and validate it belongs to project
    from openneural_backend.db.models import Experiment

    exp_result = await session.execute(
        select(Experiment).where(
            Experiment.id == experiment_id,
            Experiment.project_id == project_id,
        )
    )
    experiment = exp_result.scalar_one_or_none()
    if experiment is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Experiment '{experiment_id}' not found in project '{project_id}'",
        )

    # Get all runs for this experiment
    from openneural_backend.db.models import Run

    runs_result = await session.execute(
        select(Run).where(Run.experiment_id == experiment_id)
    )
    runs = runs_result.scalars().all()

    # Calculate progress percentage: done_runs / total_runs * 100
    total_runs = len(runs)
    done_runs = sum(1 for run in runs if run.status == "done")
    progress_pct = (done_runs / total_runs * 100) if total_runs > 0 else 0.0

    # Get system resource usage via psutil
    # Per SRS FR-TRAIN-05: Display real-time CPU and RAM usage
    cpu_pct = psutil.cpu_percent(interval=0.1)
    memory = psutil.virtual_memory()
    ram_used_gb = memory.used / (1024**3)
    ram_total_gb = memory.total / (1024**3)

    # Build runs list with model_type, status, and metrics
    runs_list = []
    for run in runs:
        run_info = {
            "model_type": run.model_type,
            "status": run.status,
            "metrics": None,
        }

        # Parse test metrics if available
        if run.test_metrics_json:
            try:
                run_info["metrics"] = json.loads(run.test_metrics_json)
            except json.JSONDecodeError:
                run_info["metrics"] = None

        runs_list.append(run_info)

    return ExperimentStatusResponse(
        status=experiment.status,
        progress_pct=round(progress_pct, 1),
        cpu_pct=round(cpu_pct, 1),
        ram_used_gb=round(ram_used_gb, 2),
        ram_total_gb=round(ram_total_gb, 2),
        runs=runs_list,
    )


class ExperimentCancelResponse(BaseModel):
    """Response model for experiment cancellation."""

    id: str
    status: str
    completed_at: str
    runs_failed: int


@router.delete("/{experiment_id}/cancel", response_model=ExperimentCancelResponse)
async def cancel_experiment_endpoint(
    project_id: str,
    experiment_id: str,
    session: AsyncSession = Depends(get_async_session),
) -> ExperimentCancelResponse:
    """Cancel a running experiment.

    Cancels the asyncio.Task for the experiment, marks all queued and running
    runs as failed, marks the experiment as cancelled, and discards partial
    results.

    Per SRS FR-TRAIN-08: Allow the user to cancel a running training job;
    partial run results shall be discarded and the experiment status set
    to "cancelled".

    Args:
        project_id: The project ID.
        experiment_id: The experiment ID.
        session: Database session.

    Returns:
        ExperimentCancelResponse: Cancellation confirmation with id, status,
            completed_at, and number of runs marked as failed.

    Raises:
        HTTPException 404: If project or experiment not found.
        HTTPException 400: If experiment is not in 'running' status.
    """
    # Validate project exists
    project_result = await session.execute(
        select(Project).where(Project.id == project_id)
    )
    project = project_result.scalar_one_or_none()
    if project is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project '{project_id}' not found",
        )

    # Validate experiment exists and belongs to this project
    from openneural_backend.db.models import Experiment

    exp_result = await session.execute(
        select(Experiment).where(
            Experiment.id == experiment_id,
            Experiment.project_id == project_id,
        )
    )
    experiment = exp_result.scalar_one_or_none()
    if experiment is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Experiment '{experiment_id}' not found in project '{project_id}'",
        )

    # Cancel the experiment via experiment_manager
    from openneural_backend.orchestrator.experiment_manager import (
        ExperimentStateError,
    )

    try:
        result = await cancel_experiment(experiment_id)
    except ExperimentNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Experiment '{experiment_id}' not found",
        )
    except ExperimentStateError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )

    return ExperimentCancelResponse(
        id=result["id"],
        status=result["status"],
        completed_at=result["completed_at"],
        runs_failed=result["runs_failed"],
    )


class ExperimentEstimateResponse(BaseModel):
    """Response model for training time estimation."""

    estimated_seconds: float
    estimated_minutes: float
    estimated_time_str: str
    row_count: int
    feature_count: int
    candidate_count: int
    automl_config: dict


@router.get("/{experiment_id}/estimate", response_model=ExperimentEstimateResponse)
async def estimate_experiment_time(
    project_id: str,
    experiment_id: str,
    session: AsyncSession = Depends(get_async_session),
) -> ExperimentEstimateResponse:
    """Estimate training time for an experiment.

    Applies a heuristic formula based on dataset size (rows × features),
    number of candidate models, and AutoML configuration to estimate
    the total training time.

    Per SRS FR-MODEL-08: Display pre-training estimated time to completion
    based on dataset size and candidate count. This estimate is advisory
    and may differ from actual training time.

    Args:
        project_id: The project ID.
        experiment_id: The experiment ID.
        session: Database session.

    Returns:
        ExperimentEstimateResponse: Estimated training time in seconds and minutes,
            along with dataset and configuration details.

    Raises:
        HTTPException 404: If project, experiment, pipeline, or snapshot not found.
    """
    import json

    # Validate project exists
    project_result = await session.execute(
        select(Project).where(Project.id == project_id)
    )
    project = project_result.scalar_one_or_none()
    if project is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project '{project_id}' not found",
        )

    # Get experiment and validate it belongs to project
    from openneural_backend.db.models import Experiment

    exp_result = await session.execute(
        select(Experiment).where(
            Experiment.id == experiment_id,
            Experiment.project_id == project_id,
        )
    )
    experiment = exp_result.scalar_one_or_none()
    if experiment is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Experiment '{experiment_id}' not found in project '{project_id}'",
        )

    # Get pipeline
    pipeline_result = await session.execute(
        select(Pipeline).where(Pipeline.id == experiment.pipeline_id)
    )
    pipeline = pipeline_result.scalar_one_or_none()
    if pipeline is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Pipeline '{experiment.pipeline_id}' not found",
        )

    # Get snapshot for row/feature counts
    from openneural_backend.db.models import DatasetSnapshot

    snapshot_result = await session.execute(
        select(DatasetSnapshot).where(DatasetSnapshot.id == pipeline.snapshot_id)
    )
    snapshot = snapshot_result.scalar_one_or_none()
    if snapshot is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Snapshot '{pipeline.snapshot_id}' not found",
        )

    # Get candidate count
    candidate_models = (
        experiment.candidate_models.split(",") if experiment.candidate_models else []
    )
    candidate_count = len(candidate_models)

    # Get AutoML config
    try:
        automl_config = json.loads(experiment.automl_config_json)
    except (json.JSONDecodeError, TypeError):
        automl_config = {"max_trials": 25, "cv_folds": 5}

    # Get feature count from schema
    try:
        schema = json.loads(snapshot.schema_json)
        # Subtract 1 for target column
        feature_count = max(1, len(schema) - 1)
    except (json.JSONDecodeError, TypeError):
        feature_count = 1

    # Estimate training time
    estimated_seconds = estimate_training_time(
        row_count=snapshot.row_count,
        feature_count=feature_count,
        candidate_count=candidate_count,
        automl_config=automl_config,
    )

    estimated_minutes = estimated_seconds / 60.0

    # Format time string
    if estimated_minutes < 1:
        estimated_time_str = f"{int(estimated_seconds)}s"
    elif estimated_minutes < 60:
        estimated_time_str = f"{estimated_minutes:.1f} minutes"
    else:
        hours = estimated_minutes / 60
        estimated_time_str = f"{hours:.1f} hours"

    return ExperimentEstimateResponse(
        estimated_seconds=estimated_seconds,
        estimated_minutes=round(estimated_minutes, 1),
        estimated_time_str=estimated_time_str,
        row_count=snapshot.row_count,
        feature_count=feature_count,
        candidate_count=candidate_count,
        automl_config=automl_config,
    )
