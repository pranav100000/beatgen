from fastapi import APIRouter, Depends, status
from typing import Any, List, Dict, Optional
from uuid import UUID
from pydantic import BaseModel
from datetime import datetime

from app2.api.dependencies import get_current_user, get_file_service, get_track_service
from app2.core.logging import get_api_logger
from app2.services.track_service import FileType, TrackService
from app2.models.file_models.instrument_file import InstrumentFile
from app2.services.file_service import FileService

router = APIRouter()
logger = get_api_logger("soundfonts")

@router.get("", response_model=List[InstrumentFile])
@router.get("/public", response_model=List[InstrumentFile])
async def get_soundfonts(
    current_user: Dict[str, Any] = Depends(get_current_user),
    track_service: TrackService = Depends(get_track_service),
    file_service: FileService = Depends(get_file_service)
) -> List[InstrumentFile]:
    """
    Get all available soundfonts
    """
    logger.info(f"Getting public soundfonts for user ID: {current_user['id']}")
    ret = await file_service.get_public_instrument_files()
    logger.info(f"Retrieved {len(ret)} public soundfonts")
    return ret
    # In a real implementation, this would query the database
    # Filter to only include this user's soundfonts and public ones

@router.get("/{soundfont_id}", response_model=InstrumentFile)
async def get_soundfont(
    soundfont_id: UUID,
    current_user: Dict[str, Any] = Depends(get_current_user),
    file_service: FileService = Depends(get_file_service)
) -> InstrumentFile:
    """
    Get a specific soundfont by ID
    """
    logger.info(f"Getting soundfont with ID: {soundfont_id} for user: {current_user['id']}")
    ret = await file_service.get_file_by_id(soundfont_id, FileType.INSTRUMENT)
    logger.info(f"Retrieved soundfont with ID: {soundfont_id}")
    return ret
            
    # If soundfont not found