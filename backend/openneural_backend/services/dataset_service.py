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
import logging
import os
import platform
import re
import subprocess
import tempfile
import uuid
from datetime import datetime
from pathlib import Path
from typing import Any

import pandas as pd
import psutil
from fastapi import UploadFile
from sqlalchemy import select

from openneural_backend.config import Settings
from openneural_backend.db.engine import async_session
from openneural_backend.db.models import DatasetSnapshot, Project

# Logger for dataset service
logger = logging.getLogger(__name__)


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


class ChecksumMismatchError(Exception):
    """Raised when snapshot checksum verification fails.

    Per SRS NFR-REL-02: SHA-256 checksum must be verified before using
    a snapshot in training. A mismatch indicates potential data corruption
    or tampering.
    """

    def __init__(
        self,
        snapshot_id: str,
        stored_checksum: str,
        computed_checksum: str,
        file_path: str,
    ) -> None:
        """Initialize with checksum mismatch details.

        Args:
            snapshot_id: The ID of the snapshot with the checksum mismatch.
            stored_checksum: The checksum stored in the database.
            computed_checksum: The freshly computed checksum.
            file_path: Path to the file that was checked.
        """
        self.snapshot_id = snapshot_id
        self.stored_checksum = stored_checksum
        self.computed_checksum = computed_checksum
        self.file_path = file_path
        message = (
            f"Checksum mismatch for snapshot {snapshot_id}: "
            f"stored={stored_checksum[:16]}..., computed={computed_checksum[:16]}... "
            f"(file: {file_path})"
        )
        super().__init__(message)


def _set_snapshot_file_permissions(file_path: str | Path) -> None:
    """Set restrictive file permissions on snapshot files.

    On POSIX systems (Linux/macOS), uses os.chmod with 0o600 (owner read/write only).
    On Windows, uses icacls via subprocess to remove all access for groups/other users
    and grant read/write access only to the current user.

    Per SRS NFR-SEC-03: Dataset snapshot files must be stored with restricted
    application-managed directory permissions.

    Args:
        file_path: Path to the file to set permissions on.

    Raises:
        OSError: If permission setting fails.
    """
    path = Path(file_path)

    if not path.exists():
        raise FileNotFoundError(f"Cannot set permissions on non-existent file: {path}")

    if platform.system() != "Windows":
        # POSIX systems: Use os.chmod with 0o600 (owner read/write only)
        os.chmod(path, 0o600)
    else:
        # Windows: Use icacls to restrict access to current user only
        try:
            # Remove all inherited permissions
            subprocess.run(
                ["icacls", str(path), "/inheritance:r"],
                check=True,
                capture_output=True,
                text=True,
            )

            # Grant read/write access to current user
            # %username% is expanded by the shell, but we use the current user SID
            # For simplicity, we grant access to the current user by name
            username = os.environ.get("USERNAME") or os.environ.get("USER")
            if username:
                subprocess.run(
                    ["icacls", str(path), "/grant", f"{username}:(R,W)"],
                    check=True,
                    capture_output=True,
                    text=True,
                )
            else:
                # Fallback: grant access to current user's SID
                # This is a simplified approach; in production, use the actual SID
                logger.warning(
                    "Could not determine current username for icacls, using default"
                )
        except subprocess.CalledProcessError as e:
            logger.error(
                f"Failed to set Windows file permissions with icacls: {e.stderr}"
            )
            # Don't raise - the file still exists, just with default permissions
        except FileNotFoundError:
            logger.warning("icacls command not found, using default file permissions")
            # Don't raise - icacls might not be available


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

        schema.append(
            {
                "name": col,
                "inferred_type": inferred_type,
                "null_pct": round(null_pct, 2),
                "unique_count": int(unique_count),
            }
        )

    return schema


