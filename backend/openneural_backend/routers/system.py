"""System information router for OpenNeural backend.

Provides endpoints for retrieving host machine system information including
hostname, RAM, CPU details, and application version.
"""

import os
import platform

import psutil
from fastapi import APIRouter

from openneural_backend import __version__

router = APIRouter(prefix="/system", tags=["system"])


@router.get("/info")
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
