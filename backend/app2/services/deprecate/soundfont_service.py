from typing import Dict, Any, List, Optional
from uuid import UUID
import traceback
from datetime import datetime

from app2.core.logging import get_service_logger
from app2.core.exceptions import ServiceException, NotFoundException, ForbiddenException, StorageException
from app2.repositories.file_repository import FileRepository
from app2.infrastructure.storage.supabase_storage import SupabaseStorage
from app2.types.file_types import FileType

logger = get_service_logger("instrument")

class SoundfontService:
    """Service for soundfont operations"""
    
    def __init__(self, file_repository: FileRepository):
        """
        Initialize the service with repositories
        
        Args:
            instrument_file_repository: The repository for instrument file operations
        """
        self.file_repository = file_repository
        
    async def get_public_soundfonts(self) -> List[Dict[str, Any]]:
        """
        Get all public soundfonts
        
        Args:
            user_id: The ID of the user
            
        Returns:
            A list of sounds
            
        Raises:
            ServiceException: If the operation fails
        """
        logger.info(f"Getting public soundfonts")
        try:
            instruments = await self.file_repository.get_all(file_type=FileType.INSTRUMENT, is_public=True)
            logger.info(f"Found {len(instruments)} public instruments")
            return instruments
        except Exception as e:
            logger.error(f"Error getting public soundfonts: {str(e)}")
            logger.error(traceback.format_exc())
            raise ServiceException(f"Failed to get public soundfonts: {str(e)}")
        
    async def get_soundfont_by_id(self, soundfont_id: UUID) -> Dict[str, Any]:
        """
        Get a soundfont by ID
        
        Args:
            soundfont_id: The ID of the soundfont

        Returns:
            A soundfont
            
        Raises:
            ServiceException: If the operation fails
        """
        logger.info(f"Getting soundfont by ID: {soundfont_id}")
        try:
            soundfont = await self.file_repository.get_by_id(soundfont_id, FileType.INSTRUMENT)
            return soundfont
        except Exception as e:
            logger.error(f"Error getting soundfont by ID: {str(e)}")
            logger.error(traceback.format_exc())