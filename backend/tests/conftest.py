"""Pytest configuration and shared fixtures for OpenNeural backend tests.

Defines isolated temporary data directory, database session, ASGI-bound AsyncClient,
and sample database model fixtures for testing.
"""

import contextvars
import os
import shutil
import sys
import tempfile
from collections.abc import AsyncGenerator, Generator
from pathlib import Path

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import event
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.pool import NullPool

# Define global ContextVars for database isolation in async tests/tasks
current_engine_var = contextvars.ContextVar("current_engine_var")
current_sessionmaker_var = contextvars.ContextVar("current_sessionmaker_var")

# Create initial session-scoped temporary directory to prevent module-level import crashes
_initial_temp_dir = tempfile.mkdtemp()
os.environ.setdefault("OPENNEURAL_DATA_DIR", _initial_temp_dir)
os.environ.setdefault("OPENNEURAL_SECRET", "test_secret_for_ipc_auth_42")


# Proxy classes to delegate attribute and call access to active context database resources
class EngineProxy:
    @property
    def _underlying(self):
        try:
            return current_engine_var.get()
        except LookupError:
            return _default_engine

    def __getattr__(self, name):
        return getattr(self._underlying, name)


class SessionmakerProxy:
    @property
    def _underlying(self):
        try:
            return current_sessionmaker_var.get()
        except LookupError:
            return _default_sessionmaker

    def __call__(self, *args, **kwargs):
        return self._underlying(*args, **kwargs)

    def __getattr__(self, name):
        return getattr(self._underlying, name)


# Pre-patch openneural_backend.db.engine with proxies BEFORE other modules import them

import openneural_backend.db.engine
db_engine_module = sys.modules["openneural_backend.db.engine"]

_default_engine = db_engine_module.engine
_default_sessionmaker = db_engine_module.async_session

db_engine_module.engine = EngineProxy()
db_engine_module.async_session = SessionmakerProxy()

# Now import Settings and Base models, which will cleanly import our proxies
from openneural_backend.config import Settings
from openneural_backend.db.models import (
    Base,
    DatasetSnapshot,
    Pipeline,
    Project,
)


def pytest_unconfigure(config):
    """Clean up the initial temporary directory on test exit."""
    shutil.rmtree(_initial_temp_dir, ignore_errors=True)


@pytest.fixture(scope="function")
def tmp_data_dir() -> Generator[Path, None, None]:
    """Create a temporary directory for OpenNeural data and yield it.

    This fixture overrides the `OPENNEURAL_DATA_DIR` and `OPENNEURAL_SECRET`
    environment variables, resets the Settings singleton, ensures directory
    creation, and cleans up after the test completes.

    Yields:
        Path: The temporary directory path.
    """
    temp_dir = Path(tempfile.mkdtemp())
    orig_data_dir = os.environ.get("OPENNEURAL_DATA_DIR")
    orig_secret = os.environ.get("OPENNEURAL_SECRET")

    # Set temporary environment variables
    os.environ["OPENNEURAL_DATA_DIR"] = str(temp_dir)
    os.environ["OPENNEURAL_SECRET"] = "test_secret_for_ipc_auth_42"

    # Reset Settings singleton to pick up the new env variables
    Settings.reset()
    settings = Settings.get()
    settings.ensure_directories()

    yield temp_dir

    # Cleanup the temporary directory
    shutil.rmtree(temp_dir, ignore_errors=True)

    # Restore original environment variables
    if orig_data_dir is not None:
        os.environ["OPENNEURAL_DATA_DIR"] = orig_data_dir
    else:
        os.environ.pop("OPENNEURAL_DATA_DIR", None)

    if orig_secret is not None:
        os.environ["OPENNEURAL_SECRET"] = orig_secret
    else:
        os.environ.pop("OPENNEURAL_SECRET", None)

    # Reset again to restore original settings
    Settings.reset()


