"""Project service for OpenNeural backend.

Provides CRUD operations and business logic for project management.
All methods are async and use SQLAlchemy 2.0 async patterns.

Exposes:
    create_project(name, task_type): Create a new project with validation.
    list_projects(): List all projects with their experiment counts.
    get_project(project_id): Get a single project by ID.
    rename_project(project_id, name): Rename an existing project.
    delete_project(project_id): Delete a project and all associated data.
    get_dashboard_stats(): Get aggregate statistics for the dashboard.
"""

from datetime import datetime
import logging
from typing import Literal

logger = logging.getLogger(__name__)

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import selectinload

from openneural_backend.db.engine import async_session
from openneural_backend.db.models import (
    DatasetSnapshot,
    Experiment,
    Export,
    Project,
)


class ProjectNotFoundError(Exception):
    """Raised when a requested project does not exist."""

    def __init__(self, project_id: str) -> None:
        """Initialize with the missing project ID.

        Args:
            project_id: The ID of the project that was not found.
        """
        self.project_id = project_id
        super().__init__(f"Project not found: {project_id}")


class ProjectValidationError(Exception):
    """Raised when project validation fails."""

    pass


async def create_project(
    name: str,
    task_type: Literal["classification", "regression"],
) -> dict:
    """Create a new project.

    Creates a new project with the specified name and task type. Validates
    that task_type is a supported value and that the name is non-empty.

    Args:
        name: The project name. Must be non-empty and unique (enforced by UI).
        task_type: The ML task type, either "classification" or "regression".

    Returns:
        dict: The created project with keys: id, name, task_type, created_at,
            experiment_count (always 0 for new projects).

    Raises:
        ProjectValidationError: If name is empty or task_type is invalid.
        IntegrityError: If database constraints are violated.
    """
    # Validate inputs
    if not name or not name.strip():
        raise ProjectValidationError("Project name cannot be empty")

    if task_type not in ("classification", "regression"):
        raise ProjectValidationError(
            f"Invalid task_type: {task_type}. Must be 'classification' or 'regression'"
        )

    async with async_session() as session:
        project = Project(
            name=name.strip(),
            task_type=task_type,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
        session.add(project)
        await session.commit()
        await session.refresh(project)

        return {
            "id": project.id,
            "name": project.name,
            "task_type": project.task_type,
            "created_at": project.created_at.isoformat(),
            "experiment_count": 0,
        }


async def list_projects() -> list[dict]:
    """List all projects with their experiment counts.

    Returns a list of all projects sorted by last updated time (most recent
    first), including experiment counts for the dashboard view.

    Returns:
        list[dict]: Each project contains: id, name, task_type, updated_at,
            experiment_count.
    """
    async with async_session() as session:
        # Query projects with experiment count using subquery
        subquery = (
            select(
                Experiment.project_id,
                func.count(Experiment.id).label("experiment_count"),
            )
            .group_by(Experiment.project_id)
            .subquery()
        )

        stmt = (
            select(
                Project,
                func.coalesce(subquery.c.experiment_count, 0).label("experiment_count"),
            )
            .outerjoin(subquery, Project.id == subquery.c.project_id)
            .order_by(Project.updated_at.desc())
        )

        result = await session.execute(stmt)
        rows = result.all()

        return [
            {
                "id": row.Project.id,
                "name": row.Project.name,
                "task_type": row.Project.task_type,
                "updated_at": row.Project.updated_at.isoformat(),
                "experiment_count": int(row.experiment_count),
            }
            for row in rows
        ]


async def get_project(project_id: str) -> dict:
    """Get a single project by ID with its experiment count.

    Args:
        project_id: The UUID of the project to retrieve.

    Returns:
        dict: The project with keys: id, name, task_type, created_at,
            updated_at, experiment_count.

    Raises:
        ProjectNotFoundError: If the project does not exist.
    """
    async with async_session() as session:
        # Query project with experiment count
        subquery = (
            select(
                Experiment.project_id,
                func.count(Experiment.id).label("experiment_count"),
            )
            .where(Experiment.project_id == project_id)
            .group_by(Experiment.project_id)
            .subquery()
        )

        stmt = (
            select(
                Project,
                func.coalesce(subquery.c.experiment_count, 0).label("experiment_count"),
            )
            .outerjoin(subquery, Project.id == subquery.c.project_id)
            .where(Project.id == project_id)
        )

        result = await session.execute(stmt)
        row = result.one_or_none()

        if row is None:
            raise ProjectNotFoundError(project_id)

        return {
            "id": row.Project.id,
            "name": row.Project.name,
            "task_type": row.Project.task_type,
            "created_at": row.Project.created_at.isoformat(),
            "updated_at": row.Project.updated_at.isoformat(),
            "experiment_count": int(row.experiment_count),
        }


async def rename_project(project_id: str, name: str) -> dict:
    """Rename an existing project.

    Args:
        project_id: The UUID of the project to rename.
        name: The new project name. Must be non-empty.

    Returns:
        dict: The updated project with keys: id, name, task_type, updated_at.

    Raises:
        ProjectNotFoundError: If the project does not exist.
        ProjectValidationError: If the new name is empty.
    """
    if not name or not name.strip():
        raise ProjectValidationError("Project name cannot be empty")

    async with async_session() as session:
        # Fetch the project
        stmt = select(Project).where(Project.id == project_id)
        result = await session.execute(stmt)
        project = result.scalar_one_or_none()

        if project is None:
            raise ProjectNotFoundError(project_id)

        # Update the name and timestamp
        project.name = name.strip()
        project.updated_at = datetime.utcnow()

        await session.commit()
        await session.refresh(project)

        # Get experiment count
        exp_count_stmt = (
            select(func.count(Experiment.id))
            .where(Experiment.project_id == project_id)
        )
        exp_result = await session.execute(exp_count_stmt)
        experiment_count = exp_result.scalar() or 0

        return {
            "id": project.id,
            "name": project.name,
            "task_type": project.task_type,
            "updated_at": project.updated_at.isoformat(),
            "experiment_count": experiment_count,
        }


async def delete_project(project_id: str) -> dict:
    """Delete a project and all its associated data.

    This is a destructive operation that cascades to all related entities:
    snapshots, pipelines, experiments, runs, evaluations, subgroup analyses,
    and exports. The database cascade configuration handles the deletion.

    Args:
        project_id: The UUID of the project to delete.

    Returns:
        dict: Deletion confirmation with key: deleted (True).

    Raises:
        ProjectNotFoundError: If the project does not exist.
    """
    async with async_session() as session:
        # Verify project exists
        stmt = select(Project).where(Project.id == project_id)
        result = await session.execute(stmt)
        project = result.scalar_one_or_none()

        if project is None:
            raise ProjectNotFoundError(project_id)

        # Delete the project - cascades to all related entities
        await session.delete(project)
        await session.commit()

        return {"deleted": True}


async def get_dashboard_stats() -> dict:
    """Get aggregate statistics for the projects dashboard.

    Computes totals across all projects: experiment count, total exports
    (all artifact types), and dataset snapshots.

    Returns:
        dict: Dashboard statistics with keys:
            - total_experiments: Total number of experiments across all projects.
            - total_exports: Total number of exports (all artifact types).
            - total_snapshots: Total number of dataset snapshots.
    """
    async with async_session() as session:
        # Total experiments
        exp_stmt = select(func.count(Experiment.id))
        exp_result = await session.execute(exp_stmt)
        total_experiments = exp_result.scalar() or 0

        # Total exports (all artifact types)
        exports_stmt = select(func.count(Export.id))
        exports_result = await session.execute(exports_stmt)
        total_exports = exports_result.scalar() or 0

        # Total dataset snapshots
        snapshots_stmt = select(func.count(DatasetSnapshot.id))
        snapshots_result = await session.execute(snapshots_stmt)
        total_snapshots = snapshots_result.scalar() or 0

        return {
            "total_experiments": total_experiments,
            "total_exports": total_exports,
            "total_snapshots": total_snapshots,
        }
