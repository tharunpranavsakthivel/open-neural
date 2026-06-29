"""Recovery router for OpenNeural backend.

Provides endpoints for crash recovery and system state management.
This router is not project-scoped and operates across all projects.
"""

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from openneural_backend.db.engine import get_async_session
from openneural_backend.db.models import Experiment, Project, Run

router = APIRouter(prefix="/experiments", tags=["recovery"])


class InterruptedExperimentSummary(BaseModel):
    """Summary of an interrupted experiment for crash recovery."""

    id: str
    experiment_id_human: str
    project_id: str
    project_name: str
    status: str
    created_at: str
    started_at: str | None = None


class InterruptedExperimentsResponse(BaseModel):
    """Response model for interrupted experiments endpoint."""

    experiments: list[InterruptedExperimentSummary]
    count: int


@router.get("/interrupted", response_model=InterruptedExperimentsResponse)
async def get_interrupted_experiments(
    session: AsyncSession = Depends(get_async_session),
) -> InterruptedExperimentsResponse:
    """Get all experiments with status 'interrupted' across all projects.

    Used by Electron main process for crash recovery detection.
    Per SRS NFR-REL-04: On application restart after a crash, detect any
    experiments in 'running' state and mark them as 'interrupted'.

    Args:
        session: Database session.

    Returns:
        InterruptedExperimentsResponse: List of interrupted experiments
            with project information for crash recovery.
    """
    # Query all experiments with status 'interrupted'
    result = await session.execute(
        select(Experiment, Project)
        .join(Project, Experiment.project_id == Project.id)
        .where(Experiment.status == "interrupted")
        .order_by(Experiment.created_at.desc())
    )
    rows = result.all()

    experiments = []
    for experiment, project in rows:
        experiments.append(
            InterruptedExperimentSummary(
                id=experiment.id,
                experiment_id_human=experiment.experiment_id_human,
                project_id=experiment.project_id,
                project_name=project.name,
                status=experiment.status,
                created_at=(
                    experiment.created_at.isoformat() if experiment.created_at else None
                ),
                started_at=(
                    experiment.started_at.isoformat() if experiment.started_at else None
                ),
            )
        )

    return InterruptedExperimentsResponse(
        experiments=experiments,
        count=len(experiments),
    )


class ExperimentRecoverRequest(BaseModel):
    """Request model for experiment recovery action."""

    action: str = Field(..., description="Recovery action: 'restart' or 'discard'")

    @field_validator("action")
    @classmethod
    def validate_action(cls, v: str) -> str:
        """Validate action is either 'restart' or 'discard'."""
        if v not in ("restart", "discard"):
            raise ValueError("action must be either 'restart' or 'discard'")
        return v


class ExperimentRecoverResponse(BaseModel):
    """Response model for experiment recovery."""

    id: str
    experiment_id_human: str
    status: str
    action: str
    message: str


@router.patch("/{experiment_id}/recover", response_model=ExperimentRecoverResponse)
async def recover_experiment(
    experiment_id: str,
    request: ExperimentRecoverRequest,
    session: AsyncSession = Depends(get_async_session),
) -> ExperimentRecoverResponse:
    """Recover an interrupted experiment.

    Accepts an action to either restart or discard the interrupted experiment.
    If restart: reset status to 'created', clear partial run data, and clear
    started_at/completed_at timestamps.
    If discard: mark the experiment as 'cancelled'.

    Per SRS NFR-REL-04: On application restart after a crash, allow the user
    to restart or discard interrupted experiments.

    Args:
        experiment_id: The UUID of the experiment to recover.
        request: Recovery request containing action ('restart' or 'discard').
        session: Database session.

    Returns:
        ExperimentRecoverResponse: Recovery confirmation with new status.

    Raises:
        HTTPException 404: If experiment not found.
        HTTPException 400: If experiment is not in 'interrupted' status.
    """
    # Get experiment
    result = await session.execute(
        select(Experiment).where(Experiment.id == experiment_id)
    )
    experiment = result.scalar_one_or_none()

    if experiment is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Experiment '{experiment_id}' not found",
        )

    # Verify experiment is in 'interrupted' status
    if experiment.status != "interrupted":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot recover experiment with status '{experiment.status}'. "
            "Only experiments in 'interrupted' status can be recovered.",
        )

    if request.action == "restart":
        # Restart: reset status to 'created' and clear partial data
        experiment.status = "created"
        experiment.started_at = None
        experiment.completed_at = None

        # Clear partial run data for all runs in this experiment
        runs_result = await session.execute(
            select(Run).where(Run.experiment_id == experiment_id)
        )
        runs = runs_result.scalars().all()

        cleared_runs = 0
        for run in runs:
            if run.status in ("running", "failed"):
                run.status = "queued"
                run.hyperparams_json = "{}"
                run.cv_metrics_json = None
                run.test_metrics_json = None
                run.training_time_sec = None
                run.started_at = None
                run.completed_at = None
                cleared_runs += 1

        await session.commit()
        await session.refresh(experiment)

        message = (
            f"Experiment restarted successfully. Cleared {cleared_runs} partial run(s)."
        )

    else:  # discard
        # Discard: mark as cancelled
        experiment.status = "cancelled"
        experiment.completed_at = datetime.utcnow()

        await session.commit()
        await session.refresh(experiment)

        message = "Experiment discarded and marked as cancelled."

    return ExperimentRecoverResponse(
        id=experiment.id,
        experiment_id_human=experiment.experiment_id_human,
        status=experiment.status,
        action=request.action,
        message=message,
    )
