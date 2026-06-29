"""Stream router for OpenNeural backend.

Provides Server-Sent Events endpoints for real-time updates during experiment
execution using an event-driven pub/sub architecture.

The SSE handler consumes events from the event bus (asyncio.Queue per experiment)
instead of polling the database. This enables efficient, push-based updates with
instant delivery when training events occur.

Per Task 119: Uses pub/sub mechanism with asyncio.Queue per experiment.
Per TDD §2.4: Emits SSE events for live progress without polling.
Per SRS FR-TRAIN-05: Displays real-time CPU and RAM usage during training.
Per SRS FR-TRAIN-04: Displays per-model status in a live table.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from openneural_backend.db.engine import get_async_session
from openneural_backend.db.models import Experiment
from openneural_backend.orchestrator.event_bus import (
    consume,
    subscribe,
)

router = APIRouter(prefix="/experiments/{experiment_id}/stream", tags=["stream"])

# Terminal states that cause the stream to close
TERMINAL_STATES = {"done", "cancelled", "interrupted"}


@router.get("", response_class=StreamingResponse)
async def stream_experiment_updates(
    experiment_id: str,
    session: AsyncSession = Depends(get_async_session),
) -> StreamingResponse:
    """Stream real-time experiment updates via Server-Sent Events.

    Opens a persistent SSE connection that streams status updates for the
    specified experiment using an event-driven pub/sub mechanism. Each
    subscriber gets their own asyncio.Queue; events are published by the
    training orchestrator and consumed by this handler.

    The stream automatically closes when the experiment reaches a terminal
    state (done, cancelled, or interrupted).

    Per Task 119: Uses event bus with asyncio.Queue per experiment.
    Per TDD §4.3: Training orchestrator publishes events to the queue;
    SSE handler consumes and emits them.
    Per SRS FR-TRAIN-03 through FR-TRAIN-05: Real-time progress and metrics.

    Args:
        experiment_id: The UUID of the experiment to stream updates for.
        session: Database session for initial experiment validation.

    Returns:
        StreamingResponse: SSE stream with media_type="text/event-stream".
            Each line is an SSE event with data field containing JSON payload
            in the format: { "type": "status_update", "payload": <status_object> }

    Raises:
        HTTPException 404: If the experiment does not exist.

    Example:
        Event format:
        ```
        data: {"type": "status_update", "payload": {"status": "running", ...}}

        ```

    Note:
        When the client disconnects, the queue is automatically unsubscribed
        and cleaned up by the consume() generator.
    """
    # Validate experiment exists before starting stream
    exp_result = await session.execute(
        select(Experiment).where(Experiment.id == experiment_id)
    )
    experiment = exp_result.scalar_one_or_none()

    if experiment is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Experiment '{experiment_id}' not found",
        )

    # Subscribe to the event bus for this experiment
    # Creates a new queue specifically for this subscriber
    queue = await subscribe(experiment_id)

    # Create the SSE event generator using the event bus
    # The consume() generator yields SSE-formatted events from the queue
    # and automatically unsubscribes when the client disconnects
    event_generator = consume(experiment_id, queue)

    # Return StreamingResponse with SSE media type
    # Per SRS: SSE events with media_type="text/event-stream"
    return StreamingResponse(
        event_generator,
        media_type="text/event-stream",
        headers={
            # Ensure connection stays open for streaming
            "Cache-Control": "no-cache",
            # Explicitly mark as SSE
            "X-Accel-Buffering": "no",
        },
    )
