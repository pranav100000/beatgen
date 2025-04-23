from fastapi import APIRouter, Depends, status
from typing import Any, List, Dict, Optional
from uuid import UUID
from pydantic import BaseModel
from datetime import datetime

from app2.api.dependencies import get_current_user, get_drum_sample_service, get_file_service, get_track_service
from app2.core.logging import get_api_logger
from app2.services.track_service import FileType, TrackService
from app2.models.public_models.instrument_file import InstrumentFile
from app2.models.public_models.drum_samples import DrumSamplePublicRead
from app2.services.file_service import FileService
from app2.services.drum_sample_service import DrumSampleService

router = APIRouter()
logger = get_api_logger("drum_samples")

@router.get("", response_model=List[DrumSamplePublicRead])
@router.get("/public", response_model=List[DrumSamplePublicRead])
async def get_drum_samples(
    current_user: Dict[str, Any] = Depends(get_current_user),
    drum_sample_service: DrumSampleService = Depends(get_drum_sample_service)
) -> List[DrumSamplePublicRead]:
    """
    Get all available drum samples
    """
    logger.info(f"Getting public drum samples for user ID: {current_user['id']}")
    ret = await drum_sample_service.get_all_samples()
    logger.info(f"Retrieved {len(ret)} public drum samples")
    return ret
    # In a real implementation, this would query the database
    # Filter to only include this user's drum samples and public ones

@router.get("/{drum_sample_id}", response_model=DrumSamplePublicRead)
async def get_drum_sample(
    drum_sample_id: UUID,
    current_user: Dict[str, Any] = Depends(get_current_user),
    drum_sample_service: DrumSampleService = Depends(get_drum_sample_service)
) -> DrumSamplePublicRead:
    """
    Get a specific drum sample by ID
    """
    logger.info(f"Getting drum sample with ID: {drum_sample_id} for user: {current_user['id']}")
    ret = await drum_sample_service.get_sample_by_id(drum_sample_id)
    logger.info(f"Retrieved drum sample with ID: {drum_sample_id}")
    return ret
            
    # If soundfont not found