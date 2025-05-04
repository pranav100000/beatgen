from fastapi import APIRouter, Depends, status, HTTPException, Request
from typing import Any, Dict, List, Optional, Union
from pydantic import BaseModel, Field
from datetime import datetime
import uuid

from app2.api.dependencies import get_current_user, get_track_service, get_file_service
from app2.core.logging import get_api_logger
from app2.core.exceptions import NotFoundException, ForbiddenException, ServiceException
from app2.services.track_service import TrackService
from app2.types.file_types import FileType
from app2.types.track_types import TrackType
from app2.services.file_service import FileService
from app2.models.track_models.audio_track import AudioTrackRead, AudioTrackCreate
from app2.models.track_models.midi_track import MidiTrackRead, MidiTrackCreate
from app2.models.track_models.sampler_track import SamplerTrackRead, SamplerTrackCreate
from app2.models.track_models.drum_track import DrumTrackCreate, DrumTrackRead

router = APIRouter()
logger = get_api_logger("sounds")

class UploadUrlRequest(BaseModel):
    """Request model for generating upload URLs"""
    file_name: str
    id: str  # ID for the file (UUID)
    file_type: str  # 'audio', 'midi', or 'instrument'
    should_overwrite: bool = False  # Whether to overwrite existing file

class UploadUrlResponse(BaseModel):
    """Response model for upload URLs"""
    id: str
    upload_url: str
    storage_key: str
    
    
@router.post("/upload-url", response_model=UploadUrlResponse)
async def get_upload_url(
    request_data: UploadUrlRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
    file_service: FileService = Depends(get_file_service)
) -> UploadUrlResponse:
    """
    Generate a presigned URL for uploading a file
    """
    logger.info(f"Upload URL requested for file: {request_data.file_name} by user: {current_user['id']}")
    try:
        # Map the string file type to enum
        file_type_enum = FileType.AUDIO
        if request_data.file_type == "midi":
            file_type_enum = FileType.MIDI
        elif request_data.file_type == "instrument":
            file_type_enum = FileType.INSTRUMENT
            
        result = await file_service.create_upload_url(
            file_name=request_data.file_name,
            file_id=uuid.UUID(request_data.id),
            user_id=uuid.UUID(current_user["id"]),
            file_type=file_type_enum,
            should_overwrite=request_data.should_overwrite
        )
        logger.info(f"Upload URL generated for file: {request_data.file_name}")
        return result
    except Exception as e:
        logger.error(f"Error generating upload URL: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate upload URL: {str(e)}"
        )

@router.post("/audio", response_model=AudioTrackRead)
async def create_audio_track(
    track_data: AudioTrackCreate,
    current_user: Dict[str, Any] = Depends(get_current_user),
    track_service: TrackService = Depends(get_track_service)
) -> AudioTrackRead:
    """
    Create a new audio track
    """
    user_id = uuid.UUID(current_user["id"])
    logger.info(f"Creating audio track '{track_data.name}' for user: {user_id}")
    try:
        # Create the track
        audio_track = await track_service.create_audio_track(user_id, track_data.model_dump())
        
        logger.info(f"Created audio track with ID: {audio_track.id}")
        return audio_track
    except Exception as e:
        logger.error(f"Error creating audio track: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create audio track: {str(e)}"
        )

@router.post("/midi", response_model=MidiTrackRead)
async def create_midi_track(
    track_data: MidiTrackCreate,
    current_user: Dict[str, Any] = Depends(get_current_user),
    track_service: TrackService = Depends(get_track_service)
) -> MidiTrackRead:
    """
    Create a new MIDI track
    """
    user_id = uuid.UUID(current_user["id"])
    logger.info(f"Creating MIDI track '{track_data.name}' for user: {user_id}")
    logger.info(f"DEbuG: MIDI Track data: {track_data}")
    try:
        
        # Log the MIDI notes if available
        if track_data.midi_notes_json:
            logger.info(f"Received MIDI notes JSON with {len(track_data.midi_notes_json)} keys")
        
        # Create the track
        midi_track = await track_service.create_midi_track(user_id, track_data.model_dump())
        
        logger.info(f"Created MIDI track with ID: {midi_track.id}")
        return midi_track
    except Exception as e:
        logger.error(f"Error creating MIDI track: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create MIDI track: {str(e)}"
        )

