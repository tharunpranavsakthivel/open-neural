"""Event bus module for OpenNeural backend.

Provides a pub/sub mechanism using asyncio.Queue per experiment for real-time
event streaming between the training orchestrator and SSE handlers.

The event bus enables efficient, push-based status updates without polling:
- Publishers (training orchestrator) emit events to experiment-specific queues
- Subscribers (SSE handlers) consume from queues and emit to connected clients
- Queues are automatically cleaned up when no more subscribers exist

Per Task 119: Implements pub/sub mechanism for real-time experiment updates.
Per TDD §4.3: Enables live updates via event-driven architecture.
"""

import asyncio
import json
import logging
from collections.abc import AsyncGenerator
from typing import Any

logger = logging.getLogger(__name__)

# Global registry of experiment queues: experiment_id -> set of queues
# Each SSE subscriber gets its own queue; multiple clients can subscribe to same experiment
_experiment_queues: dict[str, set[asyncio.Queue[dict[str, Any]]]] = {}

# Lock for thread-safe queue registry operations
_registry_lock = asyncio.Lock()


class EventBusError(Exception):
    """Raised when event bus operations fail."""

    pass


async def subscribe(experiment_id: str) -> asyncio.Queue[dict[str, Any]]:
    """Subscribe to events for a specific experiment.

    Creates a new asyncio.Queue for the subscriber and registers it under
    the experiment ID. Multiple subscribers can exist for the same experiment.

    Args:
        experiment_id: The UUID of the experiment to subscribe to.

    Returns:
        asyncio.Queue: A queue instance for consuming events. Each subscriber
            receives their own queue instance.

    Example:
        >>> queue = await subscribe("550e8400-e29b-41d4-a716-446655440000")
        >>> event = await queue.get()
    """
    queue: asyncio.Queue[dict[str, Any]] = asyncio.Queue()

    async with _registry_lock:
        if experiment_id not in _experiment_queues:
            _experiment_queues[experiment_id] = set()
        _experiment_queues[experiment_id].add(queue)

    logger.debug(
        f"Subscribed to experiment {experiment_id}, total subscribers: {len(_experiment_queues[experiment_id])}"
    )
    return queue


async def unsubscribe(experiment_id: str, queue: asyncio.Queue[dict[str, Any]]) -> None:
    """Unsubscribe from events and clean up the queue.

    Removes the subscriber's queue from the registry. If no subscribers
    remain for the experiment, removes the experiment entry entirely.

    Args:
        experiment_id: The UUID of the experiment to unsubscribe from.
        queue: The queue instance returned by subscribe().

    Note:
        This method is idempotent - calling multiple times has no effect
        after the first successful call.
    """
    async with _registry_lock:
        if experiment_id in _experiment_queues:
            _experiment_queues[experiment_id].discard(queue)

            # If no more subscribers, remove the experiment entirely
            if not _experiment_queues[experiment_id]:
                del _experiment_queues[experiment_id]
                logger.debug(
                    f"Removed experiment {experiment_id} from event bus (no subscribers)"
                )
            else:
                logger.debug(
                    f"Unsubscribed from experiment {experiment_id}, remaining subscribers: {len(_experiment_queues[experiment_id])}"
                )
        else:
            logger.debug(f"Unsubscribe called for unknown experiment {experiment_id}")


async def publish(experiment_id: str, event_type: str, payload: dict[str, Any]) -> None:
    """Publish an event to all subscribers of an experiment.

    Sends the event to all queues registered for the experiment ID.
    Events are silently dropped if there are no subscribers.

    Args:
        experiment_id: The UUID of the experiment to publish to.
        event_type: The type of event (e.g., "status_update", "run_completed").
        payload: The event data payload as a dictionary.

    Note:
        If no subscribers exist for the experiment, the event is silently
        dropped with a debug log message.

    Example:
        >>> await publish(
        ...     "550e8400-e29b-41d4-a716-446655440000",
        ...     "status_update",
        ...     {"status": "running", "progress_pct": 50.0}
        ... )
    """
    event = {
        "type": event_type,
        "payload": payload,
    }

    async with _registry_lock:
        queues = _experiment_queues.get(experiment_id, set()).copy()

    if not queues:
        logger.debug(
            f"No subscribers for experiment {experiment_id}, dropping event: {event_type}"
        )
        return

    # Put event into all subscriber queues
    # Use put_nowait to avoid blocking; if queue is full, event is dropped
    for queue in queues:
        try:
            queue.put_nowait(event)
        except asyncio.QueueFull:
            logger.warning(
                f"Queue full for experiment {experiment_id}, dropping event: {event_type}"
            )

    logger.debug(
        f"Published {event_type} event to {len(queues)} subscribers for experiment {experiment_id}"
    )


