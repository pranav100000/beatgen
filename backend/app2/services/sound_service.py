from typing import Dict, Any, List, Optional
from uuid import UUID
import traceback
from datetime import datetime

from app2.core.logging import get_service_logger
from app2.core.exceptions import ServiceException, NotFoundException, ForbiddenException, StorageException
from app2.repositories.sound_repository import SoundRepository
from app2.infrastructure.storage.supabase_storage import SupabaseStorage

logger = get_service_logger("sound")

class SoundService:
    """Service for sound operations"""
    
    def __init__(self, sound_repository: SoundRepository):
        """
        Initialize the service with repositories
        
        Args:
            sound_repository: The repository for sound operations
        """
        self.sound_repository = sound_repository
        
    async def get_user_sounds(self, user_id: str) -> List[Dict[str, Any]]:
        """
        Get all sounds for a user
        
        Args:
            user_id: The ID of the user
            
        Returns:
            A list of sounds
            
        Raises:
            ServiceException: If the operation fails
        """
        logger.info(f"Getting sounds for user ID: {user_id}")
        try:
            sounds = await self.sound_repository.find_by_user(user_id)
            logger.info(f"Found {len(sounds)} sounds for user ID: {user_id}")
            return sounds
        except Exception as e:
            logger.error(f"Error getting user sounds: {str(e)}")
            logger.error(traceback.format_exc())
            raise ServiceException(f"Failed to get user sounds: {str(e)}")
            
    async def get_sound(self, sound_id: str, user_id: str) -> Dict[str, Any]:
        """
        Get a sound by ID
        
        Args:
            sound_id: The ID of the sound
            user_id: The ID of the user
            
        Returns:
            The sound
            
        Raises:
            NotFoundException: If the sound is not found
            ForbiddenException: If the user does not own the sound
            ServiceException: If the operation fails
        """
        logger.info(f"Getting sound with ID: {sound_id} for user ID: {user_id}")
        try:
            # Find the sound by ID
            sound = await self.sound_repository.find_by_id(sound_id)
            
            # Verify sound ownership
            if sound.get("user_id") != user_id:
                logger.error(f"User {user_id} does not own sound {sound_id}")
                raise ForbiddenException("You do not have permission to access this sound")
                
            logger.info(f"Found sound with ID: {sound_id} for user ID: {user_id}")
            return sound
        except Exception as e:
            if isinstance(e, (NotFoundException, ForbiddenException)):
                raise
            logger.error(f"Error getting sound: {str(e)}")
            logger.error(traceback.format_exc())
            raise ServiceException(f"Failed to get sound: {str(e)}")
            
    async def create_upload_url(self, file_name: str, sound_id: str, user_id: str, file_type: str, should_overwrite: bool = False) -> Dict[str, str]:
        """
        Create a signed URL for uploading a sound file
        
        Args:
            file_name: The name of the file to upload
            sound_id: The ID of the sound
            user_id: The ID of the user
            file_type: The type of file (audio or midi)
            should_overwrite: Whether to overwrite an existing file
            
        Returns:
            A dictionary with the upload URL and storage key
            
        Raises:
            ServiceException: If the operation fails
        """
        logger.info(f"Creating upload URL for file {file_name} for user ID: {user_id}")
        try:
            result = await self.sound_repository.create_upload_url(file_name, sound_id, user_id, file_type)
            logger.info(f"Created upload URL for file {file_name} for user ID: {user_id}")
            return result
        except Exception as e:
            logger.error(f"Error creating upload URL: {str(e)}")
            logger.error(traceback.format_exc())
            raise ServiceException(f"Failed to create upload URL: {str(e)}")
            
    async def create_sound(self, user_id: str, sound_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Create a new sound record
        
        Args:
            user_id: The ID of the user
            sound_data: The sound data
            
        Returns:
            The created sound
            
        Raises:
            ServiceException: If the operation fails
        """
        logger.info(f"Creating sound record for user ID: {user_id}")
        try:
            # Add user ID
            sound_data["user_id"] = user_id
            
            # Add timestamps
            now = datetime.utcnow().isoformat()
            sound_data["created_at"] = now
            sound_data["updated_at"] = now
            
            # Create the sound
            sound = await self.sound_repository.create(sound_data)
            
            logger.info(f"Created sound record with ID: {sound.get('id')} for user ID: {user_id}")
            return sound
        except Exception as e:
            logger.error(f"Error creating sound record: {str(e)}")
            logger.error(traceback.format_exc())
            raise ServiceException(f"Failed to create sound record: {str(e)}")
            
    async def delete_sound(self, sound_id: str, user_id: str) -> bool:
        """
        Delete a sound and its associated file
        
        Args:
            sound_id: The ID of the sound
            user_id: The ID of the user
            
        Returns:
            True if the sound was deleted
            
        Raises:
            NotFoundException: If the sound is not found
            ForbiddenException: If the user does not own the sound
            ServiceException: If the operation fails
        """
        logger.info(f"Deleting sound with ID: {sound_id} for user ID: {user_id}")
        try:
            # Delete the sound and its file
            result = await self.sound_repository.delete_sound_with_file(sound_id, user_id)
            
            logger.info(f"Deleted sound with ID: {sound_id} for user ID: {user_id}")
            return result
        except Exception as e:
            if isinstance(e, (NotFoundException, ForbiddenException)):
                raise
            logger.error(f"Error deleting sound: {str(e)}")
            logger.error(traceback.format_exc())
            raise ServiceException(f"Failed to delete sound: {str(e)}")