"""System information router for OpenNeural backend.

Provides endpoints for retrieving host machine system information including
hostname, RAM, CPU details, and application version. Also provides endpoints
for system management operations like clearing all data.
"""

import os
import platform
import shutil

import psutil
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import text

from openneural_backend import __version__
from openneural_backend.config import Settings
from openneural_backend.db.engine import async_session

router = APIRouter(prefix="/system", tags=["system"])


@router.get(
    "/info",
    summary="Get host system information",
    description="Returns detailed host machine system information including hostname, total RAM, CPU model, and OpenNeural app version.",
    responses={
        200: {"description": "Successfully retrieved system info."},
        500: {"description": "Internal server error."}
    }
)
async def get_system_info() -> dict:
    """Get host machine system information.

    Returns system details including hostname, total RAM (in GB), CPU model,
    and application version. Uses platform, psutil, and os standard library
    modules as specified in SRS requirements.

    Returns:
        dict: System information with keys:
            - hostname (str): OS-reported host machine name.
            - ram_total_gb (float): Total system RAM in gigabytes.
            - cpu_model (str): CPU model identifier string.
            - app_version (str): OpenNeural application version.

    Raises:
        No exceptions are expected as all calls are safe.
    """
    # Get hostname using os or platform module
    hostname = platform.node() or os.uname().nodename

    # Get total RAM in GB using psutil
    # virtual_memory() returns bytes, convert to GB
    ram_total_bytes = psutil.virtual_memory().total
    ram_total_gb = round(ram_total_bytes / (1024**3), 2)

    # Get CPU model using platform module
    # platform.processor() returns the processor name
    cpu_model = platform.processor()

    # Fallback if processor() returns empty string (common on some systems)
    if not cpu_model:
        # Try to get from uname or use a generic fallback
        try:
            cpu_model = os.uname().machine
        except AttributeError:
            cpu_model = "Unknown CPU"

    return {
        "hostname": hostname,
        "ram_total_gb": ram_total_gb,
        "cpu_model": cpu_model,
        "app_version": __version__,
    }


class ClearDataResponse(BaseModel):
    """Response for clearing all application data.

    Attributes:
        success: Whether the operation was successful.
        message: Human-readable description of what was cleared.
    """

    success: bool
    message: str


@router.delete(
    "/clear-data",
    response_model=ClearDataResponse,
    status_code=status.HTTP_200_OK,
    summary="Clear all application data",
    description="Removes all projects, snapshots, pipelines, experiments, runs, evaluations, subgroup analyses, and exports, while preserving the auth password.",
    responses={
        200: {"description": "All data cleared successfully."},
        500: {"description": "Internal server error during clear operation"},
    },
)
async def clear_all_data() -> ClearDataResponse:
    """Clear all application data (destructive operation).

    Removes all projects, snapshots, pipelines, experiments, runs, evaluations,
    subgroup analyses, and exports. Preserves the auth record (password).

    This is a destructive operation that requires explicit user confirmation
    via the frontend ConfirmDialog per SRS §21 (Destructive Operation Protocol).

    Returns:
        ClearDataResponse: Success status and message about what was cleared.

    Raises:
        HTTPException: 500 if the operation fails.
    """
    settings = Settings.get()

    try:
        # Clear database tables (preserving auth)
        async with async_session() as session:
            # Delete all data except auth table
            # Order matters for foreign key constraints
            await session.execute(text("DELETE FROM subgroup_analyses"))
            await session.execute(text("DELETE FROM evaluations"))
            await session.execute(text("DELETE FROM exports"))
            await session.execute(text("DELETE FROM runs"))
            await session.execute(text("DELETE FROM experiments"))
            await session.execute(text("DELETE FROM pipelines"))
            await session.execute(text("DELETE FROM dataset_snapshots"))
            await session.execute(text("DELETE FROM projects"))
            # Note: auth table is NOT deleted - preserves user password
            await session.commit()

        # Clear file system directories
        directories_to_clear = [
            settings.snapshots_dir,
            settings.pipelines_dir,
            settings.models_dir,
            settings.reports_dir,
            settings.predictions_dir,
        ]

        cleared_items = []

        for directory in directories_to_clear:
            if directory.exists():
                # Count items before deletion for reporting
                item_count = sum(1 for _ in directory.rglob("*") if _.is_file())
                if item_count > 0:
                    cleared_items.append(f"{directory.name}: {item_count} files")
                # Remove all contents but keep the directory
                for item in directory.iterdir():
                    if item.is_dir():
                        shutil.rmtree(item)
                    else:
                        item.unlink()

        # Log the operation (to application log, not database)
        import logging

        logger = logging.getLogger(__name__)
        logger.warning(
            "All application data cleared via /api/v1/system/clear-data endpoint"
        )

        message_parts = ["All data cleared successfully."]
        if cleared_items:
            message_parts.append(f"Cleared: {', '.join(cleared_items)}")

        return ClearDataResponse(
            success=True,
            message=" ".join(message_parts),
        )

    except Exception as e:
        import logging

        logger = logging.getLogger(__name__)
        logger.error(f"Failed to clear data: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to clear data: {str(e)}",
        ) from e
