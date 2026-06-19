"""Dataset service for OpenNeural backend.

Provides dataset import, snapshot management, schema inference, and profiling.
All methods are async and use SQLAlchemy 2.0 async patterns. Snapshots are
immutable and checksummed for reproducibility.

Exposes:
    import_file(project_id, upload_file): Import a dataset file and create a snapshot.
    get_snapshots(project_id): List all snapshots for a project.
    get_snapshot(snapshot_id): Get a single snapshot by ID.
    compute_checksum(path): Compute SHA-256 checksum for file integrity.
    infer_schema(df): Infer column types and statistics from a DataFrame.
    profile_dataset(df): Generate comprehensive dataset profiling statistics.
"""

import hashlib
import json
import os
import shutil
import uuid
from datetime import datetime
from pathlib import Path
from typing import Any

import pandas as pd
import pyarrow.parquet as pq
from fastapi import UploadFile
from sqlalchemy import func, select

from openneural_backend.config import Settings
from openneural_backend.db.engine import async_session
from openneural_backend.db.models import DatasetSnapshot, Project


# Maximum file size: 2 GB (per SRS FR-DATA-02)
MAX_FILE_SIZE_BYTES = 2 * 1024 * 1024 * 1024

# Warning threshold: 500 MB (per SRS FR-DATA-08)
WARNING_FILE_SIZE_BYTES = 500 * 1024 * 1024


class DatasetImportError(Exception):
    """Raised when dataset import fails."""

    def __init__(self, message: str, details: dict | None = None) -> None:
        """Initialize with error message and optional details.

        Args:
            message: Human-readable error message.
            details: Additional context about the error.
        """
        self.message = message
        self.details = details or {}
        super().__init__(message)


class DatasetNotFoundError(Exception):
    """Raised when a requested dataset snapshot does not exist."""

    def __init__(self, snapshot_id: str) -> None:
        """Initialize with the missing snapshot ID.

        Args:
            snapshot_id: The ID of the snapshot that was not found.
        """
        self.snapshot_id = snapshot_id
        super().__init__(f"Dataset snapshot not found: {snapshot_id}")


class ProjectNotFoundError(Exception):
    """Raised when a project does not exist."""

    def __init__(self, project_id: str) -> None:
        """Initialize with the missing project ID.

        Args:
            project_id: The ID of the project that was not found.
        """
        self.project_id = project_id
        super().__init__(f"Project not found: {project_id}")


def compute_checksum(path: str | Path) -> str:
    """Compute SHA-256 checksum for a file.

    Reads the file in chunks to handle large files efficiently without
    loading the entire contents into memory.

    Args:
        path: Path to the file to checksum.

    Returns:
        str: Hexadecimal SHA-256 checksum string.

    Raises:
        FileNotFoundError: If the file does not exist.
        PermissionError: If the file cannot be read.
    """
    sha256_hash = hashlib.sha256()

    with open(path, "rb") as f:
        # Read in 8MB chunks for efficient memory usage
        for chunk in iter(lambda: f.read(8 * 1024 * 1024), b""):
            sha256_hash.update(chunk)

    return sha256_hash.hexdigest()


def infer_schema(df: pd.DataFrame) -> list[dict[str, Any]]:
    """Infer schema information from a DataFrame.

    Analyzes each column to determine its data type, null percentage,
    and unique value count. Maps pandas dtypes to OpenNeural type system.

    Args:
        df: The pandas DataFrame to analyze.

    Returns:
        list[dict]: List of column schema dictionaries containing:
            - name: Column name.
            - inferred_type: Inferred data type (string, integer, float,
                categorical, boolean).
            - null_pct: Percentage of null values (0.0-100.0).
            - unique_count: Number of unique values.
    """
    schema = []
    total_rows = len(df)

    for col in df.columns:
        col_data = df[col]
        null_count = col_data.isna().sum()
        null_pct = (null_count / total_rows * 100) if total_rows > 0 else 0.0
        unique_count = col_data.nunique(dropna=True)

        # Determine inferred type
        inferred_type = _infer_column_type(col_data)

        schema.append({
            "name": col,
            "inferred_type": inferred_type,
            "null_pct": round(null_pct, 2),
            "unique_count": int(unique_count),
        })

    return schema


