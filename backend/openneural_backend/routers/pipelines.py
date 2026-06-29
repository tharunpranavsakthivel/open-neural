"""Pipelines router for OpenNeural backend.

Provides endpoints for preprocessing pipeline management: create, list, get, validate.
"""

import json
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from openneural_backend.db.engine import get_async_session
from openneural_backend.db.models import DatasetSnapshot, Pipeline, Project
from openneural_backend.pipeline.validator import validate_pipeline

router = APIRouter(prefix="/projects/{project_id}/pipelines", tags=["pipelines"])


class PipelineBlockConfig(BaseModel):
    """Configuration for a single pipeline block."""

    type: str = Field(..., description="Block type identifier")
    params: dict[str, Any] = Field(default_factory=dict, description="Block parameters")


class PipelineConfig(BaseModel):
    """Pipeline configuration containing ordered blocks."""

    snapshot_id: str = Field(..., description="ID of the dataset snapshot to use")
    blocks: list[PipelineBlockConfig] = Field(
        ..., description="Ordered list of pipeline blocks"
    )

    @field_validator("blocks")
    @classmethod
    def validate_blocks_not_empty(
        cls, v: list[PipelineBlockConfig]
    ) -> list[PipelineBlockConfig]:
        """Validate that blocks list is not empty."""
        if not v:
            raise ValueError("Pipeline must contain at least one block")
        return v


class PipelineCreateRequest(BaseModel):
    """Request model for creating a new pipeline."""

    snapshot_id: str = Field(..., description="ID of the dataset snapshot to use")
    config: PipelineConfig = Field(..., description="Pipeline configuration")
    name: str | None = Field(None, description="Optional pipeline name")


class PipelineResponse(BaseModel):
    """Response model for pipeline operations."""

    id: str
    project_id: str
    snapshot_id: str
    name: str | None
    config_json: dict[str, Any]
    validated: bool
    created_at: str


class ValidationResult(BaseModel):
    """Pipeline validation result."""

    valid: bool
    warnings: list[str]
    errors: list[str]


@router.post(
    "",
    response_model=PipelineResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new preprocessing pipeline",
    description="Accepts pipeline configuration JSON, validates the referenced snapshot exists, runs pipeline validation, and stores the pipeline with a validated flag.",
    responses={
        201: {"description": "Pipeline successfully created and validated."},
        400: {"description": "Validation error or invalid config."},
        404: {"description": "Project or snapshot not found."},
        500: {"description": "Internal server error."}
    }
)
async def create_pipeline(
    project_id: str,
    request: PipelineCreateRequest,
    session: AsyncSession = Depends(get_async_session),
) -> PipelineResponse:
    """Create a new preprocessing pipeline.

    Accepts pipeline configuration JSON, validates the referenced snapshot exists,
    runs pipeline validation against the snapshot schema, and stores the pipeline
    with a validated flag.

    Args:
        project_id: The project ID.
        request: Pipeline creation request containing snapshot_id and config.
        session: Database session.

    Returns:
        PipelineResponse: Created pipeline record with validated flag.

    Raises:
        HTTPException 404: If project or snapshot not found.
        HTTPException 400: If validation fails with errors.
        HTTPException 422: If request data is invalid.
    """
    # Validate project exists
    project_result = await session.execute(
        select(Project).where(Project.id == project_id)
    )
    project = project_result.scalar_one_or_none()
    if project is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project '{project_id}' not found",
        )

    # Validate snapshot exists and belongs to this project
    snapshot_result = await session.execute(
        select(DatasetSnapshot).where(
            DatasetSnapshot.id == request.snapshot_id,
            DatasetSnapshot.project_id == project_id,
        )
    )
    snapshot = snapshot_result.scalar_one_or_none()
    if snapshot is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Snapshot '{request.snapshot_id}' not found in project '{project_id}'",
        )

    # Parse schema JSON to get column names
    try:
        schema = json.loads(snapshot.schema_json)
        schema_columns = [col["name"] for col in schema if isinstance(col, dict)]
    except (json.JSONDecodeError, KeyError, TypeError):
        schema_columns = []

    # Build pipeline config dict for validation
    config_dict = {
        "snapshot_id": request.snapshot_id,
        "blocks": [
            {"type": block.type, "params": block.params}
            for block in request.config.blocks
        ],
    }

    # Run pipeline validation
    validation_result = validate_pipeline(
        blocks=config_dict["blocks"],
        schema_columns=schema_columns if schema_columns else None,
    )

    # Serialize config to JSON string for storage
    config_json_str = json.dumps(config_dict)

    # Create pipeline record
    pipeline = Pipeline(
        project_id=project_id,
        snapshot_id=request.snapshot_id,
        name=request.name,
        config_json=config_json_str,
        validated=1 if validation_result["valid"] else 0,
    )

    session.add(pipeline)
    await session.commit()
    await session.refresh(pipeline)

    return PipelineResponse(
        id=pipeline.id,
        project_id=pipeline.project_id,
        snapshot_id=pipeline.snapshot_id,
        name=pipeline.name,
        config_json=config_dict,
        validated=bool(pipeline.validated),
        created_at=pipeline.created_at.isoformat(),
    )


