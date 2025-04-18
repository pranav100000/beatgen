from fastapi import APIRouter, HTTPException, status, Depends, BackgroundTasks
from fastapi.responses import StreamingResponse
from typing import Dict, Any, AsyncGenerator, Tuple
import logging
import json
import asyncio

from app.core.security import get_current_user
from app.schemas.user import UserProfile
from app.schemas.assistant import (
    GenerateRequest, GenerateResponse,
    EditRequest, EditResponse,
    AssistantAction, TrackData
)
from app.types.assistant_actions import AssistantAction, TrackType
from services.music_gen_service.music_gen_service import music_gen_service
from services.music_gen_service.midi import get_clean_track_data
from services.music_gen_service.music_tools import music_tools_service
from app.utils.sse import format_sse_message
import traceback

# Set up logger for this module
logger = logging.getLogger("beatgen.assistant")

router = APIRouter()

@router.post("/generate", response_model=GenerateResponse)
async def generate_tracks(
    request: GenerateRequest,
    user: UserProfile = Depends(get_current_user)
):
    """
    Generate multiple tracks based on the provided prompt
    """
    try:
        resp = await music_gen_service.compose_music(request.prompt)
        print("COMPOSE MUSIC RESPONSE:", resp)
        tracks = TrackData(
            notes=resp.get("instruments")[0].get("notes"),
            instrument_id=resp.get("instruments")[0].get("instrument_id"),
            instrument_name=resp.get("instruments")[0].get("name"),
            storage_key=resp.get("instruments")[0].get("storage_key")
        )
        action = AssistantAction.add_track(
            type=TrackType.MIDI,
            instrument_id=resp.get("instruments")[0].get("instrument_id"),
            notes=resp.get("instruments")[0].get("notes")
        )

        generate_response = GenerateResponse(
            response=str(resp),
            tracks=[tracks],
            actions=[action]
        )
        print("GENERATE RESPONSE:", generate_response)
        return generate_response
        #resp = await music_tools_service.compose_music(request.prompt)
    except Exception as e:
        logger.error(f"Error generating tracks: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "message": "Failed to generate music tracks",
                "error": str(e),
            }
        )
    
    # try:
    #     import random
    #     from uuid import uuid4
        
    #     # Parse the request
    #     num_tracks = request.num_tracks or 1
    #     prompt = request.prompt
        
    #     logger.info(f"Generating {num_tracks} tracks with prompt: {prompt}")
        
    #     # Define some instrument options with their storage keys
    #     instruments = [
    #         {"name": "Strings", "storage_key": "strings/e8775290-b0c7-41ed-bdad-c98eadd1c9b4.sf2"}
    #     ]
        
    #     # Generate mock tracks with random notes
    #     tracks = []
        
    #     for i in range(num_tracks):
    #         # Select a random instrument
    #         instrument = random.choice(instruments)
            
    #         # Generate a random number of notes (5-20)
    #         num_notes = random.randint(5, 20)
    #         notes = []
            
    #         # Middle C is MIDI note 60
    #         # Generate notes in a C major scale (C, D, E, F, G, A, B)
    #         scale = [60, 62, 64, 65, 67, 69, 71, 72]
            
    #         # Create random notes
    #         for j in range(num_notes):
    #             # Note starts at a random time between 0 and 4 beats
    #             time = round(random.uniform(0, 4), 2)
                
    #             # Duration between 0.25 and 1 beat
    #             duration = round(random.uniform(0.25, 1), 2)
                
    #             # Pick a random note from the scale
    #             pitch = random.choice(scale)
                
    #             # Velocity between 70 and 100
    #             velocity = random.randint(70, 100)
                
    #             notes.append({
    #                 "time": time,
    #                 "duration": duration,
    #                 "pitch": pitch,
    #                 "velocity": velocity
    #             })
            
    #         # Sort notes by time
    #         notes.sort(key=lambda note: note["time"])
            
    #         # Create track data with storage key and notes
    #         track_id = str(uuid4())
    #         tracks.append({
    #             "track_id": track_id,
    #             "notes": notes,
    #             "instrument": instrument["name"],
    #             "name": f"{instrument['name']} {i+1}",
    #             "storage_key": instrument["storage_key"]  # Add storage key for the instrument
    #         })
            
    #         logger.info(f"Generated track: {instrument['name']} with {len(notes)} notes")
        
    #     # Create a response with the generated tracks
    #     return GenerateResponse(
    #         response=f"Generated {num_tracks} tracks based on your request: '{prompt}'",
    #         tracks=tracks,
    #         actions=[
    #             AssistantAction(
    #                 type="add_tracks",
    #                 data={"count": num_tracks}
    #             )
    #         ]
    #     )
        
    # except Exception as e:
        import traceback
        error_traceback = traceback.format_exc()
        
        # Log detailed error with full context
        logger.error(f"TRACK GENERATION ERROR: {str(e)}")
        logger.error(f"Request details: {request.dict()}")
        logger.error(f"Traceback: {error_traceback}")
        
        # Return structured error information
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "message": "Track generation error",
                "error": str(e),
                "num_tracks": request.num_tracks
            }
        )
        
    #logger.info(f"RESPONSE: {resp}")
    logger.info(f"Generated tracks: {resp.get('tracks', [])}")
    
    # Clean the track data
    clean_track_data = get_clean_track_data(resp.get("tracks", []))
    
    logger.info(f"CLEANED TRACK DATA: {clean_track_data}")
    
    # Construct TrackData objects from cleaned data
    tracks = []
    actions = []
    
    for track in clean_track_data:
        # Ensure we have notes (empty list as fallback)
        notes = track.get("notes", [])
        if notes is None:
            notes = []
            
        # Ensure we have an instrument name
        instrument_name = track.get("instrument_name")
        if not instrument_name and isinstance(track.get("instrument"), dict):
            instrument_name = track["instrument"].get("name", "Unknown Instrument")
        
        # Get storage key for the instrument
        storage_key = track.get("storage_key")
        track_id = track.get("track_id")
        
        # Create the TrackData object
        track_data = TrackData(
            track_id=track_id,
            notes=notes,
            instrument_name=instrument_name,
            storage_key=storage_key
        )
        
        tracks.append(track_data)
        
        # Create an action for each track
        if storage_key:
            # Extract instrument ID from storage key
            # Format is typically: 'instruments/name.sf2'
            try:
                instrument_parts = storage_key.split('/')
                instrument_name = track.get("instrument_name", f"AI Track {len(tracks)}")
                
                # Create add_track action - include the notes directly in the action
                actions.append(
                    AssistantAction(
                        type="add_generated_track",
                        data={
                            "trackId": track_id,
                            "instrumentName": instrument_name,
                            "storageKey": storage_key,
                            "hasNotes": len(notes) > 0,
                            "notes": notes  # Include the actual notes in the action data
                        }
                    )
                )
                
                logger.info(f"Created action for track {track_id} with storage key {storage_key}")
            except Exception as e:
                logger.error(f"Error creating action for track: {e}")
        
    logger.info(f"Created {len(tracks)} TrackData objects with {len(actions)} actions")
        
    return GenerateResponse(
        response=str(resp),
        tracks=tracks,
        actions=actions
    )