@router.post("/sampler", response_model=SamplerTrackRead)
async def create_sampler_track(
    track_data: SamplerTrackCreate,
    current_user: Dict[str, Any] = Depends(get_current_user),
    track_service: TrackService = Depends(get_track_service)
) -> SamplerTrackRead:
    """
    Create a new sampler track
    """
    user_id = uuid.UUID(current_user["id"])
    logger.info(f"Creating sampler track '{track_data.name}' for user: {user_id}")
    try:
        # Create the track
        sampler_track = await track_service.create_sampler_track(user_id, track_data.model_dump())
        
        logger.info(f"Created sampler track with ID: {sampler_track.id}")
        return sampler_track
    except Exception as e:
        logger.error(f"Error creating sampler track: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create sampler track: {str(e)}"
        )

@router.post("/drum", response_model=DrumTrackRead)
async def create_drum_track(
    track_data: DrumTrackCreate,
    current_user: Dict[str, Any] = Depends(get_current_user),
    track_service: TrackService = Depends(get_track_service)
) -> DrumTrackRead:
    """
    Create a new drum track
    """
    user_id = uuid.UUID(current_user["id"])
    logger.info(f"Creating drum track '{track_data.name}' for user: {user_id}")
    try:
        # Create the track
        drum_track = await track_service.create_drum_track(user_id, track_data.model_dump())
        
        logger.info(f"Created drum track with ID: {drum_track.id}")
        return drum_track
    except Exception as e:
        logger.error(f"Error creating drum track: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create drum track: {str(e)}"
        )
        

@router.get("/audio", response_model=List[AudioTrackRead])
async def get_audio_tracks(
    current_user: Dict[str, Any] = Depends(get_current_user),
    track_service: TrackService = Depends(get_track_service)
) -> List[AudioTrackRead]:
    """
    Get all audio tracks for the current user
    """
    user_id = uuid.UUID(current_user["id"])
    logger.info(f"Getting audio tracks for user: {user_id}")
    try:
        # Get all tracks for the user
        all_tracks = await track_service.get_user_tracks(user_id)
        
        # Return just the audio tracks
        return all_tracks[TrackType.AUDIO.value]
    except Exception as e:
        logger.error(f"Error getting audio tracks: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get audio tracks: {str(e)}"
        )

@router.get("/midi", response_model=List[MidiTrackRead])
async def get_midi_tracks(
    current_user: Dict[str, Any] = Depends(get_current_user),
    track_service: TrackService = Depends(get_track_service)
) -> List[MidiTrackRead]:
    """
    Get all MIDI tracks for the current user
    """
    user_id = uuid.UUID(current_user["id"])
    logger.info(f"Getting MIDI tracks for user: {user_id}")
    try:
        # Get all tracks for the user
        all_tracks = await track_service.get_user_tracks(user_id)
        
        # Return just the MIDI tracks
        return all_tracks[TrackType.MIDI.value]
    except Exception as e:
        logger.error(f"Error getting MIDI tracks: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get MIDI tracks: {str(e)}"
        )
        
@router.get("/sampler", response_model=List[SamplerTrackRead])
async def get_sampler_tracks(
    current_user: Dict[str, Any] = Depends(get_current_user),
    track_service: TrackService = Depends(get_track_service)
) -> List[SamplerTrackRead]:
    """
    Get all sampler tracks for the current user
    """
    user_id = uuid.UUID(current_user["id"])
    logger.info(f"Getting sampler tracks for user: {user_id}")
    try:
        # Get all tracks for the user
        all_tracks = await track_service.get_user_tracks(user_id)
        
        # Return just the sampler tracks
        return all_tracks[TrackType.SAMPLER.value]
    except Exception as e:
        logger.error(f"Error getting sampler tracks: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get sampler tracks: {str(e)}"
        )

@router.get("/audio/{track_id}", response_model=AudioTrackRead)
async def get_audio_track(
    track_id: uuid.UUID,
    current_user: Dict[str, Any] = Depends(get_current_user),
    track_service: TrackService = Depends(get_track_service)
) -> AudioTrackRead:
    """
    Get a specific audio track by ID
    """
    user_id = uuid.UUID(current_user["id"])
    logger.info(f"Getting audio track with ID: {track_id} for user: {user_id}")
    try:
        return await track_service.get_track(track_id, TrackType.AUDIO, user_id)
    except NotFoundException as e:
        logger.error(f"Audio track not found: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Audio track not found"
        )
    except ForbiddenException as e:
        logger.error(f"Forbidden: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to access this audio track"
        )
    except Exception as e:
        logger.error(f"Error getting audio track: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get audio track: {str(e)}"
        )

