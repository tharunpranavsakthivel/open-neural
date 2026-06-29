import pytest

from openneural_backend.services.project_service import (
    ProjectNotFoundError,
    ProjectValidationError,
    create_project,
    delete_project,
    get_dashboard_stats,
    get_project,
    list_projects,
    rename_project,
)


@pytest.mark.anyio
async def test_create_project_success(db_session) -> None:
    # Classification
    p_class = await create_project("Class Project", "classification")
    assert p_class["name"] == "Class Project"
    assert p_class["task_type"] == "classification"
    assert p_class["experiment_count"] == 0
    assert "id" in p_class

    # Regression
    p_reg = await create_project("Reg Project", "regression")
    assert p_reg["name"] == "Reg Project"
    assert p_reg["task_type"] == "regression"


@pytest.mark.anyio
async def test_create_project_validation_errors(db_session) -> None:
    with pytest.raises(ProjectValidationError, match="cannot be empty"):
        await create_project("", "classification")

    with pytest.raises(ProjectValidationError, match="cannot be empty"):
        await create_project("   ", "classification")

    with pytest.raises(ProjectValidationError, match="Invalid task_type"):
        await create_project("My Project", "invalid_task_type")


@pytest.mark.anyio
async def test_list_projects(db_session, sample_project) -> None:
    projects = await list_projects()
    assert len(projects) >= 1
    assert any(p["id"] == sample_project.id for p in projects)


@pytest.mark.anyio
async def test_get_project_success(db_session, sample_project) -> None:
    project = await get_project(sample_project.id)
    assert project["id"] == sample_project.id
    assert project["name"] == sample_project.name


@pytest.mark.anyio
async def test_get_project_not_found(db_session) -> None:
    with pytest.raises(ProjectNotFoundError, match="Project not found: nonexistent_id"):
        await get_project("nonexistent_id")


@pytest.mark.anyio
async def test_rename_project_success(db_session, sample_project) -> None:
    renamed = await rename_project(sample_project.id, "New Name")
    assert renamed["name"] == "New Name"

    # Verify update in DB
    refetched = await get_project(sample_project.id)
    assert refetched["name"] == "New Name"


@pytest.mark.anyio
async def test_rename_project_validation_errors(db_session, sample_project) -> None:
    with pytest.raises(ProjectValidationError, match="cannot be empty"):
        await rename_project(sample_project.id, "")

    with pytest.raises(ProjectValidationError, match="cannot be empty"):
        await rename_project(sample_project.id, "   ")

    with pytest.raises(ProjectNotFoundError):
        await rename_project("nonexistent_id", "New Name")


@pytest.mark.anyio
async def test_delete_project_success(db_session) -> None:
    p = await create_project("To Delete", "classification")
    res = await delete_project(p["id"])
    assert res["deleted"] is True

    with pytest.raises(ProjectNotFoundError):
        await get_project(p["id"])


@pytest.mark.anyio
async def test_delete_project_not_found(db_session) -> None:
    with pytest.raises(ProjectNotFoundError):
        await delete_project("nonexistent_id")


@pytest.mark.anyio
async def test_get_dashboard_stats(db_session, sample_project) -> None:
    stats = await get_dashboard_stats()
    assert "total_experiments" in stats
    assert "total_exports" in stats
    assert "total_snapshots" in stats