@router.post("/edit", response_model=EditResponse)
async def edit_track(
    request: EditRequest,
    user: UserProfile = Depends(get_current_user)
):
    print("EDIT TRACK REQUEST:", request)
    return
    """
    Edit a specific track based on the provided prompt using Claude API with tool calls
    """
    
@router.get("/edit/stream")
async def edit_track_stream(
    request: EditRequest,
    user: UserProfile = Depends(get_current_user)
):
    """
    Stream the process of editing a track with Server-Sent Events.
    
    Provides real-time updates as the AI processes the edit request:
    - stage: The current stage of processing
    - status: Status updates from the Claude API
    - tool_calls: Tools being used by Claude
    - actions: Actions to be performed on the frontend
    - complete: Final response with the edited track
    
    Client should implement an EventSource to receive these updates.
    """
    print("EDIT TRACK STREAM REQUEST:", request)
    # Create event queue for communication between background task and SSE generator
    queue = asyncio.Queue()
    background_tasks = BackgroundTasks()
    
    # Start the edit track process in the background
    background_tasks.add_task(
        process_track_edit_streaming, 
        request=request, 
        queue=queue
    )
    
    # Return a streaming response
    return StreamingResponse(
        event_generator(queue),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        }
    )

async def event_generator(queue: asyncio.Queue) -> AsyncGenerator[str, None]:
    """
    Generate SSE events from a queue.
    
    Args:
        queue: Async queue that receives events from the background task
        
    Yields:
        Properly formatted SSE messages
    """
    # Send initial connection message
    yield format_sse_message("connected", {"status": "connected"})
    
    try:
        # Process events from the queue
        while True:
            try:
                # Wait for the next event with a timeout
                event_type, data = await asyncio.wait_for(queue.get(), timeout=30)
                
                # If we received the completion event, break after yielding it
                if event_type == "complete":
                    yield format_sse_message(event_type, data)
                    break
                
                # Otherwise, yield the event and continue
                yield format_sse_message(event_type, data)
                
            except asyncio.TimeoutError:
                # Send a heartbeat to keep the connection alive
                yield format_sse_message("heartbeat", {"timestamp": asyncio.get_event_loop().time()})
                
    except asyncio.CancelledError:
        # Handle client disconnection
        logger.info("Client disconnected from SSE stream")
        yield format_sse_message("cancelled", {"status": "cancelled"})
        raise
    except Exception as e:
        # Log any errors and send an error event
        logger.error(f"Error in SSE stream: {str(e)}")
        yield format_sse_message("error", {"status": "error", "message": str(e)})
        raise