@router.get(
    "",
    response_model=list[PipelineResponse],
    summary="List all pipelines for a project",
    description="Returns all preprocessing pipelines created for the specified project.",
    responses={
        200: {"description": "Successfully retrieved pipelines list."},
        404: {"description": "Project not found."},
        500: {"description": "Internal server error."}
    }
)
async def list_pipelines(
    project_id: str,
    session: AsyncSession = Depends(get_async_session),
) -> list[PipelineResponse]:
    """List all pipelines for a project.

    Args:
        project_id: The project ID.
        session: Database session.

    Returns:
        List[PipelineResponse]: List of pipeline records.

    Raises:
        HTTPException 404: If project not found.
    """
    # Validate project exists
    project_result = await session.execute(
        select(Project).where(Project.id == project_id)
    )
    project = project_result.scalar_one_or_none()
    if project is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project '{project_id}' not found",
        )

    # Query pipelines
    result = await session.execute(
        select(Pipeline).where(Pipeline.project_id == project_id)
    )
    pipelines = result.scalars().all()

    response_list = []
    for pipeline in pipelines:
        try:
            config_dict = json.loads(pipeline.config_json)
        except json.JSONDecodeError:
            config_dict = {}

        response_list.append(
            PipelineResponse(
                id=pipeline.id,
                project_id=pipeline.project_id,
                snapshot_id=pipeline.snapshot_id,
                name=pipeline.name,
                config_json=config_dict,
                validated=bool(pipeline.validated),
                created_at=pipeline.created_at.isoformat(),
            )
        )

    return response_list


@router.get(
    "/{pipeline_id}",
    response_model=PipelineResponse,
    summary="Get pipeline by ID",
    description="Retrieves details for a specific preprocessing pipeline within a project.",
    responses={
        200: {"description": "Successfully retrieved pipeline details."},
        404: {"description": "Project or pipeline not found."},
        500: {"description": "Internal server error."}
    }
)
async def get_pipeline(
    project_id: str,
    pipeline_id: str,
    session: AsyncSession = Depends(get_async_session),
) -> PipelineResponse:
    """Get a pipeline by ID.

    Args:
        project_id: The project ID.
        pipeline_id: The pipeline ID.
        session: Database session.

    Returns:
        PipelineResponse: Pipeline configuration.

    Raises:
        HTTPException 404: If project or pipeline not found.
    """
    # Validate project exists
    project_result = await session.execute(
        select(Project).where(Project.id == project_id)
    )
    project = project_result.scalar_one_or_none()
    if project is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project '{project_id}' not found",
        )

    # Query pipeline
    result = await session.execute(
        select(Pipeline).where(
            Pipeline.id == pipeline_id,
            Pipeline.project_id == project_id,
        )
    )
    pipeline = result.scalar_one_or_none()
    if pipeline is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Pipeline '{pipeline_id}' not found in project '{project_id}'",
        )

    try:
        config_dict = json.loads(pipeline.config_json)
    except json.JSONDecodeError:
        config_dict = {}

    return PipelineResponse(
        id=pipeline.id,
        project_id=pipeline.project_id,
        snapshot_id=pipeline.snapshot_id,
        name=pipeline.name,
        config_json=config_dict,
        validated=bool(pipeline.validated),
        created_at=pipeline.created_at.isoformat(),
    )


@router.get(
    "/{pipeline_id}/validate",
    response_model=ValidationResult,
    summary="Validate pipeline config",
    description="Validates a stored preprocessing pipeline config against its dataset snapshot schema, returning lists of warnings and errors.",
    responses={
        200: {"description": "Successfully validated pipeline config."},
        404: {"description": "Project, pipeline, or snapshot not found."},
        500: {"description": "Internal server error."}
    }
)
async def validate_pipeline_endpoint(
    project_id: str,
    pipeline_id: str,
    session: AsyncSession = Depends(get_async_session),
) -> ValidationResult:
    """Validate a pipeline configuration against its snapshot schema.

    Re-runs validation against the stored pipeline configuration and current
    snapshot schema.

    Args:
        project_id: The project ID.
        pipeline_id: The pipeline ID.
        session: Database session.

    Returns:
        ValidationResult: Validation result with warnings and errors.

    Raises:
        HTTPException 404: If project, pipeline, or snapshot not found.
    """
    # Validate project exists
    project_result = await session.execute(
        select(Project).where(Project.id == project_id)
    )
    project = project_result.scalar_one_or_none()
    if project is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project '{project_id}' not found",
        )

    # Query pipeline
    pipeline_result = await session.execute(
        select(Pipeline).where(
            Pipeline.id == pipeline_id,
            Pipeline.project_id == project_id,
        )
    )
    pipeline = pipeline_result.scalar_one_or_none()
    if pipeline is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Pipeline '{pipeline_id}' not found in project '{project_id}'",
        )

    # Get snapshot schema
    snapshot_result = await session.execute(
        select(DatasetSnapshot).where(
            DatasetSnapshot.id == pipeline.snapshot_id,
        )
    )
    snapshot = snapshot_result.scalar_one_or_none()
    if snapshot is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Snapshot '{pipeline.snapshot_id}' not found",
        )

    # Parse pipeline config
    try:
        config_dict = json.loads(pipeline.config_json)
        blocks = config_dict.get("blocks", [])
    except (json.JSONDecodeError, AttributeError):
        return ValidationResult(
            valid=False,
            warnings=[],
            errors=["Invalid pipeline configuration JSON"],
        )

    # Parse schema
    try:
        schema = json.loads(snapshot.schema_json)
        schema_columns = [col["name"] for col in schema if isinstance(col, dict)]
    except (json.JSONDecodeError, KeyError, TypeError):
        schema_columns = []

    # Run validation
    validation_result = validate_pipeline(
        blocks=blocks,
        schema_columns=schema_columns if schema_columns else None,
    )

    return ValidationResult(
        valid=validation_result["valid"],
        warnings=validation_result["warnings"],
        errors=validation_result["errors"],
    )
