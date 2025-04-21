"""
Service for project operations with specialized track models
"""
from typing import Dict, Any, List, Optional, Union, Type, TypeVar, Tuple
from enum import Enum
import traceback
from datetime import datetime
import uuid

from app2.core.logging import get_service_logger
from app2.core.exceptions import ServiceException, NotFoundException, ForbiddenException
from app2.repositories.project_repository import ProjectRepository
from app2.repositories.project_track_repository import ProjectTrackRepository
from app2.repositories.audio_track_repository import AudioTrackRepository
from app2.repositories.midi_track_repository import MidiTrackRepository
from app2.repositories.sampler_track_repository import SamplerTrackRepository
from app2.repositories.drum_track_repository import DrumTrackRepository
from app2.models.project import Project, ProjectWithTracks, ProjectRead, CombinedTrack
from app2.models.project_track import ProjectTrack
from app2.types.track_types import TrackType
from app2.types.file_types import FileType
from app2.services.track_service import TrackService

logger = get_service_logger("project")

class ProjectService:
    """Service for project operations with the new track model structure"""
    
    def __init__(
        self, 
        project_repository: ProjectRepository,
        project_track_repository: ProjectTrackRepository,
        track_service: TrackService
    ):
        """
        Initialize the service with repositories and services
        
        Args:
            project_repository: The repository for project operations
            project_track_repository: The repository for project-track relationship operations
            track_service: The service for track operations
        """
        self.project_repository = project_repository
        self.project_track_repository = project_track_repository
        self.track_service = track_service
        
    async def get_user_projects(self, user_id: uuid.UUID) -> List[ProjectRead]:
        """
        Get all projects for a user
        
        Args:
            user_id: The ID of the user
            
        Returns:
            A list of projects
            
        Raises:
            ServiceException: If the operation fails
        """
        logger.info(f"Getting projects for user ID: {user_id}")
        try:
            projects = await self.project_repository.get_by_user_id(user_id)
            logger.info(f"Found {len(projects)} projects for user ID: {user_id}")
            
            # Convert SQLModel objects to API models
            return [ProjectRead.model_validate(project) for project in projects]
        except Exception as e:
            logger.error(f"Error getting user projects: {str(e)}")
            logger.error(traceback.format_exc())
            raise ServiceException(f"Failed to get user projects: {str(e)}")
            
    async def get_project(self, project_id: uuid.UUID, user_id: uuid.UUID) -> ProjectWithTracks:
        """
        Get a project by ID with all its tracks
        
        Args:
            project_id: The ID of the project
            user_id: The ID of the user
            
        Returns:
            The project with tracks
            
        Raises:
            NotFoundException: If the project is not found
            ForbiddenException: If the user does not own the project
            ServiceException: If the operation fails
        """
        logger.info(f"Getting project with ID: {project_id} for user ID: {user_id}")
        try:
            # Get the project
            project = await self.project_repository.get_by_id(project_id)
            if not project:
                logger.error(f"Project with ID {project_id} not found")
                raise NotFoundException("Project", str(project_id))
                
            # Verify project ownership
            if project.user_id != user_id:
                logger.error(f"User {user_id} does not own project {project_id}")
                raise ForbiddenException("You do not have permission to access this project")
                
            # Get all tracks with their project-specific settings
            tracks_with_settings = await self.project_track_repository.get_track_with_settings(project_id)
            logger.info(f"tracks_with_settings: {tracks_with_settings}")
            # Create CombinedTrack objects
            combined_tracks = []
            for track_data in tracks_with_settings:
                if "track" in track_data and track_data["track"]:
                    # Create a combined track with all data
                    combined_track = CombinedTrack(
                        id=track_data["track_id"],
                        name=track_data["name"],
                        type=track_data["track_type"],
                        # Project-specific track properties
                        volume=track_data["volume"],
                        pan=track_data["pan"],
                        mute=track_data["mute"],
                        x_position=track_data["x_position"],
                        y_position=track_data["y_position"],
                        trim_start_ticks=track_data["trim_start_ticks"],
                        trim_end_ticks=track_data["trim_end_ticks"],
                        duration_ticks=track_data["duration_ticks"],
                        track_number=track_data["track_number"],
                        # Specialized track data
                        track=track_data["track"]
                    )
                    combined_tracks.append(combined_track)
            
            # Create the ProjectWithTracks response model
            result = ProjectWithTracks(
                id=project.id,
                name=project.name,
                bpm=project.bpm,
                time_signature_numerator=project.time_signature_numerator,
                time_signature_denominator=project.time_signature_denominator,
                key_signature=project.key_signature,
                user_id=project.user_id,
                tracks=combined_tracks
            )
            
            logger.info(f"Found project with ID: {project_id} with {len(combined_tracks)} tracks")
            return result
        except Exception as e:
            if isinstance(e, (NotFoundException, ForbiddenException)):
                raise
            logger.error(f"Error getting project: {str(e)}")
            logger.error(traceback.format_exc())
            raise ServiceException(f"Failed to get project: {str(e)}")
            
    async def create_project(self, user_id: uuid.UUID, project_data: Dict[str, Any]) -> ProjectWithTracks:
        """
        Create a new project
        
        Args:
            user_id: The ID of the user
            project_data: The project data including tracks
            
        Returns:
            The created project with all its tracks
            
        Raises:
            ServiceException: If the operation fails
        """
        logger.info(f"Creating project for user ID: {user_id}")
        try:
            # Add user ID to project data
            project_data["user_id"] = user_id
            
            # Extract tracks data if present
            tracks_data = project_data.pop("tracks", None)
            
            # Create the project
            project = await self.project_repository.create(project_data)
            logger.info(f"Created project with ID: {project.id} for user ID: {user_id}")
            
            # Add tracks to the project if provided
            if tracks_data and isinstance(tracks_data, list):
                logger.info(f"Adding {len(tracks_data)} tracks to project {project.id}")
                
                for track_idx, track_data in enumerate(tracks_data):
                    if isinstance(track_data, dict) and "type" in track_data:
                        # Set track number if not provided
                        if "track_number" not in track_data:
                            track_data["track_number"] = track_idx
                            
                        # Get track type
                        track_type = TrackType(track_data["type"])
                        
                        # Extract project-track settings
                        project_track_settings = {
                            "name": track_data.get("name", "Unnamed Track"),
                            "track_id": track_data.get("id"),
                            "volume": track_data.get("volume", 1.0),
                            "pan": track_data.get("pan", 0.0),
                            "mute": track_data.get("mute", False),
                            "x_position": track_data.get("x_position", 0.0),
                            "y_position": track_data.get("y_position", 0.0),
                            "trim_start_ticks": track_data.get("trim_start_ticks", 0),
                            "trim_end_ticks": track_data.get("trim_end_ticks", 0),
                            "duration_ticks": track_data.get("duration_ticks", 0),
                            "track_number": track_data.get("track_number", 0)
                        }
                        
                        # Extract track-specific data
                        track_specific_data = {k: v for k, v in track_data.items() 
                                            if k not in project_track_settings.keys() and k != "type"}
                        track_specific_data["id"] = track_data.get("id")
                        
                        logger.info(f"Track specific data: {track_specific_data}")
                        
                        # Create track based on type
                        track_id = None
                        if track_type == TrackType.AUDIO:
                            created_track = await self.track_service.create_audio_track(user_id, track_specific_data)
                            track_id = created_track.id
                        elif track_type == TrackType.MIDI:
                            created_track = await self.track_service.create_midi_track(user_id, track_specific_data)
                            track_id = created_track.id
                        elif track_type == TrackType.SAMPLER:
                            created_track = await self.track_service.create_sampler_track(user_id, track_specific_data)
                            track_id = created_track.id
                        elif track_type == TrackType.DRUM:
                            created_track = await self.track_service.create_drum_track(user_id, track_specific_data)
                            track_id = created_track.id
                            
                        # Add track to project
                        if track_id:
                            await self.track_service.add_track_to_project(
                                project_id=project.id,
                                track_type=track_type,
                                track_id=track_id,
                                user_id=user_id,
                                settings=project_track_settings
                            )
            
            # Get the project with its tracks
            project_with_tracks = await self.get_project(project.id, user_id)
            return project_with_tracks
        except Exception as e:
            logger.error(f"Error creating project: {str(e)}")
            logger.error(traceback.format_exc())
            raise ServiceException(f"Failed to create project: {str(e)}")
                
    async def update_project(self, project_id: uuid.UUID, user_id: uuid.UUID, project_data: Dict[str, Any]) -> ProjectWithTracks:
        """
        Update a project
        
        Args:
            project_id: The ID of the project
            user_id: The ID of the user
            project_data: The updated project data
            
        Returns:
            The updated project with tracks
            
        Raises:
            NotFoundException: If the project is not found
            ForbiddenException: If the user does not own the project
            ServiceException: If the operation fails
        """
        logger.info(f"Updating project with ID: {project_id} for user ID: {user_id}")
        try:
            # First get the project to verify ownership
            project = await self.project_repository.get_by_id(project_id)
            if not project:
                logger.error(f"Project with ID {project_id} not found")
                raise NotFoundException("Project", str(project_id))
                
            # Verify project ownership
            if project.user_id != user_id:
                logger.error(f"User {user_id} does not own project {project_id}")
                raise ForbiddenException("You do not have permission to access this project")
            
            # Extract tracks data if present
            tracks_data = project_data.pop("tracks", None)
            
            # Filter out fields that cannot be updated
            safe_data = {k: v for k, v in project_data.items() if k not in ["id", "user_id", "created_at"]}
            
            # Add updated timestamp
            safe_data["updated_at"] = datetime.utcnow()
            
            # Update the project
            updated_project = await self.project_repository.update(project_id, safe_data)
            
            # Update tracks if provided
            if tracks_data is not None:
                logger.info(f"Updating tracks for project with ID: {project_id}")
                await self.update_project_tracks(project_id, user_id, tracks_data)
            
            # Get the updated project with tracks
            project_with_tracks = await self.get_project(project_id, user_id)
            logger.info(f"Updated project with ID: {project_id}")
            
            return project_with_tracks
        except Exception as e:
            if isinstance(e, (NotFoundException, ForbiddenException)):
                raise
            logger.error(f"Error updating project: {str(e)}")
            logger.error(traceback.format_exc())
            raise ServiceException(f"Failed to update project: {str(e)}")
    
    async def update_project_tracks(self, project_id: uuid.UUID, user_id: uuid.UUID, tracks_data: List[Dict[str, Any]]) -> None:
        """
        Update the tracks of a project
        
        Args:
            project_id: The ID of the project
            user_id: The ID of the user
            tracks_data: List of track data dictionaries
            
        Raises:
            ServiceException: If the operation fails
        """
        logger.info(f"Updating tracks for project with ID: {project_id}, {len(tracks_data)} tracks")
        try:
            # First clear existing project-track associations
            await self.project_track_repository.delete_by_project_id(project_id)
            logger.info(f"Cleared existing project-track associations for project {project_id}")
            
            # Add tracks to the project
            for track_idx, track_data in enumerate(tracks_data):
                if isinstance(track_data, dict) and "id" in track_data and "type" in track_data:
                    # Get track type and ID
                    track_type = TrackType(track_data["type"])
                    track_id = uuid.UUID(track_data["id"])
                    
                    # Set track number if not provided
                    if "track_number" not in track_data:
                        track_data["track_number"] = track_idx
                    
                    # Extract project-track settings
                    project_track_settings = {
                        "name": track_data.get("name", "Unnamed Track"),
                        "track_id": track_data.get("id"),
                        "volume": track_data.get("volume", 1.0),
                        "pan": track_data.get("pan", 0.0),
                        "mute": track_data.get("mute", False),
                        "x_position": track_data.get("x_position", 0.0),
                        "y_position": track_data.get("y_position", 0.0),
                        "trim_start_ticks": track_data.get("trim_start_ticks", 0),
                        "trim_end_ticks": track_data.get("trim_end_ticks", 0),
                        "duration_ticks": track_data.get("duration_ticks", 0),
                        "track_number": track_data.get("track_number", 0)
                    }
                    
                    # Add track to project
                    await self.track_service.add_track_to_project(
                        project_id=project_id,
                        track_type=track_type,
                        track_id=track_id,
                        user_id=user_id,
                        settings=project_track_settings
                    )
                    logger.info(f"Added track {track_id} to project {project_id}")
                else:
                    logger.warning(f"Invalid track data format: {track_data}")
        except Exception as e:
            logger.error(f"Error updating project tracks: {str(e)}")
            logger.error(traceback.format_exc())
            raise ServiceException(f"Failed to update project tracks: {str(e)}")
        
    async def delete_project(self, project_id: uuid.UUID, user_id: uuid.UUID) -> bool:
        """
        Delete a project
        
        Args:
            project_id: The ID of the project
            user_id: The ID of the user
            
        Returns:
            True if the project was deleted
            
        Raises:
            NotFoundException: If the project is not found
            ForbiddenException: If the user does not own the project
            ServiceException: If the operation fails
        """
        logger.info(f"Deleting project with ID: {project_id} for user ID: {user_id}")
        try:
            # First get the project to verify ownership
            project = await self.project_repository.get(project_id)
            if not project:
                logger.error(f"Project with ID {project_id} not found")
                raise NotFoundException("Project", str(project_id))
                
            # Verify project ownership
            if project.user_id != user_id:
                logger.error(f"User {user_id} does not own project {project_id}")
                raise ForbiddenException("You do not have permission to access this project")
            
            # Delete all project-track associations
            await self.project_track_repository.delete_by_project_id(project_id)
            
            # Delete the project
            result = await self.project_repository.delete(project_id)
            
            logger.info(f"Deleted project with ID: {project_id}")
            return result
        except Exception as e:
            if isinstance(e, (NotFoundException, ForbiddenException)):
                raise
            logger.error(f"Error deleting project: {str(e)}")
            logger.error(traceback.format_exc())
            raise ServiceException(f"Failed to delete project: {str(e)}")
            
    async def add_track(
        self, 
        project_id: uuid.UUID, 
        user_id: uuid.UUID, 
        track_data: Dict[str, Any]
    ) -> ProjectWithTracks:
        """
        Add a track to a project
        
        Args:
            project_id: The ID of the project
            user_id: The ID of the user
            track_data: The track data with type and track-specific properties
            
        Returns:
            The updated project with tracks
            
        Raises:
            NotFoundException: If the project is not found
            ForbiddenException: If the user does not own the project
            ServiceException: If the operation fails
        """
        logger.info(f"Adding track to project with ID: {project_id} for user ID: {user_id}")
        try:
            # First get the project to verify ownership
            project = await self.project_repository.get_by_id(project_id)
            if not project:
                logger.error(f"Project with ID {project_id} not found")
                raise NotFoundException("Project", str(project_id))
                
            # Verify project ownership
            if project.user_id != user_id:
                logger.error(f"User {user_id} does not own project {project_id}")
                raise ForbiddenException("You do not have permission to access this project")
            
            # Validate track data
            if "type" not in track_data:
                raise ValueError("Track data must include 'type' field")
                
            # Get track type
            track_type = TrackType(track_data["type"])
            
            # Extract project-track settings
            project_track_settings = {
                "name": track_data.get("name"),
                "track_id": track_data.get("id"),
                "volume": track_data.get("volume"),
                "pan": track_data.get("pan"),
                "mute": track_data.get("mute"),
                "x_position": track_data.get("x_position"),
                "y_position": track_data.get("y_position"),
                "trim_start_ticks": track_data.get("trim_start_ticks"),
                "trim_end_ticks": track_data.get("trim_end_ticks"),
                "duration_ticks": track_data.get("duration_ticks"),
                "track_number": track_data.get("track_number")
            }
            
            logger.info(f"Project track settings: {project_track_settings}")
            
            # Extract track-specific data
            track_specific_data = {k: v for k, v in track_data.items() 
                                if k not in project_track_settings.keys() and k != "type"}
            track_specific_data["id"] = track_data.get("id")
            
            # Create track based on type
            created_track = None
            if track_type == TrackType.AUDIO:
                created_track = await self.track_service.create_audio_track(user_id, track_specific_data)
            elif track_type == TrackType.MIDI:
                created_track = await self.track_service.create_midi_track(user_id, track_specific_data)
            elif track_type == TrackType.SAMPLER:
                created_track = await self.track_service.create_sampler_track(user_id, track_specific_data)
            elif track_type == TrackType.DRUM:
                created_track = await self.track_service.create_drum_track(user_id, track_specific_data)
            
            # Add track to project
            await self.track_service.add_track_to_project(
                project_id=project_id,
                track_type=track_type,
                track_id=created_track.id,
                user_id=user_id,
                settings=project_track_settings
            )
            
            # Get the updated project with tracks
            updated_project = await self.get_project(project_id, user_id)
            logger.info(f"Added track with ID: {created_track.id} to project with ID: {project_id}")
            
            return updated_project
        except Exception as e:
            if isinstance(e, (NotFoundException, ForbiddenException)):
                raise
            logger.error(f"Error adding track to project: {str(e)}")
            logger.error(traceback.format_exc())
            raise ServiceException(f"Failed to add track to project: {str(e)}")
            
    async def update_track(
        self, 
        project_id: uuid.UUID, 
        track_id: uuid.UUID,
        track_type: TrackType,
        user_id: uuid.UUID, 
        track_data: Dict[str, Any]
    ) -> ProjectWithTracks:
        """
        Update a track in a project
        
        Args:
            project_id: The ID of the project
            track_id: The ID of the track
            track_type: The type of the track
            user_id: The ID of the user
            track_data: The updated track data
            
        Returns:
            The updated project with tracks
            
        Raises:
            NotFoundException: If the project or track is not found
            ForbiddenException: If the user does not own the project
            ServiceException: If the operation fails
        """
        logger.info(f"Updating {track_type.value} track with ID: {track_id} in project with ID: {project_id}")
        try:
            # Get the project to verify ownership
            project = await self.project_repository.get(project_id)
            if not project:
                logger.error(f"Project with ID {project_id} not found")
                raise NotFoundException("Project", str(project_id))
                
            # Verify project ownership
            if project.user_id != user_id:
                logger.error(f"User {user_id} does not own project {project_id}")
                raise ForbiddenException("You do not have permission to access this project")
            
            # Check if the track is in the project
            project_track = await self.project_track_repository.get_by_project_and_track(
                project_id, track_type, track_id
            )
            if not project_track:
                logger.error(f"Track {track_id} not found in project {project_id}")
                raise NotFoundException("Track in project", f"{project_id}/{track_id}")
            
            # Separate track-specific data from project-track settings
            project_track_fields = [
                "name", "volume", "pan", "mute", "x_position", "y_position", 
                "trim_start_ticks", "trim_end_ticks", "duration_ticks", "track_number"
            ]
            
            project_track_data = {k: v for k, v in track_data.items() if k in project_track_fields}
            track_specific_data = {k: v for k, v in track_data.items() if k not in project_track_fields}
            
            # Update project-track settings if provided
            if project_track_data:
                await self.track_service.update_track_project_settings(
                    project_id=project_id,
                    track_type=track_type,
                    track_id=track_id,
                    user_id=user_id,
                    settings=project_track_data
                )
            
            # Update track-specific data if provided
            if track_specific_data:
                await self.track_service.update_track(
                    track_id=track_id,
                    track_type=track_type,
                    user_id=user_id,
                    track_data=track_specific_data
                )
            
            # Get the updated project with tracks
            updated_project = await self.get_project(project_id, user_id)
            logger.info(f"Updated {track_type.value} track with ID: {track_id} in project with ID: {project_id}")
            
            return updated_project
        except Exception as e:
            if isinstance(e, (NotFoundException, ForbiddenException)):
                raise
            logger.error(f"Error updating track in project: {str(e)}")
            logger.error(traceback.format_exc())
            raise ServiceException(f"Failed to update track in project: {str(e)}")
            
    async def remove_track(
        self, 
        project_id: uuid.UUID, 
        track_id: uuid.UUID,
        track_type: TrackType,
        user_id: uuid.UUID
    ) -> ProjectWithTracks:
        """
        Remove a track from a project
        
        Args:
            project_id: The ID of the project
            track_id: The ID of the track
            track_type: The type of the track
            user_id: The ID of the user
            
        Returns:
            The updated project with tracks
            
        Raises:
            NotFoundException: If the project or track is not found
            ForbiddenException: If the user does not own the project
            ServiceException: If the operation fails
        """
        logger.info(f"Removing {track_type.value} track with ID: {track_id} from project with ID: {project_id}")
        try:
            # Get the project to verify ownership
            project = await self.project_repository.get(project_id)
            if not project:
                logger.error(f"Project with ID {project_id} not found")
                raise NotFoundException("Project", str(project_id))
                
            # Verify project ownership
            if project.user_id != user_id:
                logger.error(f"User {user_id} does not own project {project_id}")
                raise ForbiddenException("You do not have permission to access this project")
            
            # Check if the track is in the project
            project_track = await self.project_track_repository.get_by_project_and_track(
                project_id, track_type, track_id
            )
            if not project_track:
                logger.error(f"Track {track_id} not found in project {project_id}")
                raise NotFoundException("Track in project", f"{project_id}/{track_id}")
            
            # Remove the track from the project
            await self.track_service.remove_track_from_project(
                project_id=project_id,
                track_type=track_type,
                track_id=track_id,
                user_id=user_id
            )
            
            # Get the updated project with tracks
            updated_project = await self.get_project(project_id, user_id)
            logger.info(f"Removed {track_type.value} track with ID: {track_id} from project with ID: {project_id}")
            
            return updated_project
        except Exception as e:
            if isinstance(e, (NotFoundException, ForbiddenException)):
                raise
            logger.error(f"Error removing track from project: {str(e)}")
            logger.error(traceback.format_exc())
            raise ServiceException(f"Failed to remove track from project: {str(e)}")