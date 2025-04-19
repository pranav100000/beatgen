"""
Service for file operations (audio, MIDI, instruments)
"""
from typing import Dict, Any, List, Optional, Union, Type, TypeVar, Generic
from enum import Enum
import traceback
from datetime import datetime
import uuid

from app2.core.logging import get_service_logger
from app2.core.exceptions import ServiceException, NotFoundException, ForbiddenException, StorageException
from app2.repositories.track_repository import TrackRepository
from app2.repositories.file_repository import FileRepository
from app2.types.track_types import TrackType
from app2.models.file_models.audio_file import AudioFile, AudioFileRead
from app2.models.file_models.midi_file import MidiFile
from app2.models.file_models.instrument_file import InstrumentFile, InstrumentFileRead
from app2.types.file_types import FileType

logger = get_service_logger("file")

# Generic type variables for file models
T = TypeVar('T', AudioFile, MidiFile, InstrumentFile)
TRead = TypeVar('TRead', AudioFileRead, InstrumentFileRead)

class FileService:
    """Service for file operations independent of tracks"""
    
    def __init__(self, track_repository: TrackRepository, file_repository: FileRepository):
        """
        Initialize the service with repositories
        
        Args:
            track_repository: The repository for track operations
            file_repository: The repository for direct file operations
        """
        self.track_repository = track_repository
        self.file_repository = file_repository
        
        # Map file types to their model classes
        self._file_models = {
            FileType.AUDIO: AudioFile,
            FileType.MIDI: MidiFile,
            FileType.INSTRUMENT: InstrumentFile
        }
        
        # Map file types to their read model classes
        self._file_read_models = {
            FileType.AUDIO: AudioFileRead,
            FileType.MIDI: None,  # Add the read model if available
            FileType.INSTRUMENT: InstrumentFileRead
        }
    
    async def get_file_by_id(self, file_id: uuid.UUID, file_type: FileType, user_id: Optional[uuid.UUID] = None) -> Any:
        """
        Get a file by ID with optional user validation
        
        Args:
            file_id: The ID of the file
            file_type: The type of file
            user_id: Optional user ID for access validation
            
        Returns:
            The file object
            
        Raises:
            NotFoundException: If the file is not found
            ForbiddenException: If user_id is provided and doesn't have access
            ServiceException: If the operation fails
        """
        logger.info(f"Getting {file_type} file with ID: {file_id}")
        try:
            # First try to get the file directly
            try:
                file = await self.file_repository.get_by_id(file_id, file_type)
                
                # # If user_id is provided, verify ownership through tracks
                # if user_id:
                #     # Check if user has access to this file (through tracks)
                #     tracks = await self.track_repository.get_by_file_id(file_id, file_type)
                    
                #     user_has_access = False
                #     for track in tracks:
                #         if track.user_id == user_id:
                #             user_has_access = True
                #             break
                    
                #     if not user_has_access and file_type != FileType.INSTRUMENT:
                #         # For instrument files, they might be public
                #         if file_type == FileType.INSTRUMENT and getattr(file, 'is_public', False):
                #             user_has_access = True
                    
                #     if not user_has_access:
                #         logger.error(f"User {user_id} does not have access to {file_type} file {file_id}")
                #         raise ForbiddenException(f"You do not have permission to access this {file_type} file")
                
                # Convert to read model if available
                read_model = self._file_read_models.get(file_type)
                if read_model:
                    return read_model.model_validate(file)
                else:
                    return file
                    
            except NotFoundException:
                # If file not found directly, try finding through tracks
                if user_id:
                    logger.info(f"File {file_id} not found directly, trying to find through tracks")
                    
                    tracks = await self.track_repository.get_by_file_id(file_id, file_type)
                    
                    if not tracks:
                        logger.error(f"{file_type.capitalize()} file {file_id} not found")
                        raise NotFoundException(f"{file_type.capitalize()} file", file_id)
                    
                    # Find a track owned by this user
                    user_track = None
                    for track in tracks:
                        if track.user_id == user_id:
                            user_track = track
                            break
                    
                    if not user_track:
                        logger.error(f"User {user_id} does not have access to {file_type} file {file_id}")
                        raise ForbiddenException(f"You do not have permission to access this {file_type} file")
                    
                    # Get the file from the track
                    file = None
                    if file_type == FileType.AUDIO and user_track.audio_file:
                        file = user_track.audio_file
                    elif file_type == FileType.MIDI and user_track.midi_file:
                        file = user_track.midi_file
                    elif file_type == FileType.INSTRUMENT and user_track.instrument_file:
                        file = user_track.instrument_file
                    
                    if not file:
                        logger.error(f"{file_type.capitalize()} file {file_id} not found in track {user_track.id}")
                        raise NotFoundException(f"{file_type.capitalize()} file", file_id)
                    
                    # Convert to read model if available
                    read_model = self._file_read_models.get(file_type)
                    if read_model:
                        return read_model.model_validate(file)
                    else:
                        return file
                else:
                    # If no user_id provided, just raise the original not found
                    raise
                
        except Exception as e:
            if isinstance(e, (NotFoundException, ForbiddenException)):
                raise
            logger.error(f"Error getting {file_type} file: {str(e)}")
            logger.error(traceback.format_exc())
            raise ServiceException(f"Failed to get {file_type} file: {str(e)}")
    
    async def get_user_files(self, user_id: uuid.UUID, file_type: FileType) -> List[Any]:
        """
        Get all files of a specific type for a user
        
        Args:
            user_id: The ID of the user
            file_type: The type of files to get
            
        Returns:
            A list of files
            
        Raises:
            ServiceException: If the operation fails
        """
        logger.info(f"Getting {file_type.value} files for user ID: {user_id}")
        try:
            # Get files directly from the file repository
            files = await self.file_repository.get_by_user_id(user_id, file_type)
            
            logger.info(f"Found {len(files)} {file_type.value} files for user ID: {user_id}")
            
            # Convert to read models if available
            read_model = self._file_read_models.get(file_type)
            if read_model:
                return [read_model.model_validate(file) for file in files]
            else:
                return files
                
        except Exception as e:
            logger.error(f"Error getting user {file_type.value} files: {str(e)}")
            logger.error(traceback.format_exc())
            raise ServiceException(f"Failed to get user {file_type.value} files: {str(e)}")
    
    async def get_public_instrument_files(self) -> List[InstrumentFileRead]:
        """
        Get all publicly available instrument files
        
        Returns:
            A list of public instrument files
            
        Raises:
            ServiceException: If the operation fails
        """
        logger.info("Getting public instrument files")
        try:
            # Use get_all with is_public=True filter
            instruments = await self.file_repository.get_all(FileType.INSTRUMENT, is_public=True)
            
            logger.info(f"Found {len(instruments)} public instrument files")
            
            # Convert to read models
            return [InstrumentFileRead.model_validate(instrument) for instrument in instruments]
            
        except Exception as e:
            logger.error(f"Error getting public instrument files: {str(e)}")
            logger.error(traceback.format_exc())
            raise ServiceException(f"Failed to get public instrument files: {str(e)}")
    
    async def create_file(self, file_data: Dict[str, Any], file_type: FileType) -> Any:
        """
        Create a new file record
        
        Args:
            file_data: The file data
            file_type: The type of file
            
        Returns:
            The created file
            
        Raises:
            ServiceException: If the operation fails
        """
        logger.info(f"Creating new {file_type} file")
        try:
            file = await self.file_repository.create(file_data.model_dump(), file_type)
            
            # Convert to read model if available
            read_model = self._file_read_models.get(file_type)
            if read_model:
                return read_model.model_validate(file)
            else:
                return file
                
        except Exception as e:
            logger.error(f"Error creating {file_type} file: {str(e)}")
            logger.error(traceback.format_exc())
            raise ServiceException(f"Failed to create {file_type} file: {str(e)}")
    
    async def update_file(self, file_id: uuid.UUID, file_data: Dict[str, Any], file_type: FileType) -> Any:
        """
        Update a file record
        
        Args:
            file_id: The ID of the file to update
            file_data: The updated file data
            file_type: The type of file
            
        Returns:
            The updated file
            
        Raises:
            NotFoundException: If the file is not found
            ServiceException: If the operation fails
        """
        logger.info(f"Updating {file_type} file with ID {file_id}")
        try:
            file = await self.file_repository.update(file_id, file_data, file_type)
            
            # Convert to read model if available
            read_model = self._file_read_models.get(file_type)
            if read_model:
                return read_model.model_validate(file)
            else:
                return file
                
        except Exception as e:
            if isinstance(e, NotFoundException):
                raise
            logger.error(f"Error updating {file_type} file: {str(e)}")
            logger.error(traceback.format_exc())
            raise ServiceException(f"Failed to update {file_type} file: {str(e)}")
    
    async def delete_file(self, file_id: uuid.UUID, file_type: FileType) -> bool:
        """
        Delete a file record
        
        Args:
            file_id: The ID of the file to delete
            file_type: The type of file
            
        Returns:
            True if the operation was successful
            
        Raises:
            NotFoundException: If the file is not found
            ServiceException: If the operation fails
        """
        logger.info(f"Deleting {file_type} file with ID {file_id}")
        try:
            return await self.file_repository.delete(file_id, file_type)
                
        except Exception as e:
            if isinstance(e, NotFoundException):
                raise
            logger.error(f"Error deleting {file_type} file: {str(e)}")
            logger.error(traceback.format_exc())
            raise ServiceException(f"Failed to delete {file_type} file: {str(e)}")
    
    async def create_upload_url(self, file_name: str, file_id: uuid.UUID, user_id: uuid.UUID, file_type: FileType, should_overwrite: bool = True) -> Dict[str, str]:
        """
        Create a signed URL for uploading a file
        
        Args:
            file_name: The name of the file to upload
            file_id: The ID of the file
            user_id: The ID of the user
            file_type: The type of file
            should_overwrite: Whether to overwrite existing file with the same name (default True)
            
        Returns:
            A dictionary with the upload URL and storage key
            
        Raises:
            ServiceException: If the operation fails
        """
        logger.info(f"Creating upload URL for {file_type} file {file_name} for user ID: {user_id}")
        try:
            # Storage path logic based on file type
            file_extension = file_name.split('.')[-1]
            
            prefix = file_type.value  # Use enum value
            storage_key = f"{prefix}/{user_id}/{file_id}.{file_extension}"
            
            # Create storage client
            from app2.infrastructure.storage.supabase_storage import SupabaseStorage
            bucket = "tracks" if file_type in [FileType.AUDIO, FileType.MIDI] else "instruments"
            storage = SupabaseStorage(bucket)
            
            # Generate upload URL with overwrite option
            result = storage.create_signed_upload_url(storage_key, should_overwrite=should_overwrite)
            
            # Add file ID to result
            result["id"] = str(file_id)
            
            logger.info(f"Created upload URL for {file_type} file {file_name} for user ID: {user_id}")
            return result
            
        except Exception as e:
            logger.error(f"Error creating upload URL: {str(e)}")
            logger.error(traceback.format_exc())
            raise ServiceException(f"Failed to create upload URL: {str(e)}")