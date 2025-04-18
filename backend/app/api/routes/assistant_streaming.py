"""
Enhanced AI Assistant API with two-step request handling:
1. POST request to get a request ID
2. SSE connection to receive streaming updates

This implementation uses a request manager to track active requests and
provides streaming responses with proper resource management.
"""
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Path, Query, Request, Response, status
from fastapi.responses import JSONResponse, StreamingResponse
import asyncio
import json
import logging
import time
import uuid
from typing import Dict, List, Any, Optional, AsyncGenerator, Literal
import traceback

from app.core.security import get_current_user
from app.schemas.user import UserProfile
from app.schemas.assistant import (
    AssistantRequest, AssistantResponse, 
    GenerateRequest, GenerateResponse,
    EditRequest, EditResponse,
    AssistantAction, TrackData
)
from app.utils.request_manager import request_manager, RequestStatus
from app.utils.sse import format_sse_message, SSEManager
from app.utils.sse_queue_manager import SSEQueueManager
from app.types.assistant_actions import TrackType
from services.music_gen_service.music_gen_service import music_gen_service
from services.music_gen_service.midi import get_clean_track_data
from pydantic import BaseModel

# Set up logger
logger = logging.getLogger("beatgen.assistant_streaming")

# Create router
router = APIRouter()

# Initialize SSE manager
sse_manager = SSEManager(heartbeat_interval=20)

# Request schema for unified assistant endpoint
class AssistantRequestModel(AssistantRequest):
    """Unified request model for all assistant interaction types"""
    mode: Literal["generate", "edit", "chat"]
    
# Response schema for request creation
class RequestCreationResponse(BaseModel):
    """Response for request creation"""
    request_id: str
    status: str
    mode: str
    estimated_time: Optional[int] = None

@router.post("/request", status_code=status.HTTP_201_CREATED, response_model=RequestCreationResponse)
async def create_assistant_request(
    request: AssistantRequestModel,
    background_tasks: BackgroundTasks,
    user: UserProfile = Depends(get_current_user)
):
    # Debug logging at the start
    logger.info(f"📝 CREATE REQUEST - Received request: mode={request.mode}, user_id={user.get('id') if user else 'None'}")
    logger.info(f"📝 CREATE REQUEST - User profile: {user if user else 'None'}")
    """
    Create a new assistant request and return a request ID for streaming.
    
    This endpoint accepts requests for all assistant modes (generate, edit, chat)
    and returns a request ID that can be used to establish an SSE connection
    for streaming results.
    """
    try:
        
        # Check rate limits
        if not request_manager.can_create_request(user.get("id")):
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Maximum concurrent requests reached ({request_manager.MAX_REQUESTS_PER_USER})"
            )
        
        # Create request in manager
        logger.info(f"📝 CREATE REQUEST - Creating request with user_id={user.get('id')}")
        request_id = request_manager.create_request(
            user_id=user.get('id'),  # This should match what we use in the stream endpoint
            mode=request.mode,
            prompt=request.prompt,
            track_id=request.track_id,
            context=request.context
        )
        logger.info(f"📝 CREATE REQUEST - Request created with ID: {request_id}")
        
        # Update request status to processing
        request_manager.update_request_status(request_id, RequestStatus.PROCESSING)
        
        # Start processing in background
        background_tasks.add_task(
            process_assistant_request,
            request_id=request_id
        )
        
        # Estimate processing time based on mode
        estimated_time = 30  # Default 30 seconds
        if request.mode == "generate":
            estimated_time = 60  # Generation takes longer
        
        # Return response with request ID
        return JSONResponse(
            status_code=status.HTTP_201_CREATED,
            content={
                "request_id": request_id,
                "status": "processing",
                "mode": request.mode,
                "estimated_time": estimated_time
            }
        )
    
    except ValueError as e:
        # Handle validation errors
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    
    # except Exception as e:
    #     logger.error(f"Error creating assistant request: {str(e)}")
    #     raise HTTPException(
    #         status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
    #         detail="Failed to create assistant request"
    #     )
        
    return RequestCreationResponse(
        request_id=request_id,
        status="processing",
        mode=request.mode,
        estimated_time=estimated_time
    )