def _infer_column_type(col_data: pd.Series) -> str:
    """Infer the OpenNeural type for a column.

    Maps pandas dtypes to OpenNeural type categories.

    Args:
        col_data: The pandas Series to analyze.

    Returns:
        str: One of: "string", "integer", "float", "categorical", "boolean".
    """
    dtype = col_data.dtype

    # Check for boolean first
    if pd.api.types.is_bool_dtype(dtype):
        return "boolean"

    # Check for categorical
    if isinstance(dtype, pd.CategoricalDtype) or pd.api.types.is_categorical_dtype(dtype):
        return "categorical"

    # Check for integer
    if pd.api.types.is_integer_dtype(dtype):
        return "integer"

    # Check for float
    if pd.api.types.is_float_dtype(dtype):
        return "float"

    # Check for datetime
    if pd.api.types.is_datetime64_any_dtype(dtype):
        return "string"  # Store datetimes as strings for MVP

    # Default to string
    return "string"


def profile_dataset(df: pd.DataFrame) -> dict[str, Any]:
    """Generate comprehensive dataset profiling statistics.

    Computes descriptive statistics for all columns including numeric
    summaries, categorical value distributions, and overall dataset metrics.

    Args:
        df: The pandas DataFrame to profile.

    Returns:
        dict: Profiling statistics containing:
            - row_count: Total number of rows.
            - col_count: Total number of columns.
            - memory_usage_bytes: Estimated memory usage.
            - columns: List of per-column statistics.
    """
    total_rows = len(df)
    total_cols = len(df.columns)
    memory_usage = df.memory_usage(deep=True).sum()

    column_profiles = []
    for col in df.columns:
        col_data = df[col]
        profile = _profile_column(col_data, total_rows)
        column_profiles.append(profile)

    return {
        "row_count": total_rows,
        "col_count": total_cols,
        "memory_usage_bytes": int(memory_usage),
        "columns": column_profiles,
    }


def _profile_column(col_data: pd.Series, total_rows: int) -> dict[str, Any]:
    """Profile a single column.

    Args:
        col_data: The pandas Series to profile.
        total_rows: Total number of rows in the dataset.

    Returns:
        dict: Column profile containing name, type, null stats, and
        type-specific statistics (e.g., min/max for numeric).
    """
    null_count = col_data.isna().sum()
    null_pct = (null_count / total_rows * 100) if total_rows > 0 else 0.0
    unique_count = col_data.nunique(dropna=True)
    inferred_type = _infer_column_type(col_data)

    profile = {
        "name": col_data.name,
        "inferred_type": inferred_type,
        "null_count": int(null_count),
        "null_pct": round(null_pct, 2),
        "unique_count": int(unique_count),
    }

    # Add type-specific statistics
    if inferred_type in ("integer", "float"):
        numeric_data = col_data.dropna()
        if len(numeric_data) > 0:
            profile.update({
                "min": float(numeric_data.min()),
                "max": float(numeric_data.max()),
                "mean": float(numeric_data.mean()),
                "std": float(numeric_data.std()),
            })
        else:
            profile.update({
                "min": None,
                "max": None,
                "mean": None,
                "std": None,
            })
    elif inferred_type == "categorical":
        # Show top 10 categories by frequency
        value_counts = col_data.value_counts().head(10).to_dict()
        profile["top_values"] = [
            {"value": str(k), "count": int(v)}
            for k, v in value_counts.items()
        ]
    elif inferred_type == "string":
        # Show sample of non-null values
        non_null = col_data.dropna()
        if len(non_null) > 0:
            profile["avg_length"] = float(non_null.str.len().mean())
            profile["max_length"] = int(non_null.str.len().max())

    return profile


async def import_file(
    project_id: str,
    upload_file: UploadFile,
) -> dict[str, Any]:
    """Import a dataset file and create an immutable snapshot.

    Handles CSV and Parquet files, validates size limits, infers schema,
    computes checksums, and stores the file in managed storage.

    Args:
        project_id: The UUID of the project to associate with the snapshot.
        upload_file: The uploaded file from FastAPI UploadFile.

    Returns:
        dict: The created snapshot with keys:
            - id: UUID of the snapshot.
            - version_label: Human-readable version label (e.g., "Snapshot v1").
            - file_name: Original file name.
            - file_size_bytes: File size in bytes.
            - row_count: Number of rows.
            - col_count: Number of columns.
            - schema: List of column schema dictionaries.
            - checksum_sha256: File checksum.
            - created_at: ISO-formatted timestamp.

    Raises:
        ProjectNotFoundError: If the project does not exist.
        DatasetImportError: If file validation or import fails.
    """
    async with async_session() as session:
        # Verify project exists
        project_stmt = select(Project).where(Project.id == project_id)
        project_result = await session.execute(project_stmt)
        project = project_result.scalar_one_or_none()

        if project is None:
            raise ProjectNotFoundError(project_id)

        # Validate file exists and get size
        if not upload_file.file:
            raise DatasetImportError("No file provided")

        # Get file size by reading content
        content = await upload_file.read()
        file_size = len(content)

        if file_size == 0:
            raise DatasetImportError("File is empty")

        if file_size > MAX_FILE_SIZE_BYTES:
            raise DatasetImportError(
                f"File size ({file_size} bytes) exceeds maximum allowed size "
                f"({MAX_FILE_SIZE_BYTES} bytes = 2 GB)"
            )

        # Determine file format from content type or filename
        filename = upload_file.filename or "unknown"
        file_ext = Path(filename).suffix.lower()

        if file_ext not in (".csv", ".parquet"):
            raise DatasetImportError(
                f"Unsupported file format: {file_ext}. Supported formats: .csv, .parquet"
            )

        try:
            # Parse the file into a DataFrame
            if file_ext == ".csv":
                df = pd.read_csv(pd.io.common.BytesIO(content))
            else:  # .parquet
                df = pd.read_parquet(pd.io.common.BytesIO(content))
        except Exception as e:
            raise DatasetImportError(f"Failed to parse file: {str(e)}")

        # Compute the next version label for this project
        version_stmt = (
            select(func.count(DatasetSnapshot.id))
            .where(DatasetSnapshot.project_id == project_id)
        )
        version_result = await session.execute(version_stmt)
        snapshot_count = version_result.scalar() or 0
        version_label = f"Snapshot v{snapshot_count + 1}"

        # Generate snapshot ID and paths
        snapshot_id = str(uuid.uuid4())
        snapshots_dir = Settings.get().data_dir / "snapshots" / snapshot_id
        snapshots_dir.mkdir(parents=True, exist_ok=True)

        # Store as Parquet for internal consistency
        stored_path = snapshots_dir / "data.parquet"
        df.to_parquet(stored_path, index=False)

        # Compute checksum of the stored file
        checksum = compute_checksum(stored_path)

        # Infer schema
        schema = infer_schema(df)

        # Profile dataset
        profile = profile_dataset(df)

        # Create snapshot record
        snapshot = DatasetSnapshot(
            id=snapshot_id,
            project_id=project_id,
            version_label=version_label,
            original_path=filename,
            stored_path=str(stored_path),
            file_name=filename,
            file_size_bytes=file_size,
            row_count=profile["row_count"],
            col_count=profile["col_count"],
            schema_json=json.dumps(schema),
            checksum_sha256=checksum,
            created_at=datetime.utcnow(),
        )

        session.add(snapshot)
        await session.commit()
        await session.refresh(snapshot)

        # Update project updated_at timestamp
        project.updated_at = datetime.utcnow()
        await session.commit()

        return {
            "id": snapshot.id,
            "version_label": snapshot.version_label,
            "file_name": snapshot.file_name,
            "file_size_bytes": snapshot.file_size_bytes,
            "row_count": snapshot.row_count,
            "col_count": snapshot.col_count,
            "schema": schema,
            "checksum_sha256": snapshot.checksum_sha256,
            "created_at": snapshot.created_at.isoformat(),
            "warning": (
                "File size exceeds 500 MB. Training may take longer and use significant memory."
                if file_size > WARNING_FILE_SIZE_BYTES
                else None
            ),
        }


async def get_snapshots(project_id: str) -> list[dict[str, Any]]:
    """List all dataset snapshots for a project.

    Returns snapshots ordered by creation time (newest first).

    Args:
        project_id: The UUID of the project.

    Returns:
        list[dict]: List of snapshot summaries containing:
            - id: Snapshot UUID.
            - version_label: Human-readable version label.
            - row_count: Number of rows.
            - created_at: ISO-formatted timestamp.

    Raises:
        ProjectNotFoundError: If the project does not exist.
    """
    async with async_session() as session:
        # Verify project exists
        project_stmt = select(Project).where(Project.id == project_id)
        project_result = await session.execute(project_stmt)
        if project_result.scalar_one_or_none() is None:
            raise ProjectNotFoundError(project_id)

        # Query snapshots
        stmt = (
            select(DatasetSnapshot)
            .where(DatasetSnapshot.project_id == project_id)
            .order_by(DatasetSnapshot.created_at.desc())
        )
        result = await session.execute(stmt)
        snapshots = result.scalars().all()

        return [
            {
                "id": snap.id,
                "version_label": snap.version_label,
                "row_count": snap.row_count,
                "created_at": snap.created_at.isoformat(),
            }
            for snap in snapshots
        ]


