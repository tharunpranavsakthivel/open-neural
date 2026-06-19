"""Stream router for OpenNeural backend.

Provides Server-Sent Events endpoints for real-time updates.
"""

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

router = APIRouter(prefix="/experiments/{experiment_id}/stream", tags=["stream"])


@router.get("")
async def stream_experiment_updates(experiment_id: str) -> StreamingResponse:
    """Stream real-time experiment updates via Server-Sent Events.

    Args:
        experiment_id: The experiment ID.

    Returns:
        StreamingResponse: SSE stream of experiment updates.
    """
    raise HTTPException(status_code=501, detail="Not implemented")
