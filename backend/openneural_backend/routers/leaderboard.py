"""Leaderboard router for OpenNeural backend.

Provides endpoints for experiment comparison leaderboard.
"""

from fastapi import APIRouter, HTTPException

router = APIRouter(prefix="/projects/{project_id}/leaderboard", tags=["leaderboard"])


@router.get("")
async def get_leaderboard(
    project_id: str,
    sort_by: str = "f1",
    order: str = "desc",
) -> list[dict]:
    """Get the experiment leaderboard for a project.

    Args:
        project_id: The project ID.
        sort_by: Column to sort by (f1, auc_roc, precision, recall, training_time).
        order: Sort order (asc, desc).

    Returns:
        list[dict]: Sorted list of experiment results.
    """
    raise HTTPException(status_code=501, detail="Not implemented")
