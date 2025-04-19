"""
Service for track and file operations
"""
from typing import Dict, Any, List, Optional, Union, Type, TypeVar
from enum import Enum
import traceback
from datetime import datetime
import uuid

from app2.core.logging import get_service_logger
from app2.core.exceptions import ServiceException, NotFoundException, ForbiddenException, StorageException
from app2.repositories.track_repository import TrackRepository
from app2.repositories.file_repository import FileRepository
from app2.types.track_types import TrackType
from app2.models.track import Track, TrackRead, TrackCreate, TrackUpdate
from app2.models.file_models.audio_file import AudioFile, AudioFileRead, AudioFileCreate
from app2.models.file_models.midi_file import MidiFile
from app2.models.file_models.instrument_file import InstrumentFile, InstrumentFileRead
from app2.types.file_types import FileType

logger = get_service_logger("track")

# Generic type for file models
T = TypeVar('T', AudioFile, MidiFile, InstrumentFile)
TRead = TypeVar('TRead', AudioFileRead, InstrumentFileRead)

class TrackService:
    """Service for track and associated file operations"""
    
    def __init__(self, track_repository: TrackRepository, file_repository: FileRepository):
        """
        Initialize the service with repositories
        
        Args:
            track_repository: The repository for track operations
            file_repository: The repository for file operations
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
        
        # Map file types to track field names
        self._track_field_mapping = {
            FileType.AUDIO: "audio_file_id",
            FileType.MIDI: "midi_file_id",
            FileType.INSTRUMENT: "instrument_id"
        }
    
    async def get_user_tracks(self, user_id: uuid.UUID) -> List[TrackRead]:
        """
        Get all tracks for a user
        
        Args:
            user_id: The ID of the user
            
        Returns:
            A list of tracks
            
        Raises:
            ServiceException: If the operation fails
        """
        logger.info(f"Getting tracks for user ID: {user_id}")
        try:
            tracks = await self.track_repository.get_by_user_id(user_id)
            logger.info(f"Found {len(tracks)} tracks for user ID: {user_id}")
            return [TrackRead.model_validate(track) for track in tracks]
        except Exception as e:
            logger.error(f"Error getting user tracks: {str(e)}")
            logger.error(traceback.format_exc())
            raise ServiceException(f"Failed to get user tracks: {str(e)}")
    
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
    
    async def get_track(self, track_id: uuid.UUID, user_id: uuid.UUID) -> TrackRead:
        """
        Get a track by ID
        
        Args:
            track_id: The ID of the track
            user_id: The ID of the user
            
        Returns:
            The track
            
        Raises:
            NotFoundException: If the track is not found
            ForbiddenException: If the user does not own the track
            ServiceException: If the operation fails
        """
        logger.info(f"Getting track with ID: {track_id} for user ID: {user_id}")
        try:
            # Get the track with all associated files
            track = await self.track_repository.get_with_files(track_id)
            
            # Verify track ownership
            if track.user_id != user_id:
                logger.error(f"User {user_id} does not own track {track_id}")
                raise ForbiddenException("You do not have permission to access this track")
            
            logger.info(f"Found track with ID: {track_id} for user ID: {user_id}")
            return TrackRead.model_validate(track)
        except Exception as e:
            if isinstance(e, (NotFoundException, ForbiddenException)):
                raise
            logger.error(f"Error getting track: {str(e)}")
            logger.error(traceback.format_exc())
            raise ServiceException(f"Failed to get track: {str(e)}")
    
    async def get_file(self, file_id: uuid.UUID, file_type: FileType, user_id: uuid.UUID) -> Any:
        """
        Get a file by ID and type
        
        Args:
            file_id: The ID of the file
            file_type: The type of file
            user_id: The ID of the user
            
        Returns:
            The file
            
        Raises:
            NotFoundException: If the file is not found
            ForbiddenException: If the user does not own the file
            ServiceException: If the operation fails
        """
        logger.info(f"Getting {file_type.value} file with ID: {file_id} for user ID: {user_id}")
        try:
            # First find tracks with this file attached
            field_name = self._track_field_mapping.get(file_type)
            if not field_name:
                raise ValueError(f"Unsupported file type: {file_type}")
            
            # Get the track that contains this file
            tracks = await self.track_repository.get_by_file_id(file_id, file_type)
            
            if not tracks:
                logger.error(f"{file_type.value.capitalize()} file {file_id} not found")
                raise NotFoundException(f"{file_type.value.capitalize()} file", file_id)
            
            # Check if any of these tracks belong to the user
            user_track = None
            for track in tracks:
                if track.user_id == user_id:
                    user_track = track
                    break
            
            if not user_track:
                logger.error(f"User {user_id} does not own any track with {file_type.value} file {file_id}")
                raise ForbiddenException(f"You do not have permission to access this {file_type.value} file")
            
            # Get the file from the file repository
            file = await self.file_repository.get_by_id(file_id, file_type)
            
            if not file:
                logger.error(f"{file_type.value.capitalize()} file {file_id} not found")
                raise NotFoundException(f"{file_type.value.capitalize()} file", file_id)
            
            logger.info(f"Found {file_type.value} file with ID: {file_id} for user ID: {user_id}")
            
            # Convert to read model if available
            read_model = self._file_read_models.get(file_type)
            if read_model:
                return read_model.model_validate(file)
            else:
                return file
        except Exception as e:
            if isinstance(e, (NotFoundException, ForbiddenException)):
                raise
            logger.error(f"Error getting {file_type.value} file: {str(e)}")
            logger.error(traceback.format_exc())
            raise ServiceException(f"Failed to get {file_type.value} file: {str(e)}")
    
    async def create_track(self, user_id: uuid.UUID, track_data: Dict[str, Any], file_type: FileType) -> TrackRead:
        """
        Create a new track
        
        Args:
            user_id: The ID of the user
            track_data: The track data
            
        Returns:
            The created track
            
        Raises:
            ServiceException: If the operation fails
        """
        logger.info(f"Creating track for user ID: {user_id}")
        try:
            # Add user ID
            create_track_req = track_data.model_dump()
            create_track_req["user_id"] = user_id
            
            # Process the track data based on track type if needed
            track_type = create_track_req.get("type")
            if track_type:
                # Additional processing for different track types could go here
                pass
            
            # Create the track
            track = await self.track_repository.create(create_track_req, file_type)
            
            logger.info(f"Created track with ID: {track.id} for user ID: {user_id}")
            return TrackRead.model_validate(track)
        except Exception as e:
            logger.error(f"Error creating track: {str(e)}")
            logger.error(traceback.format_exc())
            raise ServiceException(f"Failed to create track: {str(e)}")
    
    async def update_track(self, track_id: uuid.UUID, user_id: uuid.UUID, track_data: Dict[str, Any]) -> TrackRead:
        """
        Update a track
        
        Args:
            track_id: The ID of the track
            user_id: The ID of the user
            track_data: The updated track data
            
        Returns:
            The updated track
            
        Raises:
            NotFoundException: If the track is not found
            ForbiddenException: If the user does not own the track
            ServiceException: If the operation fails
        """
        logger.info(f"Updating track with ID: {track_id} for user ID: {user_id}")
        try:
            # First get the track (ensures it exists and user has access)
            existing_track = await self.get_track(track_id, user_id)
            
            # Update the track
            updated_track = await self.track_repository.update(track_id, track_data)
            
            logger.info(f"Updated track with ID: {track_id} for user ID: {user_id}")
            return TrackRead.model_validate(updated_track)
        except Exception as e:
            if isinstance(e, (NotFoundException, ForbiddenException)):
                raise
            logger.error(f"Error updating track: {str(e)}")
            logger.error(traceback.format_exc())
            raise ServiceException(f"Failed to update track: {str(e)}")
    
    async def delete_track(self, track_id: uuid.UUID, user_id: uuid.UUID) -> bool:
        """
        Delete a track
        
        Args:
            track_id: The ID of the track
            user_id: The ID of the user
            
        Returns:
            True if the track was deleted
            
        Raises:
            NotFoundException: If the track is not found
            ForbiddenException: If the user does not own the track
            ServiceException: If the operation fails
        """
        logger.info(f"Deleting track with ID: {track_id} for user ID: {user_id}")
        try:
            # First get the track (ensures it exists and user has access)
            existing_track = await self.get_track(track_id, user_id)
            
            # Delete the track
            result = await self.track_repository.delete(track_id)
            
            logger.info(f"Deleted track with ID: {track_id} for user ID: {user_id}")
            return result
        except Exception as e:
            if isinstance(e, (NotFoundException, ForbiddenException)):
                raise
            logger.error(f"Error deleting track: {str(e)}")
            logger.error(traceback.format_exc())
            raise ServiceException(f"Failed to delete track: {str(e)}")
    
    async def create_upload_url(self, file_name: str, file_id: uuid.UUID, user_id: uuid.UUID, file_type: FileType) -> Dict[str, str]:
        """
        Create a signed URL for uploading a file
        
        Args:
            file_name: The name of the file to upload
            file_id: The ID of the file
            user_id: The ID of the user
            file_type: The type of file
            
        Returns:
            A dictionary with the upload URL and storage key
            
        Raises:
            ServiceException: If the operation fails
        """
        logger.info(f"Creating upload URL for {file_type.value} file {file_name} for user ID: {user_id}")
        try:
            # Forward to the file repository to handle this
            result = await self.file_repository.create_upload_url(file_name, file_id, user_id, file_type)
            
            logger.info(f"Created upload URL for {file_type.value} file {file_name} for user ID: {user_id}")
            return result
        except Exception as e:
            logger.error(f"Error creating upload URL: {str(e)}")
            logger.error(traceback.format_exc())
            raise ServiceException(f"Failed to create upload URL: {str(e)}")