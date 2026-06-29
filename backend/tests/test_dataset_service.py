"""Unit tests for the dataset service.

Validates schema inference, null percentage and unique count calculations,
SHA-256 checksums, size checks (2 GB limit, 500 MB warning), Parquet conversion,
restrictive POSIX permissions, and monotonic version label increments.
"""

import hashlib
import json
import os
import platform
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import pandas as pd
import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from openneural_backend.db.models import DatasetSnapshot, Project
from openneural_backend.services.dataset_service import (
    DatasetImportError,
    compute_checksum,
    import_file,
    infer_schema,
)


@pytest.fixture(autouse=True)
def setup_dataset_service_session(tmp_data_dir, db_session) -> None:
    """Overwrites dataset_service's local async_session reference with the test sessionmaker.

    This ensures that import_file queries the temporary SQLite database rather
    than attempting to connect to a non-existent or production database.
    """
    import openneural_backend.services.dataset_service as ds
    from openneural_backend.db.engine import async_session

    orig_session = ds.async_session
    ds.async_session = async_session
    yield
    ds.async_session = orig_session


@pytest.mark.anyio
async def test_schema_inference_all_types() -> None:
    """Verify schema inference correctly identifies all 5 OpenNeural data types.

    Types: "integer", "float", "boolean", "categorical", "string".
    """
    # Create a DataFrame representing all 5 types
    df = pd.DataFrame({
        "col_int": [1, 2, 3, 4],
        "col_float": [1.1, 2.2, 3.3, 4.4],
        "col_bool": [True, False, True, False],
        "col_cat": pd.Series(["apple", "banana", "apple", "banana"], dtype="category"),
        "col_str": ["hello", "world", "foo", "bar"],
    })

    schema = infer_schema(df)
    schema_dict = {col["name"]: col["inferred_type"] for col in schema}

    assert schema_dict["col_int"] == "integer"
    assert schema_dict["col_float"] == "float"
    assert schema_dict["col_bool"] == "boolean"
    assert schema_dict["col_cat"] == "categorical"
    assert schema_dict["col_str"] == "string"


@pytest.mark.anyio
async def test_null_pct_and_unique_count() -> None:
    """Verify that null_pct and unique_count are accurately computed."""
    df = pd.DataFrame({
        "col_test": [1, 2, None, 2],  # 4 rows, 1 null (25%), unique non-nulls: [1, 2] (count = 2)
    })

    schema = infer_schema(df)
    col_meta = schema[0]

    assert col_meta["name"] == "col_test"
    assert col_meta["null_pct"] == 25.0
    assert col_meta["unique_count"] == 2


@pytest.mark.anyio
async def test_checksum_computation(tmp_path: Path) -> None:
    """Verify SHA-256 checksum calculation on files."""
    test_file = tmp_path / "test_checksum.txt"
    test_content = b"OpenNeural SHA-256 verification content"
    test_file.write_bytes(test_content)

    expected_hash = hashlib.sha256(test_content).hexdigest()
    computed_hash = compute_checksum(test_file)

    assert computed_hash == expected_hash


@pytest.mark.anyio
async def test_2gb_rejection(db_session: AsyncSession, sample_project: Project) -> None:
    """Verify files exceeding 2 GB are rejected with a DatasetImportError."""
    mock_file = MagicMock()
    mock_file.filename = "huge_file.csv"
    
    # Simulate a chunk reader that reports size > 2 GB immediately
    # We yield 2.1 GB of data in one chunk
    chunk_data = b"x" * (2 * 1024 * 1024 * 1024 + 1024)
    mock_file.read = AsyncMock(side_effect=[chunk_data, b""])

    with pytest.raises(DatasetImportError) as exc_info:
        await import_file(sample_project.id, mock_file)

    assert "exceeds 2 GB maximum" in str(exc_info.value)


