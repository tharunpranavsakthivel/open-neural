"""Snapshots router for OpenNeural backend.

Provides endpoints for dataset snapshot management: upload, list, get metadata.
All endpoints follow the API contracts defined in the TDD Section 2.2.
"""

from fastapi import APIRouter, File, HTTPException, UploadFile
from pydantic import BaseModel

from openneural_backend.services.dataset_service import (
    DatasetImportError,
    DatasetNotFoundError,
    ProjectNotFoundError,
    import_file,
)
from openneural_backend.services.dataset_service import (
    get_snapshot as service_get_snapshot,
)
from openneural_backend.services.dataset_service import (
    get_snapshots as service_get_snapshots,
)

router = APIRouter(prefix="/projects/{project_id}/snapshots", tags=["snapshots"])


class SnapshotResponse(BaseModel):
    """Response model for a dataset snapshot.

    Attributes:
        id: UUID of the snapshot.
        version_label: Human-readable version label (e.g., "Snapshot v1").
        file_name: Original file name.
        file_size_bytes: File size in bytes.
        row_count: Number of rows in the dataset.
        col_count: Number of columns in the dataset.
        schema: List of column schema dictionaries.
        checksum_sha256: SHA-256 checksum for integrity verification.
        created_at: ISO-formatted timestamp.
        warning: Optional warning message (e.g., for large files).
    """

    id: str
    version_label: str
    file_name: str
    file_size_bytes: int
    row_count: int
    col_count: int
    schema: list[dict]
    checksum_sha256: str
    created_at: str
    warning: str | None = None


class SnapshotListResponse(BaseModel):
    """Response model for a snapshot in list view.

    Attributes:
        id: UUID of the snapshot.
        version_label: Human-readable version label.
        file_name: Original file name.
        row_count: Number of rows in the dataset.
        created_at: ISO-formatted timestamp.
    """

    id: str
    version_label: str
    file_name: str
    row_count: int
    created_at: str


@router.post(
    "",
    response_model=SnapshotResponse,
    status_code=201,
    summary="Upload a new dataset snapshot",
    description="""
    Upload a dataset file (CSV or Parquet) and create an immutable snapshot.
    
    **Constraints:**
    - Maximum file size: 2 GB (returns 413 error if exceeded)
    - Supported formats: .csv, .parquet
    - Files >500 MB receive a warning in the response
    
    The file is stored internally as Parquet for consistency, and a SHA-256
    checksum is computed for integrity verification.
    """,
)
async def create_snapshot(
    project_id: str,
    file: UploadFile = File(..., description="Dataset file (CSV or Parquet, max 2GB)"),
) -> dict:
    """Upload a new dataset snapshot.

    Accepts a multipart/form-data upload with a 'file' field containing
    the dataset. Validates file size, infers schema, computes checksums,
    and creates an immutable snapshot bound to the project.

    Args:
        project_id: The UUID of the project to associate the snapshot with.
        file: The uploaded dataset file (CSV or Parquet).

    Returns:
        dict: Created snapshot details including id, version_label, file_name,
            file_size_bytes, row_count, col_count, schema, checksum_sha256,
            created_at, and optional warning.

    Raises:
        HTTPException: 404 if project not found, 413 if file exceeds 2GB,
            400 for validation errors, 500 for unexpected errors.
    """
    try:
        snapshot = await import_file(
            project_id=project_id,
            upload_file=file,
        )
        return snapshot
    except ProjectNotFoundError as e:
        raise HTTPException(
            status_code=404, detail=f"Project not found: {e.project_id}"
        )
    except DatasetImportError as e:
        # Check if it's a file size error
        if "exceeds maximum" in e.message.lower():
            raise HTTPException(status_code=413, detail=e.message)
        raise HTTPException(status_code=400, detail=e.message)
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to import dataset: {str(e)}"
        )


@router.get(
    "",
    response_model=list[SnapshotListResponse],
    summary="List all snapshots for a project",
    description="""
    Retrieve a list of all dataset snapshots for the specified project.
    Results are ordered by creation time (oldest first).
    """,
)
async def list_snapshots(project_id: str) -> list[dict]:
    """List all snapshots for a project.

    Returns a list of snapshot summaries ordered by creation time
    (oldest first). Each snapshot includes id, version_label, file_name,
    row_count, and created_at.

    Args:
        project_id: The UUID of the project.

    Returns:
        list[dict]: List of snapshot summaries.

    Raises:
        HTTPException: 404 if project not found, 500 for unexpected errors.
    """
    try:
        snapshots = await service_get_snapshots(project_id=project_id)
        return snapshots
    except ProjectNotFoundError as e:
        raise HTTPException(
            status_code=404, detail=f"Project not found: {e.project_id}"
        )
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to list snapshots: {str(e)}"
        )


@router.get(
    "/{snapshot_id}",
    response_model=SnapshotResponse,
    summary="Get a snapshot by ID",
    description="""
    Retrieve complete details for a specific dataset snapshot.
    
    Returns full metadata including schema information, file statistics,
    and integrity checksum.
    """,
)
async def get_snapshot_by_id(project_id: str, snapshot_id: str) -> dict:
    """Get a snapshot by ID.

    Retrieves complete snapshot details including schema, checksum,
    and all metadata. The project_id is validated but the snapshot
    is retrieved by its unique ID.

    Args:
        project_id: The UUID of the project (for validation).
        snapshot_id: The UUID of the snapshot to retrieve.

    Returns:
        dict: Complete snapshot details with schema.

    Raises:
        HTTPException: 404 if snapshot not found, 500 for unexpected errors.
    """
    try:
        snapshot = await service_get_snapshot(snapshot_id=snapshot_id)
        return snapshot
    except DatasetNotFoundError as e:
        raise HTTPException(
            status_code=404, detail=f"Snapshot not found: {e.snapshot_id}"
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get snapshot: {str(e)}")
