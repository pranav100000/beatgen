"""
Utilities for Server-Sent Events (SSE) implementation.
Provides formatting and helper functions for SSE streams.
"""

from datetime import datetime
import json
import asyncio
from typing import Any, AsyncGenerator, Optional
import uuid
from app2.core.logging import get_api_logger

logger = get_api_logger("sse")


def _json_serializer_default(obj):
    if isinstance(obj, datetime):
        # Format consistent with your Pydantic config
        return obj.isoformat() + "Z"
    if isinstance(obj, uuid.UUID):
        return str(obj)
    # Let the default encoder raise the TypeError for other types
    raise TypeError(f"Object of type {obj.__class__.__name__} is not JSON serializable")


def format_sse_message(
    event: str, data: Any, id: Optional[str] = None, retry: Optional[int] = None
) -> str:
    """
    Format data according to the SSE specification.

    Args:
        event: The event name/type
        data: The data to send (will be JSON serialized)
        id: Optional event ID
        retry: Optional reconnection time in milliseconds

    Returns:
        Formatted SSE message as string
    """
    message = []

    # Add event type if provided
    if event:
        message.append(f"event: {event}")

    # Add event ID if provided
    if id:
        message.append(f"id: {id}")

    # Add retry time if provided
    if retry:
        message.append(f"retry: {retry}")

    # Add data (JSON serialized)
    json_data = json.dumps(data, default=_json_serializer_default, ensure_ascii=False)

    # Split the data by lines and prefix each with "data: "
    for line in json_data.split("\n"):
        message.append(f"data: {line}")

    # End with double newline as per SSE spec
    return "\n".join(message) + "\n\n"


async def heartbeat_generator(interval: int = 15):
    """
    Generate heartbeat messages at regular intervals to keep the connection alive.

    Args:
        interval: Time between heartbeats in seconds

    Yields:
        Heartbeat messages as strings
    """
    while True:
        await asyncio.sleep(interval)
        yield format_sse_message(
            "heartbeat", {"timestamp": asyncio.get_event_loop().time()}
        )


class SSEManager:
    """
    Helper class to manage SSE event generation.
    Provides a clean interface for creating and managing SSE streams.
    """

    def __init__(self, heartbeat_interval: int = 15, retry_timeout: int = 3000):
        """
        Initialize an SSE manager.

        Args:
            heartbeat_interval: Time between heartbeats in seconds
            retry_timeout: Time in ms that clients should wait before reconnecting
        """
        self.heartbeat_interval = heartbeat_interval
        self.retry_timeout = retry_timeout
        self._event_id = 0

    def _get_next_id(self) -> str:
        """Get the next sequential event ID."""
        self._event_id += 1
        return str(self._event_id)

    def format_event(self, event_type: str, data: Any) -> str:
        """Format an SSE event with automatic ID and retry settings."""
        return format_sse_message(
            event=event_type,
            data=data,
            id=self._get_next_id(),
            retry=self.retry_timeout,
        )

    async def event_generator(self, queue: asyncio.Queue) -> AsyncGenerator[str, None]:
        """
        Generate SSE events from a queue with heartbeats.

        Args:
            queue: Async queue that receives events

        Yields:
            Formatted SSE messages
        """

        # Log generator start with queue info
        queue_id = id(queue)
        logger.debug(f"Starting SSE event generator for queue ID: {queue_id}")

        # Send initial connection event
        initial_message = self.format_event("connected", {"status": "connected"})
        logger.debug(f"Sending initial connection event: {initial_message[:50]}...")
        yield initial_message

        try:
            # Process events from the queue with heartbeats
            while True:
                # Always yield control back to the event loop periodically
                # This is critical for proper async behavior
                await asyncio.sleep(0)

                try:
                    # Check queue status
                    queue_size = queue.qsize()
                    logger.debug(f"Queue status - ID: {queue_id}, Size: {queue_size}")

                    if queue_size > 0:
                        # Queue has items, get next event immediately
                        logger.debug("Queue has items, getting next event immediately")
                        event_type, data = await queue.get()

                        # Acknowledge log
                        logger.debug(f"Retrieved event from queue: {event_type}")

                        # If we got a completion event, send it and exit
                        if event_type == "complete":
                            msg = self.format_event(event_type, data)
                            logger.debug(f"Sending completion event: {msg[:50]}...")
                            yield msg
                            logger.debug("Completion event sent, breaking loop")
                            break

                        # Process regular event
                        msg = self.format_event(event_type, data)
                        # logger.debug(f"Sending event ({event_type}): {msg[:50]}...")
                        yield msg
                        # logger.debug(f"Event sent: {event_type}")

                    else:
                        # Wait for the next event with a timeout
                        logger.debug(
                            f"Queue empty, waiting for next event (timeout: {self.heartbeat_interval}s)"
                        )
                        try:
                            event_type, data = await asyncio.wait_for(
                                queue.get(), timeout=self.heartbeat_interval
                            )

                            # logger.debug(f"Received event from queue after waiting: {event_type}")

                            # Process the received event
                            if event_type == "complete":
                                msg = self.format_event(event_type, data)
                                logger.debug(f"Sending completion event: {msg[:50]}...")
                                yield msg
                                logger.debug("Completion event sent, breaking loop")
                                break

                            # Otherwise yield the event and continue
                            # logger.info(f"Sending event ({event_type}): {data}")
                            msg = self.format_event(event_type, data)
                            # logger.debug(f"Sending event ({event_type}): {msg[:50]}...")
                            yield msg
                            # logger.debug(f"Event sent: {event_type}")

                        except asyncio.TimeoutError:
                            # Send a heartbeat on timeout
                            logger.debug("Timeout waiting for event, sending heartbeat")
                            msg = self.format_event(
                                "heartbeat",
                                {"timestamp": asyncio.get_event_loop().time()},
                            )
                            yield msg
                            logger.debug("Heartbeat sent")

                except Exception as e:
                    # Log any errors in event processing
                    logger.error(f"Error processing event: {str(e)}")
                    import traceback

                    logger.error(traceback.format_exc())

                    # Try to send an error event
                    try:
                        error_msg = self.format_event(
                            "error", {"message": f"Error in event processing: {str(e)}"}
                        )
                        yield error_msg
                    except:
                        # If sending the error event fails, just continue
                        pass

        except asyncio.CancelledError:
            # Handle client disconnection
            logger.debug("Connection cancelled")
            msg = self.format_event("cancelled", {"status": "cancelled"})
            yield msg
            logger.debug("Cancellation event sent")
            raise

        except Exception as e:
            # Handle other errors
            import traceback

            logger.error(f"Error in SSE event generator: {str(e)}")
            logger.error(traceback.format_exc())
            msg = self.format_event("error", {"status": "error", "message": str(e)})
            yield msg
            logger.debug("Error event sent")
            raise
