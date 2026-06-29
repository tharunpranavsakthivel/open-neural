"""Tests to verify that the pytest fixtures defined in conftest.py work correctly.

Validates that tmp_data_dir, db_session, async_client, sample_project,
sample_snapshot, and sample_pipeline operate properly and can perform
database queries and API requests.
"""

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from openneural_backend.db.models import DatasetSnapshot, Pipeline, Project


@pytest.mark.anyio
async def test_tmp_data_dir_fixture(tmp_data_dir) -> None:
    """Verify that tmp_data_dir is a valid Path and directory exists."""
    assert tmp_data_dir.exists()
    assert tmp_data_dir.is_dir()


@pytest.mark.anyio
async def test_db_session_fixture(db_session: AsyncSession) -> None:
    """Verify that db_session can insert and query records."""
    project = Project(name="Fixture Test Project", task_type="regression")
    db_session.add(project)
    await db_session.commit()

    stmt = select(Project).where(Project.name == "Fixture Test Project")
    result = await db_session.execute(stmt)
    retrieved_project = result.scalar_one_or_none()

    assert retrieved_project is not None
    assert retrieved_project.task_type == "regression"


@pytest.mark.anyio
async def test_async_client_fixture(async_client: AsyncClient) -> None:
    """Verify that async_client can request the health check endpoint."""
    response = await async_client.get("/api/v1/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"


@pytest.mark.anyio
async def test_sample_fixtures(
    db_session: AsyncSession,
    sample_project: Project,
    sample_snapshot: DatasetSnapshot,
    sample_pipeline: Pipeline,
) -> None:
    """Verify that the sample project, snapshot, and pipeline are correctly inserted and retrievable."""
    # Verify Project
    stmt_proj = select(Project).where(Project.id == sample_project.id)
    retrieved_proj = (await db_session.execute(stmt_proj)).scalar_one_or_none()
    assert retrieved_proj is not None
    assert retrieved_proj.name == "Sample Classification Project"

    # Verify Snapshot
    stmt_snap = select(DatasetSnapshot).where(DatasetSnapshot.id == sample_snapshot.id)
    retrieved_snap = (await db_session.execute(stmt_snap)).scalar_one_or_none()
    assert retrieved_snap is not None
    assert retrieved_snap.project_id == sample_project.id
    assert retrieved_snap.version_label == "Snapshot v1"

    # Verify Pipeline
    stmt_pipe = select(Pipeline).where(Pipeline.id == sample_pipeline.id)
    retrieved_pipe = (await db_session.execute(stmt_pipe)).scalar_one_or_none()
    assert retrieved_pipe is not None
    assert retrieved_pipe.project_id == sample_project.id
    assert retrieved_pipe.snapshot_id == sample_snapshot.id
    assert retrieved_pipe.validated == 1