@router.get("/stream/{request_id}")
async def stream_assistant_response(
    request_id: str = Path(..., description="Request ID from create_assistant_request"),
    user: UserProfile = Depends(get_current_user)
):
    # Debug logging at the start
    logger.info(f"🔄 STREAM REQUEST - Received stream request: request_id={request_id}")
    logger.info(f"🔄 STREAM REQUEST - User: id={user.get('id') if user else 'None'}")
    """
    Stream assistant response for a specific request ID.
    
    Establishes an SSE connection to receive real-time updates for the
    processing of an assistant request.
    """
    # Validate request ID with detailed logging
    logger.info(f"🔄 STREAM REQUEST - Validating request ID: {request_id} for user: {user.get('id')}")
    is_valid = request_manager.validate_request_id(request_id, user.get('id'))
    logger.info(f"🔄 STREAM REQUEST - Validation result: {is_valid}")
    
    if not is_valid:
        logger.error(f"🔄 STREAM REQUEST - Request ID not found or not owned by user: {request_id}, user: {user.get('id')}")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Request ID not found: {request_id}"
        )
    
    # Get the queue for this request with detailed logging
    logger.info(f"🔄 STREAM REQUEST - Getting queue for request ID: {request_id}")
    queue = request_manager.get_queue(request_id)
    logger.info(f"🔄 STREAM REQUEST - Queue retrieved: {queue is not None}")
    
    if not queue:
        logger.error(f"🔄 STREAM REQUEST - Queue not found for request: {request_id}")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Queue not found for request: {request_id}"
        )
    
    logger.info(f"Establishing SSE stream for request: {request_id}")
    
    # Return streaming response
    return StreamingResponse(
        sse_manager.event_generator(queue),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "Content-Type": "text/event-stream",
            "X-Accel-Buffering": "no"
        }
    )

@router.delete("/request/{request_id}")
async def cancel_assistant_request(
    request_id: str = Path(..., description="Request ID to cancel"),
    user: UserProfile = Depends(get_current_user)
):
    """Cancel an ongoing assistant request"""
    # Validate request ID
    if not request_manager.validate_request_id(request_id, user.get("id")):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Request ID not found: {request_id}"
        )
    
    # Get the SSE queue
    sse_queue = request_manager.get_sse_queue(request_id)
    if sse_queue:
        # Send cancelled event
        await sse_queue.cancelled()
    
    # Remove request
    if request_manager.remove_request(request_id, RequestStatus.CANCELLED):
        return JSONResponse(
            content={
                "message": f"Request {request_id} cancelled successfully"
            }
        )
    else:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to cancel request"
        )

async def process_assistant_request(request_id: str):
    """
    Background task to process an assistant request.
    
    Retrieves the request context, processes it according to its mode,
    and sends SSE events through the queue.
    """
    # Get request context
    context = request_manager.get_request(request_id)
    if not context:
        logger.error(f"Request context not found for ID: {request_id}")
        return
    
    # Get the SSE queue for sending events
    sse_queue = context.sse_queue
    if not sse_queue:
        logger.error(f"SSE queue not found for request: {request_id}")
        return
    
    try:
        # Log start of processing
        logger.info(f"Processing assistant request: {request_id}, mode: {context.mode}")
        
        # Send initial events using SSEEventQueue helper methods
        await sse_queue.start_stream()
        
        await sse_queue.stage(
            name="initializing", 
            description=f"Setting up {context.mode} process"
        )
        
        await sse_queue.status(
            message=f"Processing your {context.mode} request", 
            details=f"Prompt: {context.prompt}"
        )
        
        # Process based on mode
        if context.mode == "generate":
            await process_generate_request(request_id, context, sse_queue)
        elif context.mode == "edit":
            await process_edit_request(request_id, context, sse_queue)
        else:  # chat
            await process_chat_request(request_id, context, sse_queue)
        
        # Mark request as completed
        request_manager.update_request_status(request_id, RequestStatus.COMPLETED)
        
    except asyncio.CancelledError:
        # Task was cancelled - no need to do anything as request_manager handles cleanup
        logger.info(f"Processing cancelled for request: {request_id}")
        raise
        
    except Exception as e:
        # Log error and send error event
        logger.error(f"Error processing request {request_id}: {str(e)}")
        logger.error(f"Traceback: {traceback.format_exc()}")
        
        # Try to send error to client
        try:
            await sse_queue.error(
                message=f"Error processing your request: {str(e)}",
                error_data={
                    "error": str(e),
                    "traceback": traceback.format_exc()
                }
            )
        except Exception as send_error:
            logger.error(f"Failed to send error event for request: {request_id}")
            logger.error(f"Send error traceback: {traceback.format_exc()}")
        
        # Mark request as failed
        request_manager.update_request_status(request_id, RequestStatus.FAILED)
    
    finally:
        # Clean up request after a short delay to allow events to be consumed
        asyncio.create_task(delayed_request_cleanup(request_id))

async def delayed_request_cleanup(request_id: str, delay_seconds: int = 10):
    """Cleanup request after a delay to ensure events are consumed"""
    await asyncio.sleep(delay_seconds)
    request_manager.remove_request(request_id)

