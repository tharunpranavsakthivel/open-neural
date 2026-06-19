"""Evaluation router for OpenNeural backend.

Provides endpoints for experiment evaluation: metrics, confusion matrix, threshold.
"""

from fastapi import APIRouter, HTTPException

router = APIRouter(
    prefix="/experiments/{experiment_id}/evaluation",
    tags=["evaluation"],
)


@router.get("")
async def get_evaluation(experiment_id: str) -> dict:
    """Get evaluation results for an experiment.

    Args:
        experiment_id: The experiment ID.

    Returns:
        dict: Evaluation metrics, confusion matrix, and subgroup analysis.
    """
    raise HTTPException(status_code=501, detail="Not implemented")


@router.post("/threshold")
async def update_threshold(experiment_id: str) -> dict:
    """Update decision threshold and recalculate metrics.

    Args:
        experiment_id: The experiment ID.

    Returns:
        dict: Updated metrics.
    """
    raise HTTPException(status_code=501, detail="Not implemented")