@pytest.fixture(scope="function")
async def db_session(tmp_data_dir: Path) -> AsyncGenerator[AsyncSession, None]:
    """Provide an isolated, clean SQLite database session for a test.

    Re-binds the engine and sessionmaker to the temporary data directory,
    creates all schema tables, and yields an AsyncSession.

    Args:
        tmp_data_dir: The temporary data directory fixture.

    Yields:
        AsyncGenerator[AsyncSession, None]: An active async database session.
    """
    from openneural_backend.db.engine import _get_db_url

    new_engine = create_async_engine(
        _get_db_url(),
        echo=False,
        poolclass=NullPool,
    )

    # Ensure SQLite WAL mode and foreign keys are enforced on this engine
    @event.listens_for(new_engine.sync_engine, "connect")
    def _set_sqlite_pragma(conn, _connection_record) -> None:
        conn.execute("PRAGMA journal_mode=WAL")
        conn.execute("PRAGMA foreign_keys=ON")

    new_sessionmaker = async_sessionmaker(
        new_engine,
        class_=AsyncSession,
        expire_on_commit=False,
        autocommit=False,
        autoflush=False,
    )

    # Create all schema tables for this isolated test run
    async with new_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    # Bind the engine and sessionmaker to the ContextVar for task-safe isolation
    token_engine = current_engine_var.set(new_engine)
    token_sessionmaker = current_sessionmaker_var.set(new_sessionmaker)

    try:
        async with new_sessionmaker() as session:
            yield session
            await session.rollback()
    finally:
        current_engine_var.reset(token_engine)
        current_sessionmaker_var.reset(token_sessionmaker)
        await new_engine.dispose()


@pytest.fixture(scope="function")
async def async_client(
    tmp_data_dir: Path, db_session: AsyncSession
) -> AsyncGenerator[AsyncClient, None]:
    """Provide an AsyncClient for testing the FastAPI application.

    Args:
        tmp_data_dir: The temporary data directory fixture.
        db_session: The temporary database session fixture.

    Yields:
        AsyncGenerator[AsyncClient, None]: The configured async HTTP client.
    """
    from openneural_backend.app import create_app

    app = create_app()

    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://testserver",
        headers={"X-OpenNeural-Secret": "test_secret_for_ipc_auth_42"},
    ) as client:
        yield client


@pytest.fixture(scope="function")
async def sample_project(db_session: AsyncSession) -> Project:
    """Provide a sample classification project in the database.

    Args:
        db_session: The temporary database session fixture.

    Returns:
        Project: The created project model instance.
    """
    project = Project(
        name="Sample Classification Project",
        task_type="classification",
    )
    db_session.add(project)
    await db_session.commit()
    await db_session.refresh(project)
    return project


@pytest.fixture(scope="function")
async def sample_snapshot(
    db_session: AsyncSession, sample_project: Project
) -> DatasetSnapshot:
    """Provide a sample dataset snapshot associated with sample_project.

    Args:
        db_session: The temporary database session.
        sample_project: The sample project fixture.

    Returns:
        DatasetSnapshot: The created dataset snapshot model instance.
    """
    snapshot = DatasetSnapshot(
        project_id=sample_project.id,
        version_label="Snapshot v1",
        original_path="/path/to/original.csv",
        stored_path="/path/to/stored.parquet",
        file_name="original.csv",
        file_size_bytes=1024,
        row_count=100,
        col_count=5,
        schema_json='{"columns": []}',
        checksum_sha256="fake_sha256_hash_value_123456",
    )
    db_session.add(snapshot)
    await db_session.commit()
    await db_session.refresh(snapshot)
    return snapshot


@pytest.fixture(scope="function")
async def sample_pipeline(
    db_session: AsyncSession,
    sample_project: Project,
    sample_snapshot: DatasetSnapshot,
) -> Pipeline:
    """Provide a sample preprocessing pipeline associated with sample_project and sample_snapshot.

    Args:
        db_session: The temporary database session.
        sample_project: The sample project fixture.
        sample_snapshot: The sample snapshot fixture.

    Returns:
        Pipeline: The created pipeline model instance.
    """
    pipeline = Pipeline(
        project_id=sample_project.id,
        snapshot_id=sample_snapshot.id,
        name="Sample Preprocessing Pipeline",
        config_json='{"blocks": []}',
        validated=1,
    )
    db_session.add(pipeline)
    await db_session.commit()
    await db_session.refresh(pipeline)
    return pipeline


@pytest.fixture(scope="session")
def anyio_backend() -> str:
    """Limit anyio tests to the asyncio backend only."""
    return "asyncio"

