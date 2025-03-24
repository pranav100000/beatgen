from fastapi import APIRouter, Depends, HTTPException, status, Request
from typing import List, Optional
from datetime import datetime
import uuid
import logging

from app.core.security import get_current_user
from app.core.supabase import supabase

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

    try:
        # Build the query
        query = supabase.table("soundfont_public").select("*")

        # Apply category filter if provided
        if category:
            query = query.eq("category", category)

        # Execute query
        response = query.execute()

        if hasattr(response, 'error') and response.error:
            logger.error(f"Error retrieving soundfonts: {response.error}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Failed to get soundfonts: {response.error.message}"
            )

        soundfonts = response.data or []
        logger.info(f"Found {len(soundfonts)} public soundfonts")

        # Generate download URLs for each soundfont
        for soundfont in soundfonts:
            try:
                # Get public URL for the soundfont file
                file_url = supabase.storage.from_("soundfonts").get_public_url(soundfont["storage_key"])
                soundfont["download_url"] = file_url
                logger.info(f"Generated download URL for soundfont: {soundfont['name']}")
            except Exception as url_err:
                logger.error(f"Error generating URL for soundfont {soundfont['id']}: {str(url_err)}")
                soundfont["download_url"] = None

        return soundfonts

    except HTTPException:
        # Re-raise HTTP exceptions
        raise
    except Exception as e:
        # Handle unexpected errors
        logger.error(f"Unexpected error in get_public_soundfonts: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve soundfonts: {str(e)}"
        )

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

    try:
        response = supabase.table("soundfont_public").select("*").eq("id", soundfont_id).execute()

        if hasattr(response, 'error') and response.error:
            logger.error(f"Error retrieving soundfont: {response.error}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Failed to get soundfont: {response.error.message}"
            )

        if not response.data or len(response.data) == 0:
            logger.error(f"No soundfont found with ID: {soundfont_id}")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Soundfont not found"
            )

        soundfont = response.data[0]

        # Generate download URL
        try:
            file_url = supabase.storage.from_("soundfonts").get_public_url(soundfont["storage_key"])
            soundfont["download_url"] = file_url
            logger.info(f"Generated download URL for soundfont: {soundfont['name']}")
        except Exception as url_err:
            logger.error(f"Error generating URL for soundfont {soundfont['id']}: {str(url_err)}")
            soundfont["download_url"] = None

        return soundfont

    except HTTPException:
        # Re-raise HTTP exceptions
        raise
    except Exception as e:
        # Handle unexpected errors
        logger.error(f"Unexpected error in get_public_soundfont: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve soundfont: {str(e)}"
        )