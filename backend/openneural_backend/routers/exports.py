"""Exports router for OpenNeural backend.

Provides endpoints for artifact export: model, pipeline, report, predictions.
"""

from fastapi import APIRouter, HTTPException

router = APIRouter(
    prefix="/experiments/{experiment_id}/export",
    tags=["exports"],
)


@router.post("")
async def export_artifacts(experiment_id: str) -> dict:
    """Export artifacts from an experiment.

    Args:
        experiment_id: The experiment ID.

    Returns:
        dict: Export results with file paths.
    """
    raise HTTPException(status_code=501, detail="Not implemented")
