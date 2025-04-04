from fastapi import APIRouter, Depends, HTTPException, status, Request
from typing import List, Optional
from datetime import datetime
import uuid
import logging

from app.core.security import get_current_user
from services.soundfont_service.soundfont_service import soundfont_service

# Configure logger
logger = logging.getLogger("beatgen.soundfonts")

router = APIRouter()

class SoundfontPublic:
    id: uuid.UUID
    name: str
    display_name: str
    category: str
    description: Optional[str]
    storage_key: str
    created_at: datetime
    updated_at: datetime

@router.get("/public", response_model=List[dict])
async def get_public_soundfonts(
    request: Request,
    category: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
) -> List[dict]:
    """
    Get all public soundfonts, optionally filtered by category
    """
    logger.info(f"Getting public soundfonts for user: {current_user['id']}, category filter: {category}")
    
    soundfonts = await soundfont_service.get_public_soundfonts(category)
    if not soundfonts:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve soundfonts"
        )
    
    return soundfonts

@router.get("/public/{soundfont_id}", response_model=dict)
async def get_public_soundfont(
    request: Request,
    soundfont_id: str,
    current_user: dict = Depends(get_current_user)
) -> dict:
    """
    Get a specific public soundfont by ID
    """
    logger.info(f"Getting public soundfont with ID: {soundfont_id}")
    
    soundfont = await soundfont_service.get_public_soundfont(soundfont_id)
    if not soundfont:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Soundfont not found"
        )
    
    return soundfont