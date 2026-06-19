"""Experiments router for OpenNeural backend.

Provides endpoints for experiment management: create, start, cancel, get status.
"""

from fastapi import APIRouter, HTTPException

router = APIRouter(prefix="/projects/{project_id}/experiments", tags=["experiments"])


@router.post("")
async def create_experiment(project_id: str) -> dict:
    """Create a new experiment.

    Args:
        project_id: The project ID.

    Returns:
        dict: Created experiment details.
    """
    raise HTTPException(status_code=501, detail="Not implemented")


@router.get("")
async def list_experiments(project_id: str) -> list[dict]:
    """List all experiments for a project.

    Args:
        project_id: The project ID.

    Returns:
        list[dict]: List of experiment summaries.
    """
    raise HTTPException(status_code=501, detail="Not implemented")


@router.get("/{experiment_id}")
async def get_experiment(project_id: str, experiment_id: str) -> dict:
    """Get an experiment by ID.

    Args:
        project_id: The project ID.
        experiment_id: The experiment ID.

    Returns:
        dict: Experiment details.
    """
    raise HTTPException(status_code=501, detail="Not implemented")


@router.post("/{experiment_id}/start")
async def start_experiment(project_id: str, experiment_id: str) -> dict:
    """Start an experiment training run.

    Args:
        project_id: The project ID.
        experiment_id: The experiment ID.

    Returns:
        dict: Experiment status.
    """
    raise HTTPException(status_code=501, detail="Not implemented")


@router.get("/{experiment_id}/status")
async def get_experiment_status(project_id: str, experiment_id: str) -> dict:
    """Get real-time experiment status.

    Args:
        project_id: The project ID.
        experiment_id: The experiment ID.

    Returns:
        dict: Experiment status with progress.
    """
    raise HTTPException(status_code=501, detail="Not implemented")


@router.delete("/{experiment_id}/cancel")
async def cancel_experiment(project_id: str, experiment_id: str) -> dict:
    """Cancel a running experiment.

    Args:
        project_id: The project ID.
        experiment_id: The experiment ID.

    Returns:
        dict: Cancellation confirmation.
    """
    raise HTTPException(status_code=501, detail="Not implemented")
