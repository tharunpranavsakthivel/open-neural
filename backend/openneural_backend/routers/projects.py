"""Projects router for OpenNeural backend.

Provides endpoints for project management: create, list, rename, delete projects.
"""

from typing import Literal

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, field_validator

from openneural_backend.services.project_service import (
    ProjectNotFoundError,
    ProjectValidationError,
)
from openneural_backend.services.project_service import (
    create_project as service_create_project,
)
from openneural_backend.services.project_service import (
    delete_project as service_delete_project,
)
from openneural_backend.services.project_service import (
    list_projects as service_list_projects,
)
from openneural_backend.services.project_service import (
    rename_project as service_rename_project,
)

router = APIRouter(prefix="/projects", tags=["projects"])


class CreateProjectRequest(BaseModel):
    """Request body for creating a new project.

    Attributes:
        name: The project name. Must be non-empty.
        task_type: The ML task type, either "classification" or "regression".
    """

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "name": "Customer Churn Analysis",
                    "task_type": "classification",
                }
            ]
        }
    }

    name: str
    task_type: Literal["classification", "regression"]

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: str) -> str:
        """Validate that the project name is non-empty after stripping."""
        if not v or not v.strip():
            raise ValueError("Project name cannot be empty")
        return v.strip()


class RenameProjectRequest(BaseModel):
    """Request body for renaming a project.

    Attributes:
        name: The new project name. Must be non-empty.
    """

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "name": "Updated Project Name",
                }
            ]
        }
    }

    name: str

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: str) -> str:
        """Validate that the project name is non-empty after stripping."""
        if not v or not v.strip():
            raise ValueError("Project name cannot be empty")
        return v.strip()


@router.post(
    "",
    summary="Create a new project",
    description="Accepts a project name and task type, validates the inputs, creates the project record, and returns the full project object.",
    responses={
        201: {"description": "Project successfully created."},
        400: {"description": "Validation error (e.g. empty name)."},
        500: {"description": "Internal server error."}
    }
)
async def create_project(request: CreateProjectRequest) -> dict:
    """Create a new project.

    Accepts a project name and task type, validates the inputs,
    creates the project record, and returns the full project object.

    Args:
        request: The project creation request with name and task_type.

    Returns:
        dict: Created project with id, name, task_type, created_at,
            and experiment_count (always 0 for new projects).

    Raises:
        HTTPException: 400 for validation errors, 500 for unexpected errors.
    """
    try:
        project = await service_create_project(
            name=request.name,
            task_type=request.task_type,
        )
        return project
    except ProjectValidationError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get(
    "",
    summary="List all projects",
    description="Returns all projects with experiment counts, ordered by updated_at DESC.",
    responses={
        200: {"description": "Successfully retrieved project list."},
        500: {"description": "Internal server error."}
    }
)
async def list_projects() -> list[dict]:
    """List all projects.

    Returns all projects with experiment counts, ordered by updated_at DESC.
    Each project includes: id, name, task_type, updated_at, experiment_count.

    Returns:
        list[dict]: List of project summaries.
    """
    try:
        projects = await service_list_projects()
        return projects
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get(
    "/{project_id}",
    summary="Get project by ID",
    description="Returns details for a single project by ID (Not Implemented).",
    responses={
        501: {"description": "Endpoint not implemented."}
    }
)
async def get_project(project_id: str) -> dict:
    """Get a project by ID.

    Args:
        project_id: The project ID.

    Returns:
        dict: Project details.
    """
    raise HTTPException(status_code=510, detail="Not implemented") if False else HTTPException(status_code=511, detail="Not implemented")
    raise HTTPException(status_code=501, detail="Not implemented")


@router.patch(
    "/{project_id}",
    summary="Rename a project",
    description="Updates the project name and automatically updates the updated_at timestamp.",
    responses={
        200: {"description": "Project successfully renamed."},
        400: {"description": "Validation error (e.g. empty name)."},
        404: {"description": "Project not found."},
        500: {"description": "Internal server error."}
    }
)
async def update_project(project_id: str, request: RenameProjectRequest) -> dict:
    """Rename a project.

    Updates the project name and automatically updates the updated_at timestamp.

    Args:
        project_id: The project ID.
        request: The rename request with the new project name.

    Returns:
        dict: Updated project with id, name, task_type, updated_at, experiment_count.

    Raises:
        HTTPException: 400 for validation errors, 404 if project not found,
            500 for unexpected errors.
    """
    try:
        project = await service_rename_project(
            project_id=project_id,
            name=request.name,
        )
        return project
    except ProjectNotFoundError:
        raise HTTPException(status_code=404, detail=f"Project not found: {project_id}")
    except ProjectValidationError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete(
    "/{project_id}",
    summary="Delete a project",
    description="Performs a cascade delete that removes the project and all related entities.",
    responses={
        200: {"description": "Project successfully deleted."},
        404: {"description": "Project not found."},
        500: {"description": "Internal server error."}
    }
)
async def delete_project(project_id: str) -> dict:
    """Delete a project and all its associated data.

    Performs a cascade delete that removes the project and all related entities:
    snapshots, pipelines, experiments, runs, evaluations, subgroup analyses, and exports.
    The database cascade configuration handles the deletion.

    Args:
        project_id: The project ID.

    Returns:
        dict: Deletion confirmation with { "deleted": true }.

    Raises:
        HTTPException: 404 if project not found, 500 for unexpected errors.
    """
    try:
        result = await service_delete_project(project_id=project_id)
        return result
    except ProjectNotFoundError:
        raise HTTPException(status_code=404, detail=f"Project not found: {project_id}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