@pytest.mark.anyio
async def test_500mb_warning(db_session: AsyncSession, sample_project: Project) -> None:
    """Verify uploading a file between 500 MB and 2 GB logs a warning."""
    mock_file = MagicMock()
    mock_file.filename = "large_file.csv"
    
    # 510 MB CSV contents (we need to trigger warning but still parse as CSV cleanly)
    # To bypass large memory/CPU parsing overhead during test, we mock pd.read_csv to return a small DF
    dummy_csv_chunk = b"col1,col2\n1,2\n"
    # We repeat the chunk so the total bytes read is 510 MB
    total_bytes = 510 * 1024 * 1024
    
    # We mock pd.read_csv to avoid loading 510 MB into memory in test
    mock_df = pd.DataFrame({"col1": [1], "col2": [2]})
    
    # Simple chunk reader returning 100 MB chunks
    chunk_size = 100 * 1024 * 1024
    chunks = [b"x" * chunk_size] * 5 + [b"x" * (10 * 1024 * 1024)] + [b""]
    mock_file.read = AsyncMock(side_effect=chunks)

    with patch("pandas.read_csv", return_value=mock_df), \
         patch("pandas.DataFrame.to_parquet"), \
         patch("openneural_backend.services.dataset_service._set_snapshot_file_permissions"), \
         patch("openneural_backend.services.dataset_service.logger") as mock_logger:
        
        await import_file(sample_project.id, mock_file)
        
        # Verify the warning is logged
        warning_logged = any(
            "exceeds 500 MB limit warning" in call[0][0]
            for call in mock_logger.warning.call_args_list
        )
        assert warning_logged


@pytest.mark.anyio
async def test_parquet_conversion(
    tmp_data_dir: Path, db_session: AsyncSession, sample_project: Project
) -> None:
    """Verify that imported CSV datasets are properly converted to Parquet format."""
    mock_file = MagicMock()
    mock_file.filename = "import_test.csv"
    mock_file.read = AsyncMock(side_effect=[b"a,b\n1,2\n3,4\n", b""])

    snapshot_dict = await import_file(sample_project.id, mock_file)
    
    assert snapshot_dict is not None
    assert "id" in snapshot_dict
    
    # Construct paths using snapshot_dict["id"]
    from openneural_backend.config import Settings
    parquet_path = Settings.get().data_dir / "snapshots" / snapshot_dict["id"] / "data.parquet"
    assert parquet_path.exists()
    
    loaded_df = pd.read_parquet(parquet_path)
    assert list(loaded_df.columns) == ["a", "b"]
    assert len(loaded_df) == 2


@pytest.mark.anyio
async def test_file_permission_0o600_posix(
    tmp_data_dir: Path, db_session: AsyncSession, sample_project: Project
) -> None:
    """Verify snapshot Parquet and schema.json are stored with 0o600 permissions on POSIX."""
    if platform.system() == "Windows":
        pytest.skip("POSIX permission tests only apply to Linux/macOS")

    mock_file = MagicMock()
    mock_file.filename = "perms_test.csv"
    mock_file.read = AsyncMock(side_effect=[b"col1\nvalue\n", b""])

    snapshot_dict = await import_file(sample_project.id, mock_file)
    
    from openneural_backend.config import Settings
    parquet_path = Settings.get().data_dir / "snapshots" / snapshot_dict["id"] / "data.parquet"
    schema_path = parquet_path.parent / "schema.json"

    assert parquet_path.exists()
    assert schema_path.exists()

    # Get POSIX file modes and verify restrictive 0o600 (read/write only by owner)
    parquet_mode = os.stat(parquet_path).st_mode & 0o777
    schema_mode = os.stat(schema_path).st_mode & 0o777

    assert parquet_mode == 0o600
    assert schema_mode == 0o600


