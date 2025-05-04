# from typing import Dict, Any, List, Optional
# import traceback
# from datetime import datetime
# import uuid

# from app2.core.logging import get_service_logger
# from app2.core.exceptions import ServiceException, NotFoundException, ForbiddenException, StorageException
# from app2.repositories.audio_file_repository import AudioFileRepository
# from app2.models.file_models.audio_file import AudioFile, AudioFileRead

# logger = get_service_logger("audio_track")

# class AudioTrackService:
#     """Service for audio track operations"""
    
#     def __init__(self, audio_file_repository: AudioFileRepository):
#         """
#         Initialize the service with repositories
        
#         Args:
#             audio_track_repository: The repository for audio track operations
#         """
#         self.audio_file_repository = audio_file_repository
        
#     async def get_user_audio_files(self, user_id: uuid.UUID) -> List[AudioFile]:
#         """
#         Get all audio files for a user
        
#         Args:
#             user_id: The ID of the user
            
#         Returns:
#             A list of audio tracks
            
#         Raises:
#             ServiceException: If the operation fails
#         """
#         logger.info(f"Getting audio tracks for user ID: {user_id}")
#         try:
#             audio_files = await self.audio_file_repository.get_user_audio_files(user_id)
#             logger.info(f"Found {len(audio_files)} audio files for user ID: {user_id}")
            
#             # Convert SQLModel objects to API models
#             return [AudioFileRead.from_orm(file) for file in audio_files]
#         except Exception as e:
#             logger.error(f"Error getting user audio files: {str(e)}")
#             logger.error(traceback.format_exc())
#             raise ServiceException(f"Failed to get user audio files: {str(e)}")
            
#     async def get_audio_track(self, audio_track_id: uuid.UUID, user_id: uuid.UUID) -> AudioFileRead:
#         """
#         Get an audio track by ID
        
#         Args:
#             audio_track_id: The ID of the audio track
#             user_id: The ID of the user
            
#         Returns:
#             The audio track
            
#         Raises:
#             NotFoundException: If the audio track is not found
#             ForbiddenException: If the user does not own the audio track
#             ServiceException: If the operation fails
#         """
#         logger.info(f"Getting audio track with ID: {audio_track_id} for user ID: {user_id}")
#         try:
#             # Find the audio track by ID
#             audio_track = await self.audio_track_repository.find_by_id(audio_track_id)
            
#             # Verify audio track ownership
#             if audio_track.user_id != user_id:
#                 logger.error(f"User {user_id} does not own audio track {audio_track_id}")
#                 raise ForbiddenException("You do not have permission to access this audio track")
                
#             logger.info(f"Found audio track with ID: {audio_track_id} for user ID: {user_id}")
            
#             # Convert SQLModel object to API model
#             return AudioTrackRead.from_orm(audio_track)
#         except Exception as e:
#             if isinstance(e, (NotFoundException, ForbiddenException)):
#                 raise
#             logger.error(f"Error getting audio track: {str(e)}")
#             logger.error(traceback.format_exc())
#             raise ServiceException(f"Failed to get audio track: {str(e)}")
            
#     async def create_upload_url(self, file_name: str, audio_track_id: uuid.UUID, user_id: uuid.UUID, file_type: str, should_overwrite: bool = False) -> Dict[str, str]:
#         """
#         Create a signed URL for uploading an audio track file
        
#         Args:
#             file_name: The name of the file to upload
#             audio_track_id: The ID of the audio track
#             user_id: The ID of the user
#             file_type: The type of file (audio or midi)
#             should_overwrite: Whether to overwrite an existing file
            
#         Returns:
#             A dictionary with the upload URL and storage key
            
#         Raises:
#             ServiceException: If the operation fails
#         """
#         logger.info(f"Creating upload URL for file {file_name} for user ID: {user_id}")
#         try:
#             result = await self.audio_track_repository.create_upload_url(file_name, audio_track_id, user_id, file_type)
#             logger.info(f"Created upload URL for file {file_name} for user ID: {user_id}")
#             return result
#         except Exception as e:
#             logger.error(f"Error creating upload URL: {str(e)}")
#             logger.error(traceback.format_exc())
#             raise ServiceException(f"Failed to create upload URL: {str(e)}")
            
#     async def create_audio_track(self, user_id: uuid.UUID, audio_track_data: Dict[str, Any]) -> AudioFileRead:
#         """
#         Create a new audio track record
        
#         Args:
#             user_id: The ID of the user
#             audio_track_data: The audio track data
            
#         Returns:
#             The created audio track
            
#         Raises:
#             ServiceException: If the operation fails
#         """
#         logger.info(f"Creating audio track record for user ID: {user_id}")
#         try:
#             # Add user ID
#             audio_track_data["user_id"] = user_id
            
#             # Create the audio track
#             audio_track = await self.audio_track_repository.create(audio_track_data)
            
#             logger.info(f"Created audio track record with ID: {audio_track.id} for user ID: {user_id}")
            
#             # Convert SQLModel object to API model
#             return AudioTrackRead.from_orm(audio_track)
#         except Exception as e:
#             logger.error(f"Error creating audio track record: {str(e)}")
#             logger.error(traceback.format_exc())
#             raise ServiceException(f"Failed to create audio track record: {str(e)}")
            
#     async def delete_audio_track(self, audio_track_id: uuid.UUID, user_id: uuid.UUID) -> bool:
#         """
#         Delete an audio track and its associated file
        
#         Args:
#             audio_track_id: The ID of the audio track
#             user_id: The ID of the user
            
#         Returns:
#             True if the audio track was deleted
            
#         Raises:
#             NotFoundException: If the audio track is not found
#             ForbiddenException: If the user does not own the audio track
#             ServiceException: If the operation fails
#         """
#         logger.info(f"Deleting audio track with ID: {audio_track_id} for user ID: {user_id}")
#         try:
#             # Delete the audio track and its file
#             result = await self.audio_track_repository.delete_audio_track_with_file(audio_track_id, user_id)
            
#             logger.info(f"Deleted audio track with ID: {audio_track_id} for user ID: {user_id}")
#             return result
#         except Exception as e:
#             if isinstance(e, (NotFoundException, ForbiddenException)):
#                 raise
#             logger.error(f"Error deleting audio track: {str(e)}")
#             logger.error(traceback.format_exc())
#             raise ServiceException(f"Failed to delete audio track: {str(e)}")