async def process_track_edit_streaming(request: EditRequest, queue: asyncio.Queue):
    """
    Process track edit with streaming updates.
    
    Args:
        request: The edit request parameters
        queue: Async queue to send events to the client
    """
    try:
        import os
        import json
        import anthropic
        from app.core.tools import get_all_tools
        from app.core.project_serializer import serialize_track, serialize_project, find_track_by_description
        
        # Get project data (placeholder - would come from your database in real implementation)
        # For now we'll create a mock project with a placeholder track
        from app.schemas.project import Project, Track
        from datetime import datetime
        from dotenv import load_dotenv
        
        load_dotenv()
        
        # # Serialize project for AI context
        # project_context = serialize_project(request.)
        # project_context_str = json.dumps(project_context.dict(), indent=2)
        
        # Get tools
        tools = get_all_tools()
        
        # Prepare Claude prompt
        prompt = f"""You are a music production assistant in the BeatGen digital audio workstation.
The user is asking you to help edit a track. The track ID is: {request.track_id}

Here's information about the current project:
```json
{project_context_str}
```

IMPORTANT: You should use the provided tools to implement the requested changes for the track.
For example:
- For volume changes, use the adjust_volume tool
- For panning changes, use the adjust_pan tool
- For muting/unmuting, use the toggle_mute tool
- For renaming, use the rename_track tool

The user's request is: "{request.prompt}"

Analyze what the user wants, then use the appropriate tool to make the change.
If you need to identify a track by description rather than ID, use the identify_track tool first.
"""
        
        # Initialize Anthropic client
        client = anthropic.Anthropic(
            api_key=os.environ.get("ANTHROPIC_API_KEY")
        )
        
        model_id = os.getenv("MODEL_ID")
        
        # Call Claude API with tool use
        # Note: This part would need a real API key to work in production
        try:
            # Log what we're about to do
            logger.info(f"Preparing Claude API call for track: {request.track_id}")
            logger.info(f"Prompt length: {len(prompt)} characters")
            logger.info(f"Number of tools: {len(tools)}")
            
            # Uncomment this section when ready to use the real API
            logger.info("Calling Claude API...")
            response = client.messages.create(
                model=model_id,
                max_tokens=1000,
                temperature=0,
                system="You are a helpful assistant for a music production app.",
                messages=[{"role": "user", "content": prompt}],
                tools=tools
            )
            logger.info(f"Claude API response received, content length: {len(response.content)}")
            logger.info(f"Claude API response structure: {type(response)}")
            logger.info(f"Claude API response dir: {dir(response)}")
            logger.info(f"Claude API stop_reason: {response.stop_reason}")
            
            # Extract tool calls from Claude response
            tool_calls = []
            for content_block in response.content:
                if hasattr(content_block, 'type') and content_block.type == 'tool_use':
                    # Accessing the properties directly on the ToolUseBlock
                    tool_calls.append({
                        'name': content_block.name,
                        'input': content_block.input
                    })
            
            logger.info(f"Tool calls found in Claude response: {len(tool_calls)}")
            if tool_calls:
                logger.info(f"Tool calls details: {tool_calls}")
            
            # Get text response from Claude
            response_text = ""
            for content_block in response.content:
                if hasattr(content_block, 'type') and content_block.type == 'text':
                    response_text += content_block.text
                    break  # Just get the first text block
            
            # If no text found in response, use a default message
            if not response_text:
                response_text = f"I've processed your request to edit track {request.track_id}."
                
            logger.info(f"Generated response: {response_text}")
            
            # Convert tool calls to actions
            actions = []
            logger.info(f"Processing {len(tool_calls)} tool calls into actions")
            
            for tool_call in tool_calls:
                action_type = tool_call["name"]
                logger.info(f"Converting tool call '{action_type}' to action")
                
                # Map parameter keys to match frontend expectations
                action_data = {}
                for key, value in tool_call["input"].items():
                    # Convert snake_case to camelCase for frontend
                    if key == "track_id":
                        action_data["trackId"] = value
                    else:
                        action_data[key] = value
                
                actions.append(
                    AssistantAction(
                        type=action_type,
                        data=action_data
                    )
                )
                
            logger.info(f"Created {len(actions)} actions from tool calls")
            
            # For now, we're returning empty notes
            # Use details from tool calls to update the mock track response
            track_name = "Edited Track"
            instrument = "MOCKPIANO"
            
            # Look for track name in tool calls
            for tool_call in tool_calls:
                if tool_call["name"] == "rename_track" and "name" in tool_call["input"]:
                    track_name = tool_call["input"]["name"]
                elif tool_call["name"] == "change_instrument" and "instrument_name" in tool_call["input"]:
                    instrument = tool_call["input"]["instrument_name"]
            
            track = {
                "track_id": request.track_id,
                "notes": [],
                "instrument": instrument,
                "name": track_name
            }
            
            # Create the full response
            final_response = EditResponse(
                response=response_text,
                track=track,
                actions=actions
            )
            
            # Log the full response (but trim notes to avoid giant logs)
            response_log = final_response.dict()
            response_log["track"]["notes"] = f"[{len(response_log['track']['notes'])} notes]"
            logger.info(f"Returning response: {response_log}")
            
            return final_response
            
        except Exception as api_error:
            import traceback
            error_traceback = traceback.format_exc()
            
            # Log detailed error information
            logger.error(f"AI API ERROR: {str(api_error)}")
            logger.error(f"Request data: {request.dict()}")
            logger.error(f"Traceback: {error_traceback}")
            
            # Return a more informative error
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail={
                    "message": "AI service error",
                    "error": str(api_error),
                    "request_id": request.track_id
                }
            )
        
    except Exception as e:
        import traceback
        error_traceback = traceback.format_exc()
        
        # Log detailed error with full context
        logger.error(f"TRACK EDITING ERROR: {str(e)}")
        logger.error(f"Track ID: {request.track_id}")
        logger.error(f"Prompt: {request.prompt}")
        logger.error(f"Traceback: {error_traceback}")
        
        # Return structured error information
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "message": "Track editing error",
                "error": str(e),
                "track_id": request.track_id
            }
        )