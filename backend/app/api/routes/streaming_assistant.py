"""
Server-Sent Events (SSE) implementation for the AI assistant.
Provides streaming endpoints for real-time updates during AI processing.
"""
from fastapi import APIRouter, Depends, BackgroundTasks, HTTPException, Request, status
from fastapi.responses import StreamingResponse
from typing import Dict, Any, AsyncGenerator, Tuple, Optional, Union, Literal
import logging
import json
import asyncio
import os
import traceback
import time
from datetime import datetime

from app.core.security import get_current_user
from app.schemas.user import UserProfile
from app.schemas.assistant import (
    AssistantRequest, AssistantResponse, 
    GenerateRequest, GenerateResponse,
    EditRequest, EditResponse,
    AssistantAction, TrackData
)
from app.schemas.project import Project, Track
from app.core.tools import get_all_tools
from app.core.project_serializer import serialize_track, serialize_project, find_track_by_description
from services.music_gen_service.midi import get_clean_track_data
from services.music_gen_service.music_tools import music_tools_service
from app.utils.sse import SSEManager
from clients.anthropic_client import AnthropicClient

# Set up logger for this module
logger = logging.getLogger("beatgen.streaming")
logger.setLevel(logging.DEBUG)

# Initialize the SSE manager
sse_manager = SSEManager(heartbeat_interval=20)

# Create the router
router = APIRouter(prefix="/streaming")

# SSE response headers
SSE_HEADERS = {
    "Cache-Control": "no-cache",
    "Connection": "keep-alive",
    "Content-Type": "text/event-stream",
    "X-Accel-Buffering": "no"  # Prevents buffering by reverse proxies
}

# Simple test endpoint that doesn't require authentication
@router.get("/ping")
async def sse_ping(background_tasks: BackgroundTasks):
    """Simple ping endpoint that returns SSE events without authentication."""
    logger.info("SSE ping endpoint called")
    queue = asyncio.Queue()
    background_tasks.add_task(simple_ping_stream, queue=queue)
    return StreamingResponse(
        sse_manager.event_generator(queue),
        media_type="text/event-stream",
        headers=SSE_HEADERS
    )

async def simple_ping_stream(queue: asyncio.Queue):
    """Simple background task that sends test events."""
    try:
        logger.debug("Starting simple ping stream")
        await queue.put(("ping", {"message": "Ping received"}))
        await asyncio.sleep(1)
        await queue.put(("pong", {"message": "Sending pong"}))
        await asyncio.sleep(1)
        await queue.put(("complete", {"message": "Ping-pong complete"}))
    except Exception as e:
        logger.error(f"Error in ping stream: {str(e)}")
        await queue.put(("error", {"message": str(e)}))

@router.post("/assistant")
async def streaming_assistant(
    request: Union[EditRequest, GenerateRequest],
    background_tasks: BackgroundTasks,
    user: UserProfile = Depends(get_current_user)
):
    """
    Unified streaming endpoint for AI assistant.
    
    Handles both generation and editing based on request.edit_type:
    - 'generate': Creates new music based on the prompt
    - 'edit': Edits an existing track based on the prompt
    
    Provides real-time streaming updates via SSE:
    - stage: Current processing stage
    - status: Status updates 
    - response_chunk: AI response chunks as they arrive
    - action: Actions to be performed on the frontend
    - complete: Final response with track data
    """
    logger.info(f"Streaming assistant called with edit_type: {getattr(request, 'edit_type', None)}")
    queue = asyncio.Queue()
    
    # Send initial status
    await queue.put(("start", {"message": "Starting AI processing"}))
    
    # Start processing in background
    background_tasks.add_task(
        process_assistant_streaming,
        request=request,
        queue=queue
    )
    
    # Return streaming response
    return StreamingResponse(
        sse_manager.event_generator(queue),
        media_type="text/event-stream",
        headers=SSE_HEADERS
    )

# For backward compatibility during transition
@router.post("/edit")
async def edit_track_stream(
    request: EditRequest,
    background_tasks: BackgroundTasks,
    user: UserProfile = Depends(get_current_user)
):
    """Legacy endpoint for edit requests, uses the unified assistant endpoint."""
    return await streaming_assistant(request, background_tasks, user)

@router.get("/edit")
async def edit_track_stream_get(
    request: Request,
    prompt: str,
    track_id: str,
    edit_type: str = None,
    user: UserProfile = Depends(get_current_user)
):
    """GET version of the streaming endpoint (for testing)."""
    # Create a request object from query parameters
    edit_request = EditRequest(
        prompt=prompt,
        track_id=track_id,
        edit_type=edit_type
    )
    
    return await streaming_assistant(edit_request, BackgroundTasks(), user)