async def process_generate_request(request_id: str, context, sse_queue: SSEQueueManager):
    """Process a generate mode request"""
    # Stream fake AI response chunks (for now)
    full_response = ""
    chunks = ["Generating music based on your prompt... ", 
             "This will include notes, harmonies, and rhythm patterns... ",
             "Creating musical elements that match your description... "]
    
    # Process the response in stages
    await sse_queue.stage("processing", "Creating your music with AI")
    
    # Add each chunk with a delay to simulate processing
    for chunk in chunks:
        await asyncio.sleep(0.5)  # Simulate processing time
        await sse_queue.add_chunk(chunk)
        full_response += chunk
    
    
    # Generate music with music_gen_service
    try:
        response = await music_gen_service.compose_music(context.prompt, sse_queue)
        logger.info(f"Music generation complete: {len(response.get('instruments', []))} instruments")
        logger.info(f"Response: {response}")
        # Extract first instrument
        if response.get('instruments') and len(response['instruments']) > 0:
            tracks = []
            actions = []
            logger.info(f"Response instruments: {response['instruments']}")
            for instrument in response['instruments']:
                if not instrument.get('notes'):
                    continue
                logger.info(f"Adding instrument: {instrument}")
            
                # Create action for the generated track
                action = AssistantAction.add_track(
                    type=TrackType.MIDI,
                    instrument_id=instrument['instrument_id'],
                    notes=instrument['notes']
                )
                actions.append(action)
                # Send the action to the client
                # await sse_queue.action(action)
                
                # Create track data
                track_data = TrackData(
                    notes=instrument['notes'],
                    instrument_name=instrument.get('name', 'Piano'),
                    instrument_id=instrument['instrument_id']
                )
                tracks.append(track_data)
            # Create final response
            final_response = GenerateResponse(
                response=full_response,
                tracks=tracks,
                actions=actions
            )
            
            # Send complete event
            await sse_queue.complete(final_response.model_dump())
            logger.info(f"Generate request completed successfully: {request_id}")
        else:
            raise ValueError("No instruments returned from music generation service")
        
    except Exception as gen_error:
        logger.error(f"Error in music generation: {gen_error}")
        logger.error(f"Generation error traceback: {traceback.format_exc()}")
        await sse_queue.error(
            message=f"Error generating music: {str(gen_error)}",
            error_data={
                "error": str(gen_error),
                "traceback": traceback.format_exc()
            }
        )
        raise
    

async def process_edit_request(request_id: str, context, queue: asyncio.Queue):
    """Process an edit mode request"""
    
    # Create message ID for this session
    message_id = f"msg-{int(time.time())}"
    
    # Response streaming setup
    await queue.put(("response_start", {
        "message_id": message_id,
        "request_id": request_id,
        "track_id": context.track_id
    }))
    
    # Send processing stage
    await queue.put(("stage", {
        "name": "processing", 
        "description": "Processing your edit request"
    }))
    
    # Stream fake AI response chunks (for now)
    full_response = ""
    chunks = [f"Working on your edit request for track {context.track_id}... ", 
             "Analyzing your instructions and determining necessary changes... ",
             f"Applying changes based on: '{context.prompt}'... "]
    
    for i, chunk in enumerate(chunks):
        await asyncio.sleep(0.5)  # Simulate processing time
        full_response += chunk
        await queue.put(("response_chunk", {
            "message_id": message_id,
            "chunk": chunk,
            "chunk_index": i
        }))
    
    # Mark response as complete
    await queue.put(("response_end", {
        "message_id": message_id,
        "is_complete": True
    }))
    
    # Simple edit example (adjust volume)
    action = AssistantAction(
        type="adjust_volume",
        data={
            "trackId": context.track_id,
            "value": 80  # Example volume value
        }
    )
    
    # Send the action to the client
    await queue.put(("action", action.dict()))
    
    # Create empty track data (no note changes in this example)
    track_data = TrackData(
        notes=[],
        instrument_name="Edited Track",
        instrument_id=None
    )
    
    # Create final response
    final_response = EditResponse(
        response=full_response,
        track=track_data,
        actions=[action]
    )
    
    # Send complete event
    await queue.put(("complete", final_response.dict()))
    logger.info(f"Edit request completed successfully: {request_id}")

async def process_chat_request(request_id: str, context, queue: asyncio.Queue):
    """Process a chat mode request"""
    # Create message ID for this session
    message_id = f"msg-{int(time.time())}"
    
    # Response streaming setup
    await queue.put(("response_start", {
        "message_id": message_id,
        "request_id": request_id
    }))
    
    # Send processing stage
    await queue.put(("stage", {
        "name": "processing", 
        "description": "Processing your question"
    }))
    
    # Stream fake AI response chunks (for now)
    full_response = ""
    chunks = ["I'm your AI music assistant. ", 
             "I can help with music production, arrangement, and theory. ",
             f"Regarding your question: '{context.prompt}', I'll do my best to assist."]
    
    for i, chunk in enumerate(chunks):
        await asyncio.sleep(0.5)  # Simulate processing time
        full_response += chunk
        await queue.put(("response_chunk", {
            "message_id": message_id,
            "chunk": chunk,
            "chunk_index": i
        }))
    
    # Mark response as complete
    await queue.put(("response_end", {
        "message_id": message_id,
        "is_complete": True
    }))
    
    # Create final response
    final_response = AssistantResponse(
        response=full_response
    )
    
    # Send complete event
    await queue.put(("complete", final_response.dict()))
    logger.info(f"Chat request completed successfully: {request_id}")

# Ensure all endpoints in these routes are included in main.py