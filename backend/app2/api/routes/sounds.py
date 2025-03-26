from fastapi import APIRouter, Depends, status, HTTPException, Request
from typing import Any, Dict, List, Optional
from pydantic import BaseModel
from uuid import UUID
from datetime import datetime

from app2.api.dependencies import get_current_user, get_sound_service
from app2.services.sound_service import SoundService
from app2.core.logging import get_api_logger
from app2.core.exceptions import NotFoundException, ForbiddenException, ServiceException

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

class SoundCreate(BaseModel):
    """Model for creating a sound record"""
    id: str
    name: str
    file_format: str
    duration: float
    file_size: int
    sample_rate: int
    waveform_data: List[float]
    storage_key: str

class Sound(SoundCreate):
    """Model for a complete sound record"""
    user_id: str
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True

@router.post("/upload-url", response_model=UploadUrlResponse)
async def get_upload_url(
    request: Request,
    request_data: UploadUrlRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
    sound_service: SoundService = Depends(get_sound_service)
) -> Any:
    """
    Generate a presigned URL for uploading an audio file
    """
    logger.info(f"Upload URL requested for file: {request_data.file_name} by user: {current_user['id']}")
    try:
        result = await sound_service.create_upload_url(
            file_name=request_data.file_name,
            sound_id=request_data.id,
            user_id=current_user["id"],
            file_type=request_data.file_type,
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

@router.post("", response_model=Sound)
@router.post("/", response_model=Sound)
async def create_sound(
    request: Request,
    sound_data: SoundCreate,
    current_user: Dict[str, Any] = Depends(get_current_user),
    sound_service: SoundService = Depends(get_sound_service)
) -> Any:
    """
    Create a new sound record after successful upload
    """
    logger.info(f"Creating sound record for ID: {sound_data.id} by user: {current_user['id']}")
    try:
        result = await sound_service.create_sound(
            user_id=current_user["id"],
            sound_data=sound_data.dict()
        )
        logger.info(f"Created sound record with ID: {sound_data.id}")
        return result
    except Exception as e:
        logger.error(f"Error creating sound record: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create sound record: {str(e)}"
        )

@router.get("", response_model=List[Sound])
@router.get("/", response_model=List[Sound])
async def get_sounds(
    request: Request,
    current_user: Dict[str, Any] = Depends(get_current_user),
    sound_service: SoundService = Depends(get_sound_service)
) -> Any:
    """
    Get all sounds for the current user
    """
    logger.info(f"Getting sounds for user: {current_user['id']}")
    try:
        sounds = await sound_service.get_user_sounds(current_user["id"])
        logger.info(f"Found {len(sounds)} sounds for user: {current_user['id']}")
        return sounds
    except Exception as e:
        logger.error(f"Error getting sounds: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get sounds: {str(e)}"
        )

@router.get("/{sound_id}", response_model=Sound)
async def get_sound(
    request: Request,
    sound_id: UUID,
    current_user: Dict[str, Any] = Depends(get_current_user),
    sound_service: SoundService = Depends(get_sound_service)
) -> Any:
    """
    Get a specific sound by ID
    """
    logger.info(f"Getting sound with ID: {sound_id} for user: {current_user['id']}")
    try:
        sound = await sound_service.get_sound(str(sound_id), current_user["id"])
        logger.info(f"Found sound with ID: {sound_id}")
        return sound
    except NotFoundException:
        logger.error(f"Sound with ID {sound_id} not found")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Sound not found"
        )
    except ForbiddenException:
        logger.error(f"User {current_user['id']} does not have permission to access sound {sound_id}")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to access this sound"
        )
    except Exception as e:
        logger.error(f"Error getting sound: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get sound: {str(e)}"
        )

@router.delete("/{sound_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_sound(
    request: Request,
    sound_id: UUID,
    current_user: Dict[str, Any] = Depends(get_current_user),
    sound_service: SoundService = Depends(get_sound_service)
) -> Any:
    """
    Delete a sound and its storage file
    """
    logger.info(f"Deleting sound with ID: {sound_id} for user: {current_user['id']}")
    try:
        await sound_service.delete_sound(str(sound_id), current_user["id"])
        logger.info(f"Deleted sound with ID: {sound_id}")
        return None
    except NotFoundException:
        logger.error(f"Sound with ID {sound_id} not found")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Sound not found"
        )
    except ForbiddenException:
        logger.error(f"User {current_user['id']} does not have permission to delete sound {sound_id}")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to delete this sound"
        )
    except Exception as e:
        logger.error(f"Error deleting sound: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete sound: {str(e)}"
        )