"""Dashboard router for OpenNeural backend.

Provides endpoints for dashboard-level statistics and metrics aggregated
across all projects.
"""

from fastapi import APIRouter, HTTPException

from openneural_backend.services.project_service import get_dashboard_stats

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get(
    "/stats",
    summary="Get aggregate dashboard statistics",
    description="Returns total counts for experiments, exports, and dataset snapshots aggregated across all projects in the system.",
    responses={
        200: {"description": "Successfully retrieved aggregate dashboard statistics."},
        500: {"description": "Internal server error."}
    }
)
async def get_dashboard_statistics() -> dict:
    """Get aggregate dashboard statistics across all projects.

    Returns total counts for experiments, exports, and dataset snapshots
    aggregated across all projects in the system.

    Returns:
        dict: Dashboard statistics with keys:
            - total_experiments: Total number of experiments across all projects.
            - total_exports: Total number of exports (all artifact types).
            - total_snapshots: Total number of dataset snapshots.

    Raises:
        HTTPException: 500 for unexpected errors.
    """
    try:
        stats = await get_dashboard_stats()
        return stats
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
