from fastapi import APIRouter, Depends, status, HTTPException, Request
from typing import Any, Dict, List, Optional
from pydantic import BaseModel
from datetime import datetime
import uuid

from app2.api.dependencies import get_current_user, get_track_service, get_file_service
from app2.core.logging import get_api_logger
from app2.core.exceptions import NotFoundException, ForbiddenException, ServiceException
from app2.models.file_models.audio_file import AudioFile, AudioFileCreate, AudioFileRead
from app2.models.file_models.midi_file import MidiFile
from app2.services.track_service import TrackService
from app2.types.file_types import FileType
from app2.types.track_types import TrackType
from app2.services.file_service import FileService
from app2.models.project_track import ProjectTrackCreate

router = APIRouter()
logger = get_api_logger("sounds")

class UploadUrlRequest(BaseModel):
    """Request model for generating upload URLs"""
    file_name: str
    id: str  # ID for the sound (UUID)
    file_type: str  # 'audio' or 'midi'
    should_overwrite: bool = False  # Whether to overwrite existing file

class UploadUrlResponse(BaseModel):
    """Response model for upload URLs"""
    id: str
    upload_url: str
    storage_key: str

@router.post("/upload-url", response_model=UploadUrlResponse)
async def get_upload_url(
    request: Request,
    request_data: UploadUrlRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
    file_service: FileService = Depends(get_file_service)
) -> UploadUrlResponse:
    """
    Generate a presigned URL for uploading an audio file
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

@router.post("", response_model=AudioFileRead)
@router.post("/", response_model=AudioFileRead)
async def create_project_track(
    request: Request,
    project_track_data: AudioFileCreate,
    current_user: Dict[str, Any] = Depends(get_current_user),
    track_service: TrackService = Depends(get_track_service),
    file_service: FileService = Depends(get_file_service)
) -> AudioFileRead:
    """
    Create a new audio track record after successful upload
    """
    logger.info(f"Creating audio track record for ID: {project_track_data.id} by user: {current_user['id']}")
    logger.info(f"Project track data: {project_track_data}")
    try:
        
        file = await file_service.create_file(
            file_data=project_track_data,
            file_type=FileType.AUDIO
        )
        
        track = await track_service.create_track(
            user_id=uuid.UUID(current_user["id"]),
            track_data=project_track_data,
            file_type=FileType.AUDIO
        )
        
        # Get the audio file through the file service
        result = await file_service.get_file_by_id(
            file_id=uuid.UUID(str(project_track_data.id)),
            file_type=FileType.AUDIO,
            user_id=uuid.UUID(current_user["id"])
        )
        
        logger.info(f"Created audio track record with ID: {project_track_data.id}")
        return result
    except Exception as e:
        logger.error(f"Error creating audio track record: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create audio track record: {str(e)}"
        )

@router.get("", response_model=List[AudioFileRead])
@router.get("/", response_model=List[AudioFileRead])
async def get_audio_files(
    request: Request,
    current_user: Dict[str, Any] = Depends(get_current_user),
    file_service: FileService = Depends(get_file_service)
) -> List[AudioFileRead]:
    """
    Get all audio files for the current user
    """
    logger.info(f"Getting audio files for user: {current_user['id']}")
    try:
        audio_files = await file_service.get_user_files(
            user_id=uuid.UUID(current_user["id"]),
            file_type=FileType.AUDIO
        )
        logger.info(f"Found {len(audio_files)} audio files for user: {current_user['id']}")
        return audio_files
    except Exception as e:
        logger.error(f"Error getting audio files: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get audio files: {str(e)}"
        )

@router.get("/{audio_file_id}", response_model=AudioFileRead)
async def get_audio_file(
    request: Request,
    audio_file_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user),
    file_service: FileService = Depends(get_file_service)
) -> AudioFileRead:
    """
    Get a specific audio file by ID
    """
    logger.info(f"Getting audio file with ID: {audio_file_id} for user: {current_user['id']}")
    try:
        audio_file = await file_service.get_file_by_id(
            file_id=uuid.UUID(audio_file_id),
            file_type=FileType.AUDIO,
            user_id=uuid.UUID(current_user["id"])
        )
        logger.info(f"Found audio file with ID: {audio_file_id}")
        return audio_file
    except NotFoundException:
        logger.error(f"Audio file with ID {audio_file_id} not found")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Audio file not found"
        )
    except ForbiddenException:
        logger.error(f"User {current_user['id']} does not have permission to access audio file {audio_file_id}")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to access this audio file"
        )
    except Exception as e:
        logger.error(f"Error getting audio file: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get audio file: {str(e)}"
        )

@router.delete("/{audio_file_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_audio_file(
    request: Request,
    audio_file_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user),
    track_service: TrackService = Depends(get_track_service),
    file_service: FileService = Depends(get_file_service)
) -> None:
    """
    Delete an audio file by first deleting its track
    """
    logger.info(f"Deleting audio file with ID: {audio_file_id} for user: {current_user['id']}")
    try:
        # First try to get the file directly to verify it exists
        try:
            await file_service.file_repository.get_by_id(
                file_id=uuid.UUID(audio_file_id),
                file_type=FileType.AUDIO
            )
        except NotFoundException:
            logger.error(f"Audio file with ID {audio_file_id} not found")
            raise NotFoundException("Audio file", audio_file_id)
        
        # Get tracks that reference this file
        tracks = await track_service.track_repository.get_by_file_id(
            file_id=uuid.UUID(audio_file_id),
            file_type=FileType.AUDIO
        )
        
        if not tracks:
            logger.warning(f"No tracks found with audio file ID {audio_file_id}, attempting direct file delete")
            # If no tracks, try to delete the file directly
            result = await file_service.file_repository.delete(
                file_id=uuid.UUID(audio_file_id),
                file_type=FileType.AUDIO
            )
            logger.info(f"Directly deleted audio file with ID: {audio_file_id}, result: {result}")
            return None
            
        # Find a track owned by this user
        user_track = None
        for track in tracks:
            if track.user_id == uuid.UUID(current_user["id"]):
                user_track = track
                break
                
        if not user_track:
            logger.error(f"User {current_user['id']} does not own any track with audio file {audio_file_id}")
            raise ForbiddenException("You do not have permission to delete this audio file")
            
        # Delete the track (which should delete the file association)
        await track_service.delete_track(
            track_id=user_track.id,
            user_id=uuid.UUID(current_user["id"])
        )
        
        # Also delete the file itself to clean up
        try:
            await file_service.file_repository.delete(
                file_id=uuid.UUID(audio_file_id),
                file_type=FileType.AUDIO
            )
        except Exception as e:
            logger.warning(f"Error cleaning up audio file after track deletion: {str(e)}")
        
        logger.info(f"Deleted audio file with ID: {audio_file_id}")
        return None
    except NotFoundException:
        logger.error(f"Audio file with ID {audio_file_id} not found")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Audio file not found"
        )
    except ForbiddenException:
        logger.error(f"User {current_user['id']} does not have permission to delete audio file {audio_file_id}")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to delete this audio file"
        )
    except Exception as e:
        logger.error(f"Error deleting audio file: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete audio file: {str(e)}"
        )