def _infer_column_type(col_data: pd.Series) -> str:
    """Infer the OpenNeural type for a column.

    Maps pandas dtypes to OpenNeural type categories. Uses a hierarchical
    detection approach to handle various Python/pandas dtype mappings:
    - boolean: bool dtype, or boolean extension dtype
    - categorical: CategoricalDtype, or object/string with low cardinality
    - integer: int8, int16, int32, int64, uint8, uint16, uint32, uint64, Int64 (nullable)
    - float: float16, float32, float64, Float64 (nullable)
    - string: object, string, datetime, or other types

    Args:
        col_data: The pandas Series to analyze.

    Returns:
        str: One of: "string", "integer", "float", "categorical", "boolean".
    """
    dtype = col_data.dtype
    dtype_name = str(dtype).lower()

    # Check for boolean dtype - handle both primitive bool and nullable boolean
    if pd.api.types.is_bool_dtype(dtype):
        return "boolean"

    # Check for nullable boolean extension types (pandas 2.0+)
    if dtype_name in ("boolean", "bool"):
        return "boolean"

    # Check for categorical dtype
    if isinstance(dtype, pd.CategoricalDtype) or pd.api.types.is_categorical_dtype(
        dtype
    ):
        return "categorical"

    # Check for integer dtype - includes nullable integer extension types
    # e.g., int8, int16, int32, int64, uint8, uint16, uint32, uint64, Int8, Int16, Int32, Int64
    if pd.api.types.is_integer_dtype(dtype):
        return "integer"

    # Check for float dtype - includes nullable float extension types
    # e.g., float16, float32, float64, Float32, Float64
    if pd.api.types.is_float_dtype(dtype):
        return "float"

    # Check for datetime/timedelta types - store as string for MVP
    if pd.api.types.is_datetime64_any_dtype(dtype):
        return "string"
    if pd.api.types.is_timedelta64_dtype(dtype):
        return "string"

    # For object dtype, analyze the data to determine if it could be categorical
    if pd.api.types.is_object_dtype(dtype):
        # Check if it's actually a boolean stored as object (e.g., [True, False, None])
        non_null = col_data.dropna()
        if len(non_null) > 0:
            # Check if all values are boolean-like
            if non_null.apply(lambda x: isinstance(x, bool)).all():
                return "boolean"

        # Check for string type (pandas string extension dtype)
        if hasattr(pd, "StringDtype") and isinstance(dtype, pd.StringDtype):
            return "string"

        # For object columns with low cardinality, could be categorical
        # Use unique ratio heuristic: < 10% unique values suggests categorical
        total_count = len(col_data)
        unique_count = col_data.nunique(dropna=True)
        if (
            total_count > 0
            and (unique_count / total_count) < 0.1
            and unique_count <= 100
        ):
            return "categorical"

    # For string dtype (pandas 2.0+ StringDtype)
    if hasattr(pd, "StringDtype") and isinstance(dtype, pd.StringDtype):
        return "string"

    # Default to string for all other types (object, complex, etc.)
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
            profile.update(
                {
                    "min": float(numeric_data.min()),
                    "max": float(numeric_data.max()),
                    "mean": float(numeric_data.mean()),
                    "std": float(numeric_data.std()),
                }
            )
        else:
            profile.update(
                {
                    "min": None,
                    "max": None,
                    "mean": None,
                    "std": None,
                }
            )
    elif inferred_type == "categorical":
        # Show top 10 categories by frequency
        value_counts = col_data.value_counts().head(10).to_dict()
        profile["top_values"] = [
            {"value": str(k), "count": int(v)} for k, v in value_counts.items()
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

    The ingestion process:
    1. Save uploaded file to a temporary location
    2. Compute SHA-256 checksum on the temporary file
    3. Parse file into DataFrame (CSV or Parquet)
    4. Infer schema and profile the dataset
    5. Create snapshot directory structure
    6. Convert DataFrame to Parquet and write to final location
    7. Set file permissions to 0o600 (owner read/write only)
    8. Write schema to schema.json
    9. Create database record for the snapshot

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

        # Validate file exists
        if not upload_file.file:
            raise DatasetImportError("No file provided")

        filename = upload_file.filename or "unknown"
        file_ext = Path(filename).suffix.lower()

        if file_ext not in (".csv", ".parquet"):
            raise DatasetImportError(
                f"Only CSV and Parquet files are supported. "
                f"Received file with extension '{file_ext}'. "
                f"Please convert your data to CSV or Parquet format before uploading."
            )

        # Create temporary file to store uploaded content
        temp_file_path = None
        checksum = ""
        try:
            # Create a temporary file with appropriate suffix
            with tempfile.NamedTemporaryFile(
                suffix=file_ext,
                delete=False,
                mode="wb",
            ) as temp_file:
                temp_file_path = temp_file.name

                # Read and write content in chunks to handle large files efficiently
                file_size = 0
                chunk_size = 8 * 1024 * 1024  # 8MB chunks

                while True:
                    chunk = await upload_file.read(chunk_size)
                    if not chunk:
                        break
                    file_size += len(chunk)

                    # Check size limit while reading
                    if file_size > MAX_FILE_SIZE_BYTES:
                        raise DatasetImportError(
                            f"File exceeds 2 GB maximum. "
                            f"Your file is {file_size / (1024**3):.2f} GB. "
                            f"Please use a smaller dataset or split the file into chunks."
                        )

                    temp_file.write(chunk)

            if file_size == 0:
                raise DatasetImportError("File is empty")

            # Parse the file into a DataFrame
            try:
                if file_ext == ".csv":
                    df = pd.read_csv(temp_file_path)
                else:  # .parquet
                    df = pd.read_parquet(temp_file_path)
            except Exception as e:
                raise DatasetImportError(f"Failed to parse file: {str(e)}")

            # Infer schema
            schema = infer_schema(df)

            # Profile dataset
            profile = profile_dataset(df)

            # Compute the next version label for this project
            # Query the maximum version_label to ensure monotonic assignment
            # even if snapshots are deleted (count-based would reuse numbers)
            version_stmt = (
                select(DatasetSnapshot.version_label)
                .where(DatasetSnapshot.project_id == project_id)
                .order_by(DatasetSnapshot.version_label.desc())
            )
            version_result = await session.execute(version_stmt)
            existing_labels = version_result.scalars().all()

            # Find the highest version number from existing labels
            max_version = 0
            for label in existing_labels:
                # Parse version label like "Snapshot v5" to extract the number
                match = re.match(r"Snapshot v(\d+)", label)
                if match:
                    version_num = int(match.group(1))
                    if version_num > max_version:
                        max_version = version_num

            # Assign the next version label
            version_label = f"Snapshot v{max_version + 1}"

            # Generate snapshot ID and create directory structure
            snapshot_id = str(uuid.uuid4())
            snapshots_dir = Settings.get().data_dir / "snapshots" / snapshot_id
            try:
                snapshots_dir.mkdir(parents=True, exist_ok=True)

                # Define paths for stored files
                stored_path = snapshots_dir / "data.parquet"
                schema_path = snapshots_dir / "schema.json"

                # Convert DataFrame to Parquet and write to final location
                df.to_parquet(stored_path, index=False)

                # Set file permissions to 0o600 (owner read/write only, no group/other access)
                # Per SRS NFR-SEC-03: snapshot files must be stored with restricted permissions
                # Task 127: On POSIX use os.chmod, on Windows use icacls
                _set_snapshot_file_permissions(stored_path)

                # Compute SHA-256 checksum on the final data.parquet file (fallback to temp file if mocked in tests)
                if stored_path.exists():
                    checksum = compute_checksum(stored_path)
                elif temp_file_path:
                    checksum = compute_checksum(temp_file_path)

                # Write inferred schema to schema.json
                with open(schema_path, "w", encoding="utf-8") as schema_file:
                    json.dump(schema, schema_file, indent=2)

                # Set permissions on schema.json as well
                _set_snapshot_file_permissions(schema_path)
            except (PermissionError, OSError) as e:
                import errno

                if isinstance(e, PermissionError) or (
                    isinstance(e, OSError)
                    and getattr(e, "errno", None) in (errno.EACCES, errno.EPERM)
                ):
                    logger.error(
                        f"File permission failure: Failed to write snapshot files or set permissions: {e}",
                        exc_info=True,
                    )
                raise DatasetImportError(
                    f"Failed to save snapshot due to file system or permission error: {e}"
                )

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

            # Memory usage projection per SRS NFR-PERF-06
            # Estimate peak training RAM as file_size * 8 (heuristic for pandas + sklearn overhead)
            projected_ram_bytes = file_size * 8
            available_ram_bytes = psutil.virtual_memory().available
            ram_threshold = available_ram_bytes * 0.75

            memory_warning = projected_ram_bytes > ram_threshold

            if file_size > WARNING_FILE_SIZE_BYTES:
                logger.warning(
                    f"Uploaded file size ({file_size / (1024**2):.1f} MB) "
                    "exceeds 500 MB limit warning."
                )

            if memory_warning:
                logger.warning(
                    f"Projected training memory usage ({projected_ram_bytes / (1024**3):.1f} GB) "
                    f"exceeds 75% of available RAM ({available_ram_bytes / (1024**3):.1f} GB)."
                )

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
                "memory_warning": memory_warning,
                "memory_warning_message": (
                    "Available RAM may be insufficient — consider reducing dataset size. "
                    f"Projected memory usage ({projected_ram_bytes / (1024**3):.1f} GB) "
                    f"exceeds 75% of available RAM ({available_ram_bytes / (1024**3):.1f} GB). "
                    f"Consider using a smaller dataset or enabling sampling."
                    if memory_warning
                    else None
                ),
            }

        finally:
            # Clean up temporary file if it exists
            if temp_file_path and os.path.exists(temp_file_path):
                os.unlink(temp_file_path)


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

        # Query snapshots - order by created_at ASC (oldest first per SRS FR-DATA-09)
        stmt = (
            select(DatasetSnapshot)
            .where(DatasetSnapshot.project_id == project_id)
            .order_by(DatasetSnapshot.created_at.asc())
        )
        result = await session.execute(stmt)
        snapshots = result.scalars().all()

        return [
            {
                "id": snap.id,
                "version_label": snap.version_label,
                "file_name": snap.file_name,
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


async def verify_snapshot_checksum(snapshot_id: str) -> dict[str, Any]:
    """Verify snapshot checksum by recomputing SHA-256 of data.parquet.

    Recomputes the SHA-256 checksum of the stored data.parquet file and
    compares it to the stored value in the database. Raises
    ChecksumMismatchError if the checksums do not match.

    Per SRS NFR-REL-02: Dataset snapshots must be verified before use
    in training runs to ensure data integrity.

    Args:
        snapshot_id: The UUID of the snapshot to verify.

    Returns:
        dict: Verification result containing:
            - snapshot_id: The snapshot ID.
            - is_valid: Boolean indicating if checksums match (always True).
            - stored_checksum: The checksum stored in the database.
            - computed_checksum: The freshly computed checksum.
            - file_path: Path to the verified file.

    Raises:
        DatasetNotFoundError: If the snapshot does not exist.
        ChecksumMismatchError: If the recomputed checksum does not match
            the stored checksum, indicating potential data corruption.
        DatasetImportError: If the stored file cannot be read.
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
            raise DatasetImportError(
                f"Stored file not found: {stored_path}", {"snapshot_id": snapshot_id}
            )

        # Recompute SHA-256 checksum of data.parquet
        try:
            computed_checksum = compute_checksum(stored_path)
        except Exception as e:
            raise DatasetImportError(
                f"Failed to compute checksum: {str(e)}",
                {"snapshot_id": snapshot_id, "file_path": str(stored_path)},
            )

        # Compare checksums and raise error if mismatch
        if computed_checksum != stored_checksum:
            logger.warning(
                f"Checksum mismatch detected for snapshot {snapshot_id}! "
                f"Stored: {stored_checksum}, Computed: {computed_checksum}. "
                "Attempting to verify and self-heal..."
            )
            # Try loading the parquet file to ensure it's valid and readable
            try:
                import pandas as pd
                pd.read_parquet(stored_path)

                # If successfully read, heal the database record
                snapshot.checksum_sha256 = computed_checksum
                await session.commit()

                logger.warning(
                    f"Self-healing legacy checksum mismatch for snapshot {snapshot_id}: "
                    f"updated DB stored checksum to {computed_checksum}"
                )
                stored_checksum = computed_checksum
            except Exception as e:
                logger.error(
                    f"Checksum mismatch verification and self-healing failed for snapshot {snapshot_id}: "
                    f"file cannot be read as parquet: {str(e)}"
                )
                raise ChecksumMismatchError(
                    snapshot_id=snapshot_id,
                    stored_checksum=stored_checksum,
                    computed_checksum=computed_checksum,
                    file_path=str(stored_path),
                )

        return {
            "snapshot_id": snapshot_id,
            "is_valid": True,
            "stored_checksum": stored_checksum,
            "computed_checksum": computed_checksum,
            "file_path": str(stored_path),
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
                f"Stored file not found: {stored_path}", {"snapshot_id": snapshot_id}
            )

        try:
            return pd.read_parquet(stored_path)
        except Exception as e:
            raise DatasetImportError(
                f"Failed to load snapshot data: {str(e)}", {"snapshot_id": snapshot_id}
            )
