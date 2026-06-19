"""Snapshots router for OpenNeural backend.

Provides endpoints for dataset snapshot management: upload, list, get metadata.
"""

from fastapi import APIRouter, HTTPException, UploadFile

router = APIRouter(prefix="/projects/{project_id}/snapshots", tags=["snapshots"])


@router.post("")
async def create_snapshot(project_id: str, file: UploadFile) -> dict:
    """Upload a new dataset snapshot.

    Args:
        project_id: The project ID.
        file: The dataset file (CSV or Parquet).

    Returns:
        dict: Created snapshot details.
    """
    raise HTTPException(status_code=501, detail="Not implemented")


@router.get("")
async def list_snapshots(project_id: str) -> list[dict]:
    """List all snapshots for a project.

    Args:
        project_id: The project ID.

    Returns:
        list[dict]: List of snapshot summaries.
    """
    raise HTTPException(status_code=501, detail="Not implemented")


@router.get("/{snapshot_id}")
async def get_snapshot(project_id: str, snapshot_id: str) -> dict:
    """Get a snapshot by ID.

    Args:
        project_id: The project ID.
        snapshot_id: The snapshot ID.

    Returns:
        dict: Snapshot details with schema.
    """
    raise HTTPException(status_code=501, detail="Not implemented")