async def process_assistant_streaming(
    request: Union[EditRequest, GenerateRequest], 
    queue: asyncio.Queue
):
    """Process AI assistant requests with streaming updates."""
    # Determine request type
    is_generate = hasattr(request, 'edit_type') and request.edit_type == 'generate'
    request_type = "generate" if is_generate else "edit"
    track_id = getattr(request, 'track_id', f"gen-{int(time.time())}")
    
    logger.info(f"Processing {request_type} request for track: {track_id}")
    
    try:
        # Stage 1: Initialization
        await queue.put(("stage", {
            "name": "initializing", 
            "description": f"Setting up {request_type} process"
        }))
        
        # Status update
        await queue.put(("status", {
            "message": f"{'Generating music' if is_generate else 'Working on edit request'}", 
            "details": f"Prompt: {request.prompt}"
        }))
        
        # Stage 2: Processing 
        await queue.put(("stage", {
            "name": "processing", 
            "description": f"{'Creating your music' if is_generate else 'Processing your edit'} with AI"
        }))
        
        # Create message ID for this session
        message_id = f"msg-{int(time.time())}"
        
        # Response streaming setup
        await queue.put(("response_start", {
            "message_id": message_id,
            "track_id": track_id
        }))
        
        # Create appropriate system prompt
        if is_generate:
            system_prompt = f"You are a musical assistant that helps users create music. Generate a helpful, concise response about creating music based on: '{request.prompt}'. Keep your response clear and focused on music composition."
        else:
            system_prompt = f"You are a musical assistant that helps users edit their tracks. Generate a helpful, concise response about editing track '{track_id}' based on the request: '{request.prompt}'. Keep your response clear and focused."
        
        # Stream AI response
        client = AnthropicClient(system_prompt=system_prompt)
        full_response = await stream_ai_response(
            client=client,
            prompt=request.prompt,
            is_generate=is_generate,
            message_id=message_id,
            queue=queue
        )
        
        # Generate appropriate action based on request type
        action = None
        if is_generate:
            action = AssistantAction(
                type="add_generated_track",
                data={
                    "trackId": f"gen-track-{int(time.time())}", 
                    "instrumentName": "Piano", 
                    "storageKey": "default_piano.sf2"
                }
            )
            await queue.put(("action", action.dict()))
        
        # Send final response with track data
        track_data = TrackData(
            notes=generate_sample_notes() if is_generate else [],
            instrument_name="Piano" if is_generate else "",
            storage_key="default_piano.sf2" if is_generate else ""
        )
        
        final_response = EditResponse(
            response=full_response,
            track=track_data,
            actions=[action] if action else []
        )
        
        await queue.put(("complete", final_response.dict()))
        logger.info(f"Completed {request_type} streaming for track {track_id}")
        
    except Exception as e:
        logger.error(f"Error in {request_type} streaming: {str(e)}")
        logger.error(traceback.format_exc())
        
        # Send error to client
        await queue.put(("error", {
            "message": f"Error processing your request",
            "error": str(e),
            "track_id": track_id
        }))

async def stream_ai_response(
    client: AnthropicClient,
    prompt: str,
    is_generate: bool,
    message_id: str,
    queue: asyncio.Queue
) -> str:
    """Stream AI response chunks and return the full response."""
    try:
        # Prepare the user prompt
        user_prompt = f"Please help me {'create music with this idea' if is_generate else 'edit my track with this change'}: {prompt}"
        
        # Full response accumulator
        full_response = ""
        
        # Get streaming response from Anthropic
        response = await client.async_client.messages.create(
            model=client.model,
            max_tokens=2000,
            system=client.system_prompt,
            messages=[{"role": "user", "content": user_prompt}],
            stream=True
        )
        
        # Process the stream
        chunk_index = 0
        async for chunk in response:
            # Yield control back to event loop
            await asyncio.sleep(0)
            
            if hasattr(chunk, "delta") and hasattr(chunk.delta, "text"):
                text = chunk.delta.text
                if text:
                    full_response += text
                    logger.debug(f"Received chunk {chunk_index}: length={len(text)}")
                    
                    # Send the chunk to the client
                    await queue.put(("response_chunk", {
                        "message_id": message_id,
                        "chunk": text,
                        "chunk_index": chunk_index
                    }))
                    
                    chunk_index += 1
        
        # Response completion
        await queue.put(("response_end", {
            "message_id": message_id,
            "is_complete": True
        }))
        
        return full_response
        
    except Exception as e:
        logger.error(f"Error streaming from Anthropic: {str(e)}")
        error_message = f"Sorry, I encountered an error: {str(e)}"
        
        # Send the error as a final chunk
        await queue.put(("response_chunk", {
            "message_id": message_id,
            "chunk": error_message,
            "chunk_index": 9999
        }))
        
        await queue.put(("response_end", {
            "message_id": message_id,
            "is_complete": True,
            "error": True
        }))
        
        return error_message

def generate_sample_notes():
    """Generate sample notes for demonstration purposes."""
    return [
        {"time": 0, "duration": 0.5, "pitch": 60, "velocity": 100},
        {"time": 0.5, "duration": 0.5, "pitch": 64, "velocity": 100},
        {"time": 1, "duration": 0.5, "pitch": 67, "velocity": 100},
        {"time": 1.5, "duration": 0.5, "pitch": 72, "velocity": 100}
    ]