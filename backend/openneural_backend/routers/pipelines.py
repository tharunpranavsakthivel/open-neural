"""Pipelines router for OpenNeural backend.

Provides endpoints for preprocessing pipeline management: create, validate, list.
"""

from fastapi import APIRouter, HTTPException

router = APIRouter(prefix="/projects/{project_id}/pipelines", tags=["pipelines"])


@router.post("")
async def create_pipeline(project_id: str) -> dict:
    """Create a new preprocessing pipeline.

    Args:
        project_id: The project ID.

    Returns:
        dict: Created pipeline details.
    """
    raise HTTPException(status_code=501, detail="Not implemented")


@router.get("")
async def list_pipelines(project_id: str) -> list[dict]:
    """List all pipelines for a project.

    Args:
        project_id: The project ID.

    Returns:
        list[dict]: List of pipeline summaries.
    """
    raise HTTPException(status_code=501, detail="Not implemented")


@router.get("/{pipeline_id}")
async def get_pipeline(project_id: str, pipeline_id: str) -> dict:
    """Get a pipeline by ID.

    Args:
        project_id: The project ID.
        pipeline_id: The pipeline ID.

    Returns:
        dict: Pipeline configuration.
    """
    raise HTTPException(status_code=501, detail="Not implemented")


@router.get("/{pipeline_id}/validate")
async def validate_pipeline(project_id: str, pipeline_id: str) -> dict:
    """Validate a pipeline configuration.

    Args:
        project_id: The project ID.
        pipeline_id: The pipeline ID.

    Returns:
        dict: Validation result with any warnings or errors.
    """
    raise HTTPException(status_code=501, detail="Not implemented")
