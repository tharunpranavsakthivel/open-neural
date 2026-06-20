"""Stream router for OpenNeural backend.

Provides Server-Sent Events endpoints for real-time updates during experiment
execution. Streams status updates, CPU/RAM metrics, and run progress to connected
clients until the experiment reaches a terminal state.

Per TDD §2.4: The SSE stream emits status updates for live progress without polling.
Per SRS FR-TRAIN-05: Displays real-time CPU and RAM usage during training.
Per SRS FR-TRAIN-04: Displays per-model status in a live table.
"""

import asyncio
import json
from collections.abc import AsyncGenerator

import psutil
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from openneural_backend.db.engine import get_async_session
from openneural_backend.db.models import Experiment, Project, Run

router = APIRouter(prefix="/experiments/{experiment_id}/stream", tags=["stream"])

# Interval between SSE updates (in seconds)
SSE_UPDATE_INTERVAL = 1.0

# Terminal states that cause the stream to close
TERMINAL_STATES = {"done", "cancelled", "interrupted"}


async def _get_experiment_status(
    experiment_id: str,
    session: AsyncSession,
) -> dict:
    """Fetch current experiment status with runs and system metrics.

    Retrieves the experiment record, all associated runs, and current
    system resource usage (CPU, RAM) to construct a complete status object.

    Args:
        experiment_id: The UUID of the experiment to query.
        session: Database session for queries.

    Returns:
        dict: Status object containing:
            - status: Experiment status string.
            - progress_pct: Completion percentage (0-100).
            - cpu_pct: Current CPU usage percentage.
            - ram_used_gb: Used RAM in GB.
            - ram_total_gb: Total RAM in GB.
            - runs: List of run info dicts with model_type, status, and metrics.

    Raises:
        ExperimentNotFoundError: If the experiment does not exist.
    """
    # Get experiment
    exp_result = await session.execute(
        select(Experiment).where(Experiment.id == experiment_id)
    )
    experiment = exp_result.scalar_one_or_none()

    if experiment is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Experiment '{experiment_id}' not found",
        )

    # Get all runs for this experiment
    runs_result = await session.execute(
        select(Run).where(Run.experiment_id == experiment_id)
    )
    runs = runs_result.scalars().all()

    # Calculate progress percentage: done_runs / total_runs * 100
    total_runs = len(runs)
    done_runs = sum(1 for run in runs if run.status == "done")
    progress_pct = (done_runs / total_runs * 100) if total_runs > 0 else 0.0

    # Get system resource usage via psutil
    # Per SRS FR-TRAIN-05: Display real-time CPU and RAM usage
    cpu_pct = psutil.cpu_percent(interval=0.1)
    memory = psutil.virtual_memory()
    ram_used_gb = memory.used / (1024 ** 3)
    ram_total_gb = memory.total / (1024 ** 3)

    # Build runs list with model_type, status, and metrics
    runs_list = []
    for run in runs:
        run_info = {
            "model_type": run.model_type,
            "status": run.status,
            "metrics": None,
        }

        # Parse test metrics if available
        if run.test_metrics_json:
            try:
                run_info["metrics"] = json.loads(run.test_metrics_json)
            except json.JSONDecodeError:
                run_info["metrics"] = None

        runs_list.append(run_info)

    return {
        "status": experiment.status,
        "progress_pct": round(progress_pct, 1),
        "cpu_pct": round(cpu_pct, 1),
        "ram_used_gb": round(ram_used_gb, 2),
        "ram_total_gb": round(ram_total_gb, 2),
        "runs": runs_list,
    }


async def _generate_sse_events(
    experiment_id: str,
    session: AsyncSession,
) -> AsyncGenerator[str, None]:
    """Generate SSE events for experiment status updates.

    Polls the database at regular intervals to fetch the current experiment
    status, CPU/RAM metrics, and run progress. Yields SSE-formatted events
    with JSON payload. The generator exits when the experiment reaches a
    terminal state (done, cancelled, interrupted).

    Per TDD §2.4: Emits SSE events so the frontend receives live updates
    without polling via HTTP.

    Args:
        experiment_id: The UUID of the experiment to stream updates for.
        session: Database session for queries.

    Yields:
        str: SSE-formatted event strings with format:
            "data: {json_payload}\n\n"

    Note:
        The stream closes automatically when the experiment status becomes
        one of: done, cancelled, interrupted.
    """
    while True:
        # Fetch current experiment status
        status_data = await _get_experiment_status(experiment_id, session)

        # Construct SSE event with type and payload
        event_payload = {
            "type": "status_update",
            "payload": status_data,
        }

        # Yield SSE-formatted event
        # Format: "data: {json}\n\n" per SSE specification
        yield f"data: {json.dumps(event_payload)}\n\n"

        # Check if experiment has reached a terminal state
        if status_data["status"] in TERMINAL_STATES:
            # Stream complete - close connection
            break

        # Wait before next update
        await asyncio.sleep(SSE_UPDATE_INTERVAL)


@router.get("", response_class=StreamingResponse)
async def stream_experiment_updates(
    experiment_id: str,
    session: AsyncSession = Depends(get_async_session),
) -> StreamingResponse:
    """Stream real-time experiment updates via Server-Sent Events.

    Opens a persistent SSE connection that streams status updates for the
    specified experiment. Each event contains the current experiment status,
    progress percentage, CPU/RAM usage metrics, and per-run status details.

    The stream automatically closes when the experiment reaches a terminal
    state (done, cancelled, or interrupted).

    Per TDD §4.3: Training orchestrator emits SSE stream so the frontend
    receives live updates without polling.
    Per SRS FR-TRAIN-03 through FR-TRAIN-05: Real-time progress and metrics.

    Args:
        experiment_id: The UUID of the experiment to stream updates for.
        session: Database session for queries.

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

    # If experiment is already in a terminal state, return a single event
    if experiment.status in TERMINAL_STATES:
        status_data = await _get_experiment_status(experiment_id, session)
        event_payload = {
            "type": "status_update",
            "payload": status_data,
        }

        async def single_event_generator() -> AsyncGenerator[str, None]:
            yield f"data: {json.dumps(event_payload)}\n\n"

        return StreamingResponse(
            single_event_generator(),
            media_type="text/event-stream",
        )

    # Create the SSE stream generator
    event_generator = _generate_sse_events(experiment_id, session)

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