@pytest.mark.anyio
async def test_monotonic_version_label_increment(
    tmp_data_dir: Path, db_session: AsyncSession, sample_project: Project
) -> None:
    """Verify version labels increment monotonically (v1 -> v2 -> v3) for same project."""
    # First Import
    mock_file_1 = MagicMock()
    mock_file_1.filename = "v1.csv"
    mock_file_1.read = AsyncMock(side_effect=[b"x\n1\n", b""])
    snapshot_1 = await import_file(sample_project.id, mock_file_1)

    # Second Import
    mock_file_2 = MagicMock()
    mock_file_2.filename = "v2.csv"
    mock_file_2.read = AsyncMock(side_effect=[b"x\n2\n", b""])
    snapshot_2 = await import_file(sample_project.id, mock_file_2)

    # Third Import
    mock_file_3 = MagicMock()
    mock_file_3.filename = "v3.csv"
    mock_file_3.read = AsyncMock(side_effect=[b"x\n3\n", b""])
    snapshot_3 = await import_file(sample_project.id, mock_file_3)

    assert snapshot_1["version_label"] == "Snapshot v1"
    assert snapshot_2["version_label"] == "Snapshot v2"
    assert snapshot_3["version_label"] == "Snapshot v3"


@pytest.mark.anyio
async def test_get_snapshots_exceptions(db_session: AsyncSession) -> None:
    """Verify get_snapshots error handling and basic listing."""
    from openneural_backend.services.dataset_service import get_snapshots, ProjectNotFoundError

    # Non-existent project
    with pytest.raises(ProjectNotFoundError):
        await get_snapshots("00000000-0000-0000-0000-000000000000")


@pytest.mark.anyio
async def test_get_snapshot_exceptions(db_session: AsyncSession, sample_project: Project) -> None:
    """Verify get_snapshot error handling and JSONDecodeError on schema."""
    from openneural_backend.services.dataset_service import get_snapshot, DatasetNotFoundError

    # Non-existent snapshot
    with pytest.raises(DatasetNotFoundError):
        await get_snapshot("00000000-0000-0000-0000-000000000000")

    # Schema JSON Decode Error
    snap = DatasetSnapshot(
        project_id=sample_project.id,
        version_label="Snapshot v99",
        file_name="corrupt.csv",
        original_path="/tmp/corrupt.csv",
        stored_path="/tmp/corrupt.parquet",
        file_size_bytes=100,
        row_count=10,
        col_count=2,
        schema_json="invalid json {",
        checksum_sha256="abc",
    )
    db_session.add(snap)
    await db_session.commit()
    await db_session.refresh(snap)

    details = await get_snapshot(snap.id)
    assert details["schema"] == []


@pytest.mark.anyio
async def test_verify_snapshot_integrity_and_checksum_exceptions(
    db_session: AsyncSession, sample_project: Project
) -> None:
    """Verify verify_snapshot_integrity and verify_snapshot_checksum raise errors on missing files and mismatches."""
    from openneural_backend.services.dataset_service import (
        verify_snapshot_integrity,
        verify_snapshot_checksum,
        DatasetNotFoundError,
    )

    # Non-existent snapshot for integrity
    with pytest.raises(DatasetNotFoundError):
        await verify_snapshot_integrity("00000000-0000-0000-0000-000000000000")

    # Non-existent snapshot for checksum
    with pytest.raises(DatasetNotFoundError):
        await verify_snapshot_checksum("00000000-0000-0000-0000-000000000000")

    # Stored file not found
    snap = DatasetSnapshot(
        project_id=sample_project.id,
        version_label="Snapshot v100",
        file_name="missing.csv",
        original_path="/tmp/missing.csv",
        stored_path="/tmp/non_existent_file_12345.parquet",
        file_size_bytes=100,
        row_count=10,
        col_count=2,
        schema_json="[]",
        checksum_sha256="abc",
    )
    db_session.add(snap)
    await db_session.commit()
    await db_session.refresh(snap)

    res_integrity = await verify_snapshot_integrity(snap.id)
    assert res_integrity["is_valid"] is False
    assert "Stored file not found" in res_integrity["error"]

    with pytest.raises(DatasetImportError, match="Stored file not found"):
        await verify_snapshot_checksum(snap.id)