async def get_snapshot(snapshot_id: str) -> dict[str, Any]:
    """Get a single dataset snapshot by ID with full details.

    Args:
        snapshot_id: The UUID of the snapshot to retrieve.

    Returns:
        dict: Complete snapshot details including:
            - id: Snapshot UUID.
            - version_label: Human-readable version label.
            - file_name: Original file name.
            - file_size_bytes: File size in bytes.
            - row_count: Number of rows.
            - col_count: Number of columns.
            - schema: List of column schema dictionaries.
            - checksum_sha256: File checksum.
            - created_at: ISO-formatted timestamp.

    Raises:
        DatasetNotFoundError: If the snapshot does not exist.
    """
    async with async_session() as session:
        stmt = select(DatasetSnapshot).where(DatasetSnapshot.id == snapshot_id)
        result = await session.execute(stmt)
        snapshot = result.scalar_one_or_none()

        if snapshot is None:
            raise DatasetNotFoundError(snapshot_id)

        # Parse schema JSON
        try:
            schema = json.loads(snapshot.schema_json)
        except json.JSONDecodeError:
            schema = []

        return {
            "id": snapshot.id,
            "version_label": snapshot.version_label,
            "file_name": snapshot.file_name,
            "file_size_bytes": snapshot.file_size_bytes,
            "row_count": snapshot.row_count,
            "col_count": snapshot.col_count,
            "schema": schema,
            "checksum_sha256": snapshot.checksum_sha256,
            "created_at": snapshot.created_at.isoformat(),
        }


async def verify_snapshot_integrity(snapshot_id: str) -> dict[str, Any]:
    """Verify the integrity of a stored snapshot.

    Recomputes the SHA-256 checksum of the stored file and compares it
    to the recorded checksum.

    Args:
        snapshot_id: The UUID of the snapshot to verify.

    Returns:
        dict: Verification result containing:
            - snapshot_id: The snapshot ID.
            - is_valid: Boolean indicating if checksums match.
            - stored_checksum: The checksum stored in the database.
            - computed_checksum: The freshly computed checksum.
            - error: Error message if verification failed (optional).

    Raises:
        DatasetNotFoundError: If the snapshot does not exist.
    """
    async with async_session() as session:
        stmt = select(DatasetSnapshot).where(DatasetSnapshot.id == snapshot_id)
        result = await session.execute(stmt)
        snapshot = result.scalar_one_or_none()

        if snapshot is None:
            raise DatasetNotFoundError(snapshot_id)

        stored_path = Path(snapshot.stored_path)
        stored_checksum = snapshot.checksum_sha256

        # Check if file exists
        if not stored_path.exists():
            return {
                "snapshot_id": snapshot_id,
                "is_valid": False,
                "stored_checksum": stored_checksum,
                "computed_checksum": None,
                "error": f"Stored file not found: {stored_path}",
            }

        # Recompute checksum
        try:
            computed_checksum = compute_checksum(stored_path)
        except Exception as e:
            return {
                "snapshot_id": snapshot_id,
                "is_valid": False,
                "stored_checksum": stored_checksum,
                "computed_checksum": None,
                "error": f"Failed to compute checksum: {str(e)}",
            }

        return {
            "snapshot_id": snapshot_id,
            "is_valid": stored_checksum == computed_checksum,
            "stored_checksum": stored_checksum,
            "computed_checksum": computed_checksum,
        }


async def load_snapshot_data(snapshot_id: str) -> pd.DataFrame:
    """Load the data for a snapshot into a pandas DataFrame.

    Args:
        snapshot_id: The UUID of the snapshot to load.

    Returns:
        pd.DataFrame: The dataset as a pandas DataFrame.

    Raises:
        DatasetNotFoundError: If the snapshot does not exist.
        DatasetImportError: If the stored file cannot be read.
    """
    async with async_session() as session:
        stmt = select(DatasetSnapshot).where(DatasetSnapshot.id == snapshot_id)
        result = await session.execute(stmt)
        snapshot = result.scalar_one_or_none()

        if snapshot is None:
            raise DatasetNotFoundError(snapshot_id)

        stored_path = Path(snapshot.stored_path)

        if not stored_path.exists():
            raise DatasetImportError(
                f"Stored file not found: {stored_path}",
                {"snapshot_id": snapshot_id}
            )

        try:
            return pd.read_parquet(stored_path)
        except Exception as e:
            raise DatasetImportError(
                f"Failed to load snapshot data: {str(e)}",
                {"snapshot_id": snapshot_id}
            )
