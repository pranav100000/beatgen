from typing import Dict, Any, List, Optional
from uuid import UUID
import traceback
from datetime import datetime

from app2.core.exceptions import DatabaseException, NotFoundException, StorageException
from app2.infrastructure.storage.supabase_storage import SupabaseStorage
from .base_repository import BaseRepository

class SoundRepository(BaseRepository):
    """Repository for sound operations"""
    
    def __init__(self):
        """Initialize the repository with the audio_track table"""
        super().__init__("audio_track")
        
    async def create_upload_url(self, file_name: str, sound_id: str, user_id: str, file_type: str) -> Dict[str, str]:
        """
        Create a signed URL for uploading a sound file
        
        Args:
            file_name: The name of the file to upload
            sound_id: The ID of the sound
            user_id: The ID of the user who owns the sound
            file_type: The type of file (audio or midi)
            
        Returns:
            A dictionary with the upload URL and storage key
            
        Raises:
            StorageException: If the operation fails
        """
        self.logger.info(f"Creating upload URL for file {file_name}")
        try:
            # Determine storage path
            file_extension = file_name.split('.')[-1]
            prefix = ""
            if file_type == "audio":
                prefix = "audio"
            elif file_type == "midi":
                prefix = "midi"
            else:
                raise StorageException("Invalid file type")
                
            storage_key = f"{prefix}/{user_id}/{sound_id}.{file_extension}"
            
            # Create storage client
            storage = SupabaseStorage("tracks")
            
            # Generate upload URL
            result = storage.create_signed_upload_url(storage_key)
            
            # Add sound ID to result
            result["id"] = sound_id
            
            self.logger.info(f"Created upload URL for file {file_name}")
            return result
        except Exception as e:
            self.logger.error(f"Error creating upload URL: {str(e)}")
            self.logger.error(traceback.format_exc())
            raise StorageException(f"Failed to create upload URL: {str(e)}")
            
    async def delete_sound_with_file(self, sound_id: str, user_id: str) -> bool:
        """
        Delete a sound and its associated file
        
        Args:
            sound_id: The ID of the sound to delete
            user_id: The ID of the user who owns the sound
            
        Returns:
            True if the operation was successful
            
        Raises:
            NotFoundException: If the sound is not found
            DatabaseException: If the database operation fails
            StorageException: If the storage operation fails
        """
        self.logger.info(f"Deleting sound {sound_id} with file")
        try:
            # First get the sound to check ownership and get storage key
            from app2.infrastructure.database.supabase_client import supabase
            
            result = supabase.execute_query(
                self.table_name,
                lambda table: table.select("*").eq("id", str(sound_id)).eq("user_id", str(user_id)).single()
            )
            
            if not result:
                self.logger.error(f"Sound {sound_id} not found for user {user_id}")
                raise NotFoundException("Sound", sound_id)
                
            # Get storage key
            storage_key = result.get("storage_key")
            
            if not storage_key:
                self.logger.warning(f"Sound {sound_id} has no storage key")
                # Just delete the database record
                await self.delete(sound_id)
                return True
                
            # Delete from database first
            await self.delete(sound_id)
            
            # Then delete from storage
            try:
                storage = SupabaseStorage("tracks")
                storage.delete_file(storage_key)
            except Exception as storage_err:
                # Log but don't fail if storage deletion fails
                self.logger.error(f"Error deleting file from storage: {str(storage_err)}")
                self.logger.error(traceback.format_exc())
                self.logger.warning("Database record was deleted but file may remain in storage")
            
            self.logger.info(f"Deleted sound {sound_id} with file")
            return True
        except Exception as e:
            if isinstance(e, NotFoundException):
                raise
            self.logger.error(f"Error deleting sound with file: {str(e)}")
            self.logger.error(traceback.format_exc())
            if "database" in str(e).lower():
                raise DatabaseException(f"Failed to delete sound record: {str(e)}")
            raise StorageException(f"Failed to delete sound file: {str(e)}")