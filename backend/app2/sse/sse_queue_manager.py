"""
SSE Event Manager for handling streaming events in a standardized way.

This module provides a wrapper around asyncio.Queue to simplify the
creation and management of SSE events for streaming responses.
"""

import asyncio
import time
import logging
from typing import Dict, Any, Optional

from app2.types.assistant_actions import AssistantAction

# Set up logger
logger = logging.getLogger("beatgen.sse_queue_manager")


class SSEQueueManager:
    """
    Wrapper around asyncio.Queue that standardizes SSE event formatting
    and simplifies streaming response management.

    This class handles:
    - Standard event formatting for all event types
    - Message ID and request ID tracking
    - Automatic chunk indexing for response streaming
    - State management (started, ended)

    Usage:
        sse_queue = SSEQueueManager(request_id)
        await sse_queue.start_stream()
        await sse_queue.add_chunk("Streaming response text...")
        await sse_queue.action("add_track", {"trackId": "123"})
        await sse_queue.end_stream()
        await sse_queue.complete({"response": "Full response"})
    """

    def __init__(self, request_id: str):
        """
        Initialize an SSE event queue for a specific request.

        Args:
            request_id: Unique ID for this request
        """
        # The underlying asyncio Queue for communication
        self.queue = asyncio.Queue()

        # Request metadata
        self.request_id = request_id
        self.message_id = f"msg-{int(time.time())}"

        # State tracking
        self.chunk_index = 0
        self.is_started = False
        self.is_ended = False

        logger.debug(
            f"Created SSEEventQueue for request {request_id} with message {self.message_id}"
        )

    async def start_stream(self, additional_data: Optional[Dict[str, Any]] = None):
        """
        Start the response stream by sending a response_start event.

        Args:
            additional_data: Optional additional data to include in the event
        """
        if self.is_started:
            logger.warning(f"Stream already started for message {self.message_id}")
            return

        data = {"message_id": self.message_id, "request_id": self.request_id}

        if additional_data:
            data.update(additional_data)

        await self.queue.put(("response_start", data))
        self.is_started = True
        logger.debug(f"Started stream for message {self.message_id}")

    async def stage(self, name: str, description: str):
        """
        Send a stage update event.

        Args:
            name: Stage name (e.g., "processing", "generating")
            description: Human-readable description of the stage
        """
        await self.queue.put(("stage", {"name": name, "description": description}))
        logger.debug(f"Sent stage event: {name}")

    async def status(self, message: str, details: Optional[str] = None):
        """
        Send a status update event.

        Args:
            message: Status message
            details: Optional additional details
        """
        data = {"message": message}
        if details:
            data["details"] = details

        await self.queue.put(("status", data))
        logger.debug(f"Sent status event: {message}")

    async def add_chunk(self, text: str):
        """
        Add a text chunk to the response stream.

        Will automatically start the stream if not already started.

        Args:
            text: Text chunk to send
        """
        if not self.is_started:
            logger.debug("Auto-starting stream for add_chunk")
            await self.start_stream()

        if self.is_ended:
            logger.warning(
                f"Attempting to add chunk after stream ended: {text[:30]}..."
            )
            return

        await self.queue.put(
            (
                "response_chunk",
                {
                    "message_id": self.message_id,
                    "chunk": text,
                    "chunk_index": self.chunk_index,
                },
            )
        )

        self.chunk_index += 1
        logger.debug(f"Sent chunk #{self.chunk_index}: {text[:20]}...")

    async def end_stream(self):
        """
        End the text stream by sending a response_end event.
        """
        if self.is_ended:
            logger.warning(f"Stream already ended for message {self.message_id}")
            return

        if not self.is_started:
            logger.warning(
                f"Ending stream that was never started for message {self.message_id}"
            )
            await self.start_stream()

        await self.queue.put(
            ("response_end", {"message_id": self.message_id, "is_complete": True})
        )

        self.is_ended = True
        logger.debug(
            f"Ended stream for message {self.message_id} after {self.chunk_index} chunks"
        )

    async def action(self, action: AssistantAction):
        """
        Send an action event.

        Args:
            action: An AssistantAction instance that defines the action type and its associated data
        """
        await self.queue.put(
            ("action", {"type": action.action_type, "data": action.data.model_dump()})
        )
        logger.info(f"Sent action event: {action}")

    async def complete(self, data: Dict[str, Any]):
        """
        Send the complete response, signaling the end of processing.

        Args:
            data: Complete response data
        """
        await self.queue.put(("complete", data))
        logger.info(f"Sent complete event for request {self.request_id}")

    async def error(self, message: str, error_data: Optional[Dict[str, Any]] = None):
        """
        Send an error event.

        Args:
            message: Error message
            error_data: Optional additional error details
        """
        data = {"message": message}
        if error_data:
            data.update(error_data)

        await self.queue.put(("error", data))
        logger.error(f"Sent error event: {message}")

    async def cancelled(self):
        """
        Send a cancelled event.
        """
        await self.queue.put(("cancelled", {"message": "Request cancelled"}))
        logger.info(f"Sent cancelled event for request {self.request_id}")

    async def heartbeat(self):
        """
        Send a heartbeat event to keep the connection alive.
        """
        await self.queue.put(("heartbeat", {"timestamp": time.time()}))
        logger.debug(f"Sent heartbeat for request {self.request_id}")

    def get_queue(self) -> asyncio.Queue:
        """
        Get the underlying asyncio Queue for use with SSE manager.

        Returns:
            The asyncio.Queue instance
        """
        return self.queue

    def get_message_id(self) -> str:
        """Get the current message ID"""
        return self.message_id

    def get_request_id(self) -> str:
        """Get the request ID"""
        return self.request_id

    def get_chunk_count(self) -> int:
        """Get the number of chunks sent so far"""
        return self.chunk_index
