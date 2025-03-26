from fastapi import APIRouter, Depends, status
from typing import Any, List, Dict, Optional
from uuid import UUID
from pydantic import BaseModel
from datetime import datetime

from app2.api.dependencies import get_current_user
from app2.core.logging import get_api_logger

router = APIRouter()
logger = get_api_logger("soundfonts")

# Schema models
class SoundfontBase(BaseModel):
    """Base model for soundfonts"""
    name: str
    description: Optional[str] = None
    category: str
    
class Soundfont(SoundfontBase):
    """Model for a complete soundfont"""
    id: UUID
    user_id: str
    storage_key: str
    file_size: int
    download_count: int = 0
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True

# Mock database for demonstration
SOUNDFONT_DEMO_DATA = [
    {
        "id": "550e8400-e29b-41d4-a716-446655440000",
        "name": "Grand Piano",
        "description": "Concert grand piano soundfont",
        "category": "Piano",
        "user_id": "user123",
        "storage_key": "soundfonts/grand_piano.sf2",
        "file_size": 24500000,
        "download_count": 127,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    },
    {
        "id": "550e8400-e29b-41d4-a716-446655440001",
        "name": "Vintage Drums",
        "description": "Classic drum kit sounds",
        "category": "Drums",
        "user_id": "user123",
        "storage_key": "soundfonts/vintage_drums.sf2",
        "file_size": 15200000,
        "download_count": 85,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    }
]

@router.get("", response_model=List[Soundfont])
@router.get("/", response_model=List[Soundfont])
async def get_soundfonts(
    current_user: Dict[str, Any] = Depends(get_current_user)
) -> Any:
    """
    Get all available soundfonts
    """
    logger.info(f"Getting soundfonts for user ID: {current_user['id']}")
    
    # In a real implementation, this would query the database
    # Filter to only include this user's soundfonts and public ones
    return SOUNDFONT_DEMO_DATA

@router.get("/{soundfont_id}", response_model=Soundfont)
async def get_soundfont(
    soundfont_id: UUID,
    current_user: Dict[str, Any] = Depends(get_current_user)
) -> Any:
    """
    Get a specific soundfont by ID
    """
    logger.info(f"Getting soundfont with ID: {soundfont_id} for user: {current_user['id']}")
    
    # In a real implementation, this would query the database
    for soundfont in SOUNDFONT_DEMO_DATA:
        if str(soundfont["id"]) == str(soundfont_id):
            return soundfont
            
    # If soundfont not found
    from app2.core.exceptions import NotFoundException
    raise NotFoundException("Soundfont", str(soundfont_id))