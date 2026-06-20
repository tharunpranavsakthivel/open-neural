"""Experiments router for OpenNeural backend.

Provides endpoints for experiment management: create, start, cancel, get status.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from openneural_backend.db.engine import get_async_session
from openneural_backend.db.models import Pipeline, Project
from openneural_backend.models.registry import list_models
from openneural_backend.orchestrator.experiment_manager import (
    ExperimentNotFoundError,
    ExperimentStateError,
    ExperimentValidationError,
    create_experiment,
    start_experiment,
)

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
            raise ValueError(f"Invalid optimize_metric '{v}'. Must be one of: {valid_metrics}")
        return v


class ExperimentCreateResponse(BaseModel):
    """Response model for experiment creation."""

    id: str
    experiment_id_human: str
    status: str
    created_at: str


@router.post("", response_model=ExperimentCreateResponse, status_code=status.HTTP_201_CREATED)
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
        model for model in request.candidate_models
        if model not in registered_models
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

    return ExperimentStartResponse(
        status=result["status"],
        started_at=result["started_at"],
    )


@router.get("/{experiment_id}/status")
async def get_experiment_status(project_id: str, experiment_id: str) -> dict:
    """Get real-time experiment status.

    Args:
        project_id: The project ID.
        experiment_id: The experiment ID.

    Returns:
        dict: Experiment status with progress.
    """
    raise HTTPException(status_code=501, detail="Not implemented")


@router.delete("/{experiment_id}/cancel")
async def cancel_experiment(project_id: str, experiment_id: str) -> dict:
    """Cancel a running experiment.

    Args:
        project_id: The project ID.
        experiment_id: The experiment ID.

    Returns:
        dict: Cancellation confirmation.
    """
    raise HTTPException(status_code=501, detail="Not implemented")
