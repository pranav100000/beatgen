"""
Service for track operations with specialized track models
"""

from typing import Dict, Any, List, Union, Type
import traceback
import uuid

from app2.core.logging import get_service_logger
from app2.core.exceptions import (
    ServiceException,
    NotFoundException,
    ForbiddenException,
)
from app2.repositories.audio_track_repository import AudioTrackRepository
from app2.repositories.midi_track_repository import MidiTrackRepository
from app2.repositories.sampler_track_repository import SamplerTrackRepository
from app2.repositories.drum_track_repository import DrumTrackRepository
from app2.repositories.file_repository import FileRepository
from app2.repositories.project_track_repository import ProjectTrackRepository

from app2.types.track_types import TrackType
from app2.types.file_types import FileType

from app2.models.track_models.audio_track import (
    AudioTrackRead,
)
from app2.models.track_models.midi_track import (
    MidiTrackRead,
    MidiTrackCreate,
)
from app2.models.track_models.sampler_track import (
    SamplerTrackRead,
)
from app2.models.track_models.drum_track import (
    DrumTrackRead,
)

logger = get_service_logger("track")

# Type for all track read models
AnyTrackRead = Union[AudioTrackRead, MidiTrackRead, SamplerTrackRead, DrumTrackRead]


class TrackService:
    """Service for track operations with specialized track models"""

    def __init__(
        self,
        audio_repository: AudioTrackRepository,
        midi_repository: MidiTrackRepository,
        sampler_repository: SamplerTrackRepository,
        drum_repository: DrumTrackRepository,
        project_track_repository: ProjectTrackRepository,
        file_repository: FileRepository,
    ):
        """
        Initialize the service with repositories

        Args:
            audio_repository: Repository for audio tracks
            midi_repository: Repository for MIDI tracks
            sampler_repository: Repository for sampler tracks
            drum_repository: Repository for drum tracks
            project_track_repository: Repository for project-track associations
            file_repository: Repository for file operations
        """
        self.audio_repository = audio_repository
        self.midi_repository = midi_repository
        self.sampler_repository = sampler_repository
        self.drum_repository = drum_repository
        self.project_track_repository = project_track_repository
        self.file_repository = file_repository

    async def get_user_tracks(
        self, user_id: uuid.UUID, requested_track_type: TrackType = None
    ) -> Dict[str, List[AnyTrackRead]]:
        """
        Get all tracks for a user, organized by track type.
        If a specific track type is provided, only tracks of that type are returned.

        Args:
            user_id: The ID of the user
            requested_track_type: Optional. The specific type of tracks to retrieve.

        Returns:
            A dictionary with track types as keys and lists of tracks as values

        Raises:
            ServiceException: If the operation fails
        """
        logger.info(f"Getting tracks for user ID: {user_id}{f' of type {requested_track_type.value}' if requested_track_type else ''}")
        try:
            result: Dict[str, List[AnyTrackRead]] = {}

            # Map TrackType to its repository and Pydantic read model
            track_config = {
                TrackType.AUDIO: (self.audio_repository, AudioTrackRead),
                TrackType.MIDI: (self.midi_repository, MidiTrackRead),
                TrackType.SAMPLER: (self.sampler_repository, SamplerTrackRead),
                TrackType.DRUM: (self.drum_repository, DrumTrackRead),
            }

            async def fetch_and_store_tracks(
                track_type_enum: TrackType,
                repository: Union[AudioTrackRepository, MidiTrackRepository, SamplerTrackRepository, DrumTrackRepository],
                read_model: Union[Type[AudioTrackRead], Type[MidiTrackRead], Type[SamplerTrackRead], Type[DrumTrackRead]]
            ):
                tracks = await repository.get_by_user_id(user_id)
                validated_tracks = [read_model.model_validate(track) for track in tracks]
                result[track_type_enum.value] = validated_tracks
                return len(validated_tracks)

            if requested_track_type is not None:  # Specific track type requested
                if requested_track_type not in track_config:
                    logger.error(f"Unsupported track type requested: {requested_track_type}")
                    raise ServiceException(f"Unsupported track type: {requested_track_type.value}")
                
                repo, model = track_config[requested_track_type]
                count = await fetch_and_store_tracks(requested_track_type, repo, model)
                logger.info(f"Found {count} {requested_track_type.value} tracks for user ID: {user_id}")
                return result
            else:  # No specific type, fetch all track types
                total_tracks = 0
                for t_type, (repo, model) in track_config.items():
                    total_tracks += await fetch_and_store_tracks(t_type, repo, model)
                
                logger.info(f"Found {total_tracks} tracks for user ID: {user_id}")
                return result

        except Exception as e:
            logger.error(f"Error getting user tracks: {str(e)}")
            logger.error(traceback.format_exc())
            raise ServiceException(f"Failed to get user tracks: {str(e)}")

    async def get_track(
        self, track_id: uuid.UUID, track_type: TrackType, user_id: uuid.UUID
    ) -> AnyTrackRead:
        """
        Get a track by ID and type

        Args:
            track_id: The ID of the track
            track_type: The type of the track
            user_id: The ID of the user (for permission check)

        Returns:
            The track

        Raises:
            NotFoundException: If the track is not found
            ForbiddenException: If the user does not own the track
            ServiceException: If the operation fails
        """
        logger.info(
            f"Getting {track_type.value} track with ID: {track_id} for user ID: {user_id}"
        )
        try:
            # Get the track based on type
            track = None

            if track_type == TrackType.AUDIO:
                track = await self.audio_repository.get(track_id)
                if track:
                    track_read = AudioTrackRead.model_validate(track)
            elif track_type == TrackType.MIDI:
                track = await self.midi_repository.get(track_id)
                if track:
                    track_read = MidiTrackRead.model_validate(track)
            elif track_type == TrackType.SAMPLER:
                track = await self.sampler_repository.get(track_id)
                if track:
                    track_read = SamplerTrackRead.model_validate(track)
            elif track_type == TrackType.DRUM:
                track = await self.drum_repository.get(track_id)
                if track:
                    track_read = DrumTrackRead.model_validate(track)
            else:
                raise ValueError(f"Invalid track type: {track_type}")

            # Check if track exists
            if not track:
                logger.error(f"{track_type.value} track with ID {track_id} not found")
                raise NotFoundException(f"{track_type.value} track", str(track_id))

            # Verify track ownership
            if track.user_id != user_id:
                logger.error(
                    f"User {user_id} does not own {track_type.value} track {track_id}"
                )
                raise ForbiddenException(
                    f"You do not have permission to access this {track_type.value} track"
                )

            logger.info(
                f"Found {track_type.value} track with ID: {track_id} for user ID: {user_id}"
            )
            return track_read
        except Exception as e:
            if isinstance(e, (NotFoundException, ForbiddenException)):
                raise
            logger.error(f"Error getting {track_type.value} track: {str(e)}")
            logger.error(traceback.format_exc())
            raise ServiceException(f"Failed to get {track_type.value} track: {str(e)}")

    async def create_audio_track(
        self, user_id: uuid.UUID, track_data: Dict[str, Any]
    ) -> AudioTrackRead:
        """
        Create a new audio track

        Args:
            user_id: The ID of the user
            track_data: The track data

        Returns:
            The created audio track

        Raises:
            ServiceException: If the operation fails
        """
        logger.info(f"Creating audio track for user ID: {user_id}")
        try:
            # Add user ID
            track_data["user_id"] = user_id
            track_data["type"] = TrackType.AUDIO

            # Create the track
            try:
                track = await self.audio_repository.create(track_data)
            except Exception:
                logger.info(
                    f"Audio track already with ID: {track_data['id']} exists. Updating track."
                )
                track = await self.audio_repository.update(track_data["id"], track_data)

            logger.info(
                f"Created audio track with ID: {track.id} for user ID: {user_id}"
            )
            return AudioTrackRead.model_validate(track)
        except Exception as e:
            logger.error(f"Error creating audio track: {str(e)}")
            logger.error(traceback.format_exc())
            raise ServiceException(f"Failed to create audio track: {str(e)}")

    async def create_midi_track(
        self, user_id: uuid.UUID, midi_track_data: MidiTrackCreate
    ) -> MidiTrackRead:
        """
        Create a new MIDI track

        Args:
            user_id: The ID of the user
            track_data: The track data

        Returns:
            The created MIDI track

        Raises:
            ServiceException: If the operation fails
        """
        logger.info(f"Creating MIDI track for user ID: {user_id}")
        try:
            # Add user ID
            midi_track_data["user_id"] = user_id
            midi_track_data["type"] = TrackType.MIDI

            # Validate required fields
            if "instrument_id" not in midi_track_data:
                raise ValueError("MIDI tracks require an instrument_id")

            # Create the track
            logger.info(f"Creating MIDI track with data: {midi_track_data}")
            try:
                track = await self.midi_repository.create(midi_track_data)
            except Exception:
                logger.info(
                    f"MIDI track already with ID: {midi_track_data['id']} exists. Updating track."
                )
                track = await self.midi_repository.update(
                    midi_track_data["id"], midi_track_data
                )

            logger.info(
                f"Created MIDI track with ID: {track.id} for user ID: {user_id}"
            )
            return MidiTrackRead.model_validate(track)
        except Exception as e:
            logger.error(f"Error creating MIDI track: {str(e)}")
            logger.error(traceback.format_exc())
            raise ServiceException(f"Failed to create MIDI track: {str(e)}")

    async def create_sampler_track(
        self, user_id: uuid.UUID, track_data: Dict[str, Any]
    ) -> SamplerTrackRead:
        """
        Create a new sampler track

        Args:
            user_id: The ID of the user
            track_data: The track data

        Returns:
            The created sampler track

        Raises:
            ServiceException: If the operation fails
        """
        logger.info(f"Creating sampler track for user ID: {user_id}")
        logger.info(f"Track data: {track_data}")
        try:
            # Add user ID
            track_data["user_id"] = user_id
            track_data["type"] = TrackType.SAMPLER

            # Validate required fields
            if "audio_storage_key" not in track_data:
                raise ValueError("Sampler tracks require audio_storage_key")

            # Create the track
            try:
                track = await self.sampler_repository.create(track_data)
            except Exception:
                logger.info(
                    f"Sampler track already with ID: {track_data['id']} exists. Updating track."
                )
                track = await self.sampler_repository.update(
                    track_data["id"], track_data
                )

            logger.info(
                f"Created sampler track with ID: {track.id} for user ID: {user_id}"
            )
            return SamplerTrackRead.model_validate(track)
        except Exception as e:
            logger.error(f"Error creating sampler track: {str(e)}")
            logger.error(traceback.format_exc())
            raise ServiceException(f"Failed to create sampler track: {str(e)}")

    async def create_drum_track(
        self, user_id: uuid.UUID, track_data: Dict[str, Any]
    ) -> DrumTrackRead:
        """
        Create a new drum track

        Args:
            user_id: The ID of the user
            track_data: The track data

        Returns:
            The created drum track

        Raises:
            ServiceException: If the operation fails
        """
        logger.info(f"Creating drum track for user ID: {user_id}")
        try:
            # Add user ID
            track_data["user_id"] = user_id
            track_data["type"] = TrackType.DRUM

            # Create the track
            track = await self.drum_repository.create(track_data)

            logger.info(
                f"Created drum track with ID: {track.id} for user ID: {user_id}"
            )
            return DrumTrackRead.model_validate(track)
        except Exception as e:
            logger.error(f"Error creating drum track: {str(e)}")
            logger.error(traceback.format_exc())
            raise ServiceException(f"Failed to create drum track: {str(e)}")

    async def update_track(
        self,
        track_id: uuid.UUID,
        track_type: TrackType,
        user_id: uuid.UUID,
        track_data: Dict[str, Any],
    ) -> AnyTrackRead:
        """
        Update a track

        Args:
            track_id: The ID of the track
            track_type: The type of the track
            user_id: The ID of the user
            track_data: The updated track data

        Returns:
            The updated track

        Raises:
            NotFoundException: If the track is not found
            ForbiddenException: If the user does not own the track
            ServiceException: If the operation fails
        """
        logger.info(
            f"Updating {track_type.value} track with ID: {track_id} for user ID: {user_id}"
        )
        try:
            # First get the track (ensures it exists and user has access)
            await self.get_track(track_id, track_type, user_id)

            # Update the track based on type
            updated_track = None

            if track_type == TrackType.AUDIO:
                updated_track = await self.audio_repository.update(track_id, track_data)
                track_read = AudioTrackRead.model_validate(updated_track)
            elif track_type == TrackType.MIDI:
                updated_track = await self.midi_repository.update(track_id, track_data)
                track_read = MidiTrackRead.model_validate(updated_track)
            elif track_type == TrackType.SAMPLER:
                updated_track = await self.sampler_repository.update(
                    track_id, track_data
                )
                track_read = SamplerTrackRead.model_validate(updated_track)
            elif track_type == TrackType.DRUM:
                updated_track = await self.drum_repository.update(track_id, track_data)
                track_read = DrumTrackRead.model_validate(updated_track)
            else:
                raise ValueError(f"Invalid track type: {track_type}")

            logger.info(
                f"Updated {track_type.value} track with ID: {track_id} for user ID: {user_id}"
            )
            return track_read
        except Exception as e:
            if isinstance(e, (NotFoundException, ForbiddenException)):
                raise
            logger.error(f"Error updating {track_type.value} track: {str(e)}")
            logger.error(traceback.format_exc())
            raise ServiceException(
                f"Failed to update {track_type.value} track: {str(e)}"
            )

    async def delete_track(
        self, track_id: uuid.UUID, track_type: TrackType, user_id: uuid.UUID
    ) -> bool:
        """
        Delete a track

        Args:
            track_id: The ID of the track
            track_type: The type of the track
            user_id: The ID of the user

        Returns:
            True if the track was deleted

        Raises:
            NotFoundException: If the track is not found
            ForbiddenException: If the user does not own the track
            ServiceException: If the operation fails
        """
        logger.info(
            f"Deleting {track_type.value} track with ID: {track_id} for user ID: {user_id}"
        )
        try:
            # First get the track (ensures it exists and user has access)
            await self.get_track(track_id, track_type, user_id)

            # Delete all project associations for this track
            await self.project_track_repository.delete_by_track(track_type, track_id)

            # Delete the track based on type
            result = False

            if track_type == TrackType.AUDIO:
                result = await self.audio_repository.delete(track_id)
            elif track_type == TrackType.MIDI:
                result = await self.midi_repository.delete(track_id)
            elif track_type == TrackType.SAMPLER:
                result = await self.sampler_repository.delete(track_id)
            elif track_type == TrackType.DRUM:
                result = await self.drum_repository.delete(track_id)
            else:
                raise ValueError(f"Invalid track type: {track_type}")

            logger.info(
                f"Deleted {track_type.value} track with ID: {track_id} for user ID: {user_id}"
            )
            return result
        except Exception as e:
            if isinstance(e, (NotFoundException, ForbiddenException)):
                raise
            logger.error(f"Error deleting {track_type.value} track: {str(e)}")
            logger.error(traceback.format_exc())
            raise ServiceException(
                f"Failed to delete {track_type.value} track: {str(e)}"
            )

    async def create_upload_url(
        self,
        file_name: str,
        file_id: uuid.UUID,
        user_id: uuid.UUID,
        file_type: FileType,
    ) -> Dict[str, str]:
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
        logger.info(
            f"Creating upload URL for {file_type.value} file {file_name} for user ID: {user_id}"
        )
        try:
            # Forward to the file repository to handle this
            result = await self.file_repository.create_upload_url(
                file_name, file_id, user_id, file_type
            )

            logger.info(
                f"Created upload URL for {file_type.value} file {file_name} for user ID: {user_id}"
            )
            return result
        except Exception as e:
            logger.error(f"Error creating upload URL: {str(e)}")
            logger.error(traceback.format_exc())
            raise ServiceException(f"Failed to create upload URL: {str(e)}")

    async def add_track_to_project(
        self,
        project_id: uuid.UUID,
        track_type: TrackType,
        track_id: uuid.UUID,
        user_id: uuid.UUID,
        settings: Dict[str, Any],
    ) -> Dict[str, Any]:
        """
        Add a track to a project

        Args:
            project_id: The ID of the project
            track_type: The type of the track
            track_id: The ID of the track
            user_id: The ID of the user
            settings: Project-track settings (volume, pan, position, etc.)

        Returns:
            The project-track association data

        Raises:
            NotFoundException: If the track or project is not found
            ForbiddenException: If the user does not own the track or project
            ServiceException: If the operation fails
        """
        logger.info(
            f"Adding {track_type.value} track {track_id} to project {project_id} for user {user_id}"
        )
        try:
            # First verify track access
            track = await self.get_track(track_id, track_type, user_id)

            # Create project-track association data
            project_track_data = {
                "project_id": project_id,
                "track_type": track_type,
                **settings,
            }

            # Set track_id directly (not using type-specific foreign keys)
            project_track_data["track_id"] = track_id

            # Create the association
            project_track = await self.project_track_repository.create(
                project_track_data
            )

            # Get track data with settings
            # Note: ProjectTrack uses a composite primary key (project_id, track_id), not a single id field
            result = {
                "project_id": project_id,
                "track_type": track_type,
                "track_id": track_id,
                "track": track,
                **{k: getattr(project_track, k) for k in settings.keys()},
            }

            logger.info(
                f"Added {track_type.value} track {track_id} to project {project_id}"
            )
            return result
        except Exception as e:
            if isinstance(e, (NotFoundException, ForbiddenException)):
                raise
            logger.error(f"Error adding track to project: {str(e)}")
            logger.error(traceback.format_exc())
            raise ServiceException(f"Failed to add track to project: {str(e)}")

    async def remove_track_from_project(
        self,
        project_id: uuid.UUID,
        track_type: TrackType,
        track_id: uuid.UUID,
        user_id: uuid.UUID,
    ) -> bool:
        """
        Remove a track from a project

        Args:
            project_id: The ID of the project
            track_type: The type of the track
            track_id: The ID of the track
            user_id: The ID of the user

        Returns:
            True if the track was removed from the project

        Raises:
            NotFoundException: If the track or project is not found
            ForbiddenException: If the user does not own the track or project
            ServiceException: If the operation fails
        """
        logger.info(
            f"Removing {track_type.value} track {track_id} from project {project_id} for user {user_id}"
        )
        try:
            # First verify track access
            await self.get_track(track_id, track_type, user_id)

            # Delete the association
            result = await self.project_track_repository.delete(
                project_id, track_type, track_id
            )

            logger.info(
                f"Removed {track_type.value} track {track_id} from project {project_id}"
            )
            return result
        except Exception as e:
            if isinstance(e, (NotFoundException, ForbiddenException)):
                raise
            logger.error(f"Error removing track from project: {str(e)}")
            logger.error(traceback.format_exc())
            raise ServiceException(f"Failed to remove track from project: {str(e)}")

    async def update_track_project_settings(
        self,
        project_id: uuid.UUID,
        track_type: TrackType,
        track_id: uuid.UUID,
        user_id: uuid.UUID,
        settings: Dict[str, Any],
    ) -> Dict[str, Any]:
        """
        Update project-specific settings for a track

        Args:
            project_id: The ID of the project
            track_type: The type of the track
            track_id: The ID of the track
            user_id: The ID of the user
            settings: Updated project-track settings (volume, pan, position, etc.)

        Returns:
            The updated project-track association data

        Raises:
            NotFoundException: If the track or project is not found
            ForbiddenException: If the user does not own the track or project
            ServiceException: If the operation fails
        """
        logger.info(
            f"Updating settings for {track_type.value} track {track_id} in project {project_id}"
        )
        try:
            # First verify track access
            track = await self.get_track(track_id, track_type, user_id)

            # Update the association
            project_track = await self.project_track_repository.update(
                project_id, track_type, track_id, settings
            )

            # Get track data with updated settings
            # Note: ProjectTrack uses a composite primary key (project_id, track_id), not a single id field
            result = {
                "project_id": project_id,
                "track_type": track_type,
                "track_id": track_id,
                "track": track,
                **{k: getattr(project_track, k) for k in settings.keys()},
            }

            logger.info(
                f"Updated settings for {track_type.value} track {track_id} in project {project_id}"
            )
            return result
        except Exception as e:
            if isinstance(e, (NotFoundException, ForbiddenException)):
                raise
            logger.error(f"Error updating track project settings: {str(e)}")
            logger.error(traceback.format_exc())
            raise ServiceException(f"Failed to update track project settings: {str(e)}")
