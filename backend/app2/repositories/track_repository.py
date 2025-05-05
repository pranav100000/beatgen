"""
Track repository for database operations using SQLModel
Handles basic CRUD operations for track entities
"""

from typing import Dict, Any, List, Union
from sqlmodel import Session, select
from sqlalchemy.orm import joinedload
import traceback
import uuid

from app2.core.exceptions import DatabaseException, NotFoundException
from app2.core.logging import get_repository_logger
from app2.types.track_types import TrackType
from app2.types.file_types import FileType
from app2.models.track_models.audio_track import AudioTrack
from app2.models.track_models.midi_track import MidiTrack
from app2.models.track_models.sampler_track import SamplerTrack
from app2.models.track_models.drum_track import DrumTrack


Track = Union[AudioTrack, MidiTrack, SamplerTrack, DrumTrack]

class TrackRepository:
    """Repository for track operations"""

    def __init__(self, session: Session):
        """
        Initialize the repository with database session

        Args:
            session: The SQLModel session for database operations
        """
        self.session = session
        self.logger = get_repository_logger("track")

        # Map file types to their track field names
        self._file_field_mapping = {
            FileType.AUDIO: "audio_file_id",
            FileType.MIDI: "midi_file_id",
            FileType.INSTRUMENT: "instrument_id",
        }

        # Map track fields to their relationship attributes
        self._relationship_mapping = {
            "audio_file_id": "audio_file",
            "midi_file_id": "midi_file",
            "instrument_id": "instrument_file",
        }

    def _get_file_field(self, file_type: FileType) -> str:
        """Get the track field name for a file type"""
        field = self._file_field_mapping.get(file_type)
        if not field:
            raise ValueError(f"Unsupported file type: {file_type}")
        return field

    async def get_by_id(
        self, track_id: uuid.UUID
    ) -> Union[AudioTrack, MidiTrack, SamplerTrack, DrumTrack]:
        """
        Get a track by ID

        Args:
            track_id: The ID of the track

        Returns:
            The track

        Raises:
            NotFoundException: If the track is not found
            DatabaseException: If there's a database error
        """
        self.logger.info(f"Getting track with ID: {track_id}")
        try:
            statement = select(Track).where(Track.id == track_id)
            track = self.session.exec(statement).first()

            if not track:
                self.logger.error(f"Track with ID {track_id} not found")
                raise NotFoundException("Track", track_id)

            self.logger.info(f"Found track with ID: {track_id}")
            return track
        except Exception as e:
            if isinstance(e, NotFoundException):
                raise
            self.logger.error(f"Error getting track: {str(e)}")
            self.logger.error(traceback.format_exc())
            raise DatabaseException(f"Failed to get track: {str(e)}")

    async def get_with_files(
        self, track_id: uuid.UUID
    ) -> Union[AudioTrack, MidiTrack, SamplerTrack, DrumTrack]:
        """
        Get a track by ID with its files loaded

        Args:
            track_id: The ID of the track

        Returns:
            The track with files loaded

        Raises:
            NotFoundException: If the track is not found
            DatabaseException: If there's a database error
        """
        self.logger.info(f"Getting track with ID: {track_id} with files")
        try:
            statement = (
                select(Track)
                .options(
                    joinedload(Track.audio_file),
                    joinedload(Track.midi_file),
                    joinedload(Track.instrument_file),
                )
                .where(Track.id == track_id)
            )

            track = self.session.exec(statement).first()

            if not track:
                self.logger.error(f"Track with ID {track_id} not found")
                raise NotFoundException("Track", track_id)

            self.logger.info(f"Found track with ID: {track_id} with files")
            return track
        except Exception as e:
            if isinstance(e, NotFoundException):
                raise
            self.logger.error(f"Error getting track with files: {str(e)}")
            self.logger.error(traceback.format_exc())
            raise DatabaseException(f"Failed to get track with files: {str(e)}")

    async def get_all(
        self, **filters
    ) -> List[Union[AudioTrack, MidiTrack, SamplerTrack, DrumTrack]]:
        """
        Get all tracks with optional filters

        Args:
            **filters: Optional filter criteria (e.g., user_id=uuid)

        Returns:
            List of tracks

        Raises:
            DatabaseException: If there's a database error
        """
        filter_str = ", ".join(f"{k}={v}" for k, v in filters.items())
        self.logger.info(f"Getting tracks with filters: {filter_str}")
        try:
            # Build query with filters
            query = select(Track)
            for key, value in filters.items():
                if hasattr(Track, key):
                    query = query.where(getattr(Track, key) == value)

            # Execute query
            results = self.session.exec(query).all()

            self.logger.info(f"Found {len(results)} tracks")
            return results
        except Exception as e:
            self.logger.error(f"Error getting tracks: {str(e)}")
            self.logger.error(traceback.format_exc())
            raise DatabaseException(f"Failed to get tracks: {str(e)}")

    async def get_by_user_id(
        self, user_id: uuid.UUID
    ) -> List[Union[AudioTrack, MidiTrack, SamplerTrack, DrumTrack]]:
        """
        Get all tracks for a user

        Args:
            user_id: The ID of the user

        Returns:
            List of tracks

        Raises:
            DatabaseException: If there's a database error
        """
        self.logger.info(f"Getting tracks for user: {user_id}")
        try:
            return await self.get_all(user_id=user_id)
        except Exception as e:
            self.logger.error(f"Error getting tracks for user: {str(e)}")
            self.logger.error(traceback.format_exc())
            raise DatabaseException(f"Failed to get tracks for user: {str(e)}")

    async def get_by_file_id(
        self, file_id: uuid.UUID, file_type: FileType
    ) -> List[Union[AudioTrack, MidiTrack, SamplerTrack, DrumTrack]]:
        """
        Get all tracks that reference a specific file

        Args:
            file_id: The ID of the file
            file_type: The type of file

        Returns:
            List of tracks

        Raises:
            DatabaseException: If there's a database error
        """
        self.logger.info(f"Getting tracks for {file_type.value} file: {file_id}")
        try:
            field_name = self._get_file_field(file_type)

            statement = select(Track).where(getattr(Track, field_name) == file_id)
            tracks = self.session.exec(statement).all()

            self.logger.info(
                f"Found {len(tracks)} tracks for {file_type.value} file: {file_id}"
            )
            return tracks
        except Exception as e:
            if isinstance(e, ValueError):
                raise
            self.logger.error(f"Error getting tracks by file ID: {str(e)}")
            self.logger.error(traceback.format_exc())
            raise DatabaseException(f"Failed to get tracks by file ID: {str(e)}")

    async def create(
        self, track_data: Dict[str, Any], track_type: TrackType
    ) -> Union[AudioTrack, MidiTrack, SamplerTrack, DrumTrack]:
        """
        Create a new track

        Args:
            track_data: The track data

        Returns:
            The created track

        Raises:
            DatabaseException: If there's a database error
        """
        self.logger.info("Creating new track")
        self.logger.info(f"Track data: {track_data}")
        try:
            # Ensure the correct type is in the data dictionary
            track_data_with_type = track_data.copy()
            track_data_with_type["type"] = track_type

            # Create track instance using the dictionary with the type included
            track = Track(**track_data_with_type)

            # Add to session and commit
            self.session.add(track)
            self.session.commit()
            self.session.refresh(track)

            self.logger.info(f"Created track with ID: {track.id}")
            return track
        except Exception as e:
            self.session.rollback()
            self.logger.error(f"Error creating track: {str(e)}")
            self.logger.error(traceback.format_exc())
            raise DatabaseException(f"Failed to create track: {str(e)}")

    async def update(
        self, track_id: uuid.UUID, track_data: Dict[str, Any]
    ) -> Union[AudioTrack, MidiTrack, SamplerTrack, DrumTrack]:
        """
        Update a track

        Args:
            track_id: The ID of the track
            track_data: The updated data

        Returns:
            The updated track

        Raises:
            NotFoundException: If the track is not found
            DatabaseException: If there's a database error
        """
        self.logger.info(f"Updating track with ID: {track_id}")
        try:
            # First check if track exists
            track = await self.get_by_id(track_id)

            # Update fields
            for key, value in track_data.items():
                if hasattr(track, key):
                    setattr(track, key, value)

            # Commit changes
            self.session.add(track)
            self.session.commit()
            self.session.refresh(track)

            self.logger.info(f"Updated track with ID: {track_id}")
            return track
        except Exception as e:
            self.session.rollback()
            if isinstance(e, NotFoundException):
                raise
            self.logger.error(f"Error updating track: {str(e)}")
            self.logger.error(traceback.format_exc())
            raise DatabaseException(f"Failed to update track: {str(e)}")

    async def delete(self, track_id: uuid.UUID) -> bool:
        """
        Delete a track

        Args:
            track_id: The ID of the track

        Returns:
            True if successful

        Raises:
            NotFoundException: If the track is not found
            DatabaseException: If there's a database error
        """
        self.logger.info(f"Deleting track with ID: {track_id}")
        try:
            # First check if track exists
            track = await self.get_by_id(track_id)

            # Delete the track
            self.session.delete(track)
            self.session.commit()

            self.logger.info(f"Deleted track with ID: {track_id}")
            return True
        except Exception as e:
            self.session.rollback()
            if isinstance(e, NotFoundException):
                raise
            self.logger.error(f"Error deleting track: {str(e)}")
            self.logger.error(traceback.format_exc())
            raise DatabaseException(f"Failed to delete track: {str(e)}")