async def publish_status_update(
    experiment_id: str,
    status: str,
    progress_pct: float,
    cpu_pct: float,
    ram_used_gb: float,
    ram_total_gb: float,
    runs: list[dict[str, Any]],
) -> None:
    """Publish a status update event.

    Convenience wrapper for publishing experiment status updates with
    the standard payload structure expected by SSE consumers.

    Args:
        experiment_id: The UUID of the experiment.
        status: Current experiment status (created, running, done, etc.).
        progress_pct: Completion percentage (0-100).
        cpu_pct: Current CPU usage percentage.
        ram_used_gb: Used RAM in GB.
        ram_total_gb: Total RAM in GB.
        runs: List of run status dictionaries.
    """
    payload = {
        "status": status,
        "progress_pct": progress_pct,
        "cpu_pct": cpu_pct,
        "ram_used_gb": ram_used_gb,
        "ram_total_gb": ram_total_gb,
        "runs": runs,
    }
    await publish(experiment_id, "status_update", payload)


async def consume(
    experiment_id: str,
    queue: asyncio.Queue[dict[str, Any]],
) -> AsyncGenerator[str, None]:
    """Consume events from a queue and yield SSE-formatted strings.

    Generator that consumes events from the provided queue and yields
    SSE-formatted strings suitable for StreamingResponse. Automatically
    unsubscribes from the event bus when the generator exits.

    Args:
        experiment_id: The UUID of the experiment being consumed.
        queue: The queue instance to consume from.

    Yields:
        str: SSE-formatted event strings with format:
            "data: {json_payload}\n\n"

    Note:
        The generator handles cleanup automatically - it unsubscribes from
        the event bus when the consumer disconnects (generator is closed).

    Example:
        >>> queue = await subscribe(experiment_id)
        >>> async for event in consume(experiment_id, queue):
        ...     yield event
    """
    try:
        while True:
            # Wait for the next event
            event = await queue.get()

            # Format as SSE
            yield f"data: {json.dumps(event)}\n\n"

            # Mark task as done
            queue.task_done()

    except asyncio.CancelledError:
        # Consumer disconnected - clean exit
        logger.debug(f"Event consumer for experiment {experiment_id} cancelled")
        raise

    finally:
        # Always unsubscribe when consumer disconnects
        await unsubscribe(experiment_id, queue)
        logger.debug(f"Event consumer for experiment {experiment_id} cleaned up")


def has_subscribers(experiment_id: str) -> bool:
    """Check if an experiment has active subscribers.

    Args:
        experiment_id: The UUID of the experiment.

    Returns:
        bool: True if there are active subscribers, False otherwise.
    """
    return experiment_id in _experiment_queues and bool(
        _experiment_queues[experiment_id]
    )


def get_subscriber_count(experiment_id: str) -> int:
    """Get the number of active subscribers for an experiment.

    Args:
        experiment_id: The UUID of the experiment.

    Returns:
        int: Number of active subscribers (0 if experiment not found).
    """
    return len(_experiment_queues.get(experiment_id, set()))


async def close_all() -> None:
    """Close all event bus queues and clear the registry.

    Emergency cleanup function for shutdown scenarios. Sends sentinel
    values to all queues to unblock waiting consumers.

    Note:
        This is intended for graceful shutdown - it signals all consumers
        to exit rather than abruptly terminating them.
    """
    async with _registry_lock:
        # Signal all queues to exit
        for experiment_id, queues in _experiment_queues.items():
            for queue in queues:
                try:
                    # Send sentinel value to unblock consumer
                    queue.put_nowait({"type": "shutdown", "payload": {}})
                except asyncio.QueueFull:
                    pass

        # Clear the registry
        _experiment_queues.clear()

    logger.info("Event bus: closed all queues and cleared registry")
