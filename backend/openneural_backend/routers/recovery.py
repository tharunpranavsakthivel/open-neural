"""Recovery router for OpenNeural backend.

Provides endpoints for crash recovery and system state management.
This router is not project-scoped and operates across all projects.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from openneural_backend.db.engine import get_async_session
from openneural_backend.db.models import Experiment, Project

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
                created_at=experiment.created_at.isoformat() if experiment.created_at else None,
                started_at=experiment.started_at.isoformat() if experiment.started_at else None,
            )
        )

    return InterruptedExperimentsResponse(
        experiments=experiments,
        count=len(experiments),
    )