@router.get("/midi/{track_id}", response_model=MidiTrackRead)
async def get_midi_track(
    track_id: uuid.UUID,
    current_user: Dict[str, Any] = Depends(get_current_user),
    track_service: TrackService = Depends(get_track_service)
) -> MidiTrackRead:
    """
    Get a specific MIDI track by ID
    """
    user_id = uuid.UUID(current_user["id"])
    logger.info(f"Getting MIDI track with ID: {track_id} for user: {user_id}")
    try:
        return await track_service.get_track(track_id, TrackType.MIDI, user_id)
    except NotFoundException as e:
        logger.error(f"MIDI track not found: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="MIDI track not found"
        )
    except ForbiddenException as e:
        logger.error(f"Forbidden: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to access this MIDI track"
        )
    except Exception as e:
        logger.error(f"Error getting MIDI track: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get MIDI track: {str(e)}"
        )

@router.get("/sampler/{track_id}", response_model=SamplerTrackRead)
async def get_sampler_track(
    track_id: uuid.UUID,
    current_user: Dict[str, Any] = Depends(get_current_user),
    track_service: TrackService = Depends(get_track_service)
) -> SamplerTrackRead:
    """
    Get a specific sampler track by ID
    """
    user_id = uuid.UUID(current_user["id"])
    logger.info(f"Getting sampler track with ID: {track_id} for user: {user_id}")
    try:
        return await track_service.get_track(track_id, TrackType.SAMPLER, user_id)
    except NotFoundException as e:
        logger.error(f"Sampler track not found: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Sampler track not found"
        )
    except ForbiddenException as e:
        logger.error(f"Forbidden: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to access this sampler track"
        )
    except Exception as e:
        logger.error(f"Error getting sampler track: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get sampler track: {str(e)}"
        )

@router.delete("/audio/{track_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_audio_track(
    track_id: uuid.UUID,
    current_user: Dict[str, Any] = Depends(get_current_user),
    track_service: TrackService = Depends(get_track_service)
) -> None:
    """
    Delete an audio track
    """
    user_id = uuid.UUID(current_user["id"])
    logger.info(f"Deleting audio track with ID: {track_id} for user: {user_id}")
    try:
        result = await track_service.delete_track(track_id, TrackType.AUDIO, user_id)
        if result:
            logger.info(f"Deleted audio track with ID: {track_id}")
        return None
    except NotFoundException as e:
        logger.error(f"Audio track not found: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Audio track not found"
        )
    except ForbiddenException as e:
        logger.error(f"Forbidden: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to delete this audio track"
        )
    except Exception as e:
        logger.error(f"Error deleting audio track: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete audio track: {str(e)}"
        )

@router.delete("/midi/{track_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_midi_track(
    track_id: uuid.UUID,
    current_user: Dict[str, Any] = Depends(get_current_user),
    track_service: TrackService = Depends(get_track_service)
) -> None:
    """
    Delete a MIDI track
    """
    user_id = uuid.UUID(current_user["id"])
    logger.info(f"Deleting MIDI track with ID: {track_id} for user: {user_id}")
    try:
        result = await track_service.delete_track(track_id, TrackType.MIDI, user_id)
        if result:
            logger.info(f"Deleted MIDI track with ID: {track_id}")
        return None
    except NotFoundException as e:
        logger.error(f"MIDI track not found: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="MIDI track not found"
        )
    except ForbiddenException as e:
        logger.error(f"Forbidden: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to delete this MIDI track"
        )
    except Exception as e:
        logger.error(f"Error deleting MIDI track: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete MIDI track: {str(e)}"
        )

@router.delete("/sampler/{track_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_sampler_track(
    track_id: uuid.UUID,
    current_user: Dict[str, Any] = Depends(get_current_user),
    track_service: TrackService = Depends(get_track_service)
) -> None:
    """
    Delete a sampler track
    """
    user_id = uuid.UUID(current_user["id"])
    logger.info(f"Deleting sampler track with ID: {track_id} for user: {user_id}")
    try:
        result = await track_service.delete_track(track_id, TrackType.SAMPLER, user_id)
        if result:
            logger.info(f"Deleted sampler track with ID: {track_id}")
        return None
    except NotFoundException as e:
        logger.error(f"Sampler track not found: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Sampler track not found"
        )
    except ForbiddenException as e:
        logger.error(f"Forbidden: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to delete this sampler track"
        )
    except Exception as e:
        logger.error(f"Error deleting sampler track: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete sampler track: {str(e)}"
        )