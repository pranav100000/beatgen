from typing import Dict, Any, List, Optional
from uuid import UUID
import traceback
from datetime import datetime
from pydantic import parse_obj_as

from app2.core.logging import get_service_logger
from app2.core.exceptions import ServiceException, NotFoundException, ForbiddenException
from app2.repositories.project_repository import ProjectRepository
from app2.repositories.track_repository import TrackRepository
from app2.repositories.project_track_repository import ProjectTrackRepository
from app2.models.project import Project, ProjectWithTracks, ProjectRead
from app2.models.track import Track
from app2.models.project_track import ProjectTrackRead
from app2.types.file_types import FileType

logger = get_service_logger("project")

class ProjectService:
    """Service for project operations"""
    
    def __init__(
        self, 
        project_repository: ProjectRepository,
        track_repository: TrackRepository,
        project_track_repository: ProjectTrackRepository
    ):
        """
        Initialize the service with repositories
        
        Args:
            project_repository: The repository for project operations
            track_repository: The repository for track operations
            project_track_repository: The repository for project-track relationship operations
        """
        self.project_repository = project_repository
        self.track_repository = track_repository
        self.project_track_repository = project_track_repository
        
    async def get_user_projects(self, user_id: str) -> List[ProjectRead]:
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
            
    async def get_project(self, project_id: str, user_id: str) -> ProjectWithTracks:
        """
        Get a project by ID
        
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
            project = await self.project_repository.get_with_tracks(project_id)
            
            # Verify project ownership
            if str(project.user_id) != user_id:
                logger.error(f"Project: {project}")
                logger.error(f"User {user_id} does not own project {project_id}")
                raise ForbiddenException("You do not have permission to access this project")
                
            logger.info(f"Found project with ID: {project_id} for user ID: {user_id}")
            
            # Log the project data before validation
            logger.info(f"Project_data before validation: {project}")
            logger.info(f"Project_data.tracks: {project.tracks}") # Log the tracks field

            # Convert SQLModel object to API model
            # Note: We've updated ProjectWithTracks to expect 'tracks' instead of 'project_links'
            return ProjectWithTracks.model_validate(project)
        except Exception as e:
            if isinstance(e, (NotFoundException, ForbiddenException)):
                raise
            logger.error(f"Error getting project: {str(e)}")
            logger.error(traceback.format_exc())
            raise ServiceException(f"Failed to get project: {str(e)}")
            
    async def create_project(self, user_id: str, project_data: Dict[str, Any], file_repository=None) -> ProjectWithTracks:
        """
        Create a new project with all associated tracks and files
        
        Args:
            user_id: The ID of the user
            project_data: The project data including tracks and files
            file_repository: Optional file repository for creating files (if None, no files will be created)
            
        Returns:
            The created project with all its tracks
            
        Raises:
            ServiceException: If the operation fails
        """
        logger.info(f"Creating project for user ID: {user_id}")
        logger.info(f"Project data: {project_data}")
        logger.info(f"File repository provided: {file_repository is not None}")
        try:
            # Add user ID to project data
            project_data["user_id"] = user_id
            
            # Extract tracks data if present
            tracks_data = project_data.pop("tracks", None)
            logger.info(f"Extracted tracks data: {tracks_data}")
            
            # Create the project
            project = await self.project_repository.create(project_data)
            logger.info(f"Created project with ID: {project.id} for user ID: {user_id}")
            
            # Create tracks and files if provided
            if tracks_data and isinstance(tracks_data, list):
                logger.info(f"Creating {len(tracks_data)} tracks for project {project.id}")
                
                for track_idx, track_data in enumerate(tracks_data):
                    logger.info(f"Processing track {track_idx}: {track_data}")
                    # Add track to project
                    if file_repository and isinstance(track_data, dict):
                        logger.info(f"Using file_repository for track {track_idx}")
                        # Set track number if not provided
                        if "track_number" not in track_data:
                            track_data["track_number"] = track_idx
                            
                        # Add user ID to track data
                        track_data["user_id"] = user_id
                        
                        
                        # Create the track
                        track = await self.track_repository.create(track_data)
                        
                        logger.info(f"Creating project-track association: {track_data}")
                        await self.project_track_repository.create(track_data)
            
            # Get the project with its tracks
            project_with_tracks = await self.get_project(str(project.id), user_id)
            return project_with_tracks
        except Exception as e:
            logger.error(f"Error creating project: {str(e)}")
            logger.error(traceback.format_exc())
            raise ServiceException(f"Failed to create project: {str(e)}")
            
                
    async def update_project(self, project_id: str, user_id: str, project_data: Dict[str, Any]) -> ProjectWithTracks:
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
            project = await self.get_project(project_id, user_id)
            
            # Extract tracks data if present
            tracks_data = project_data.get("tracks", None)
            logger.info(f"Extracted tracks data: {tracks_data is not None}")
            
            # Filter out fields that cannot be updated
            safe_data = {k: v for k, v in project_data.items() if k not in ["id", "user_id", "created_at", "tracks"]}
            
            # Add updated timestamp
            safe_data["updated_at"] = datetime.utcnow()
            
            # Update the project
            updated_project = await self.project_repository.update(project_id, safe_data)
            
            # Update the tracks if provided
            if tracks_data is not None:
                logger.info(f"Updating tracks for project with ID: {project_id} for user ID: {user_id}")
                await self.update_project_tracks(project_id, user_id, tracks_data)
            
            # Get the updated project with all its tracks
            project_with_tracks = await self.get_project(project_id, user_id)
            
            logger.info(f"Updated project with ID: {project_id} for user ID: {user_id}")
            
            # Return the project with tracks
            return project_with_tracks
        except Exception as e:
            if isinstance(e, (NotFoundException, ForbiddenException)):
                raise
            logger.error(f"Error updating project: {str(e)}")
            logger.error(traceback.format_exc())
            raise ServiceException(f"Failed to update project: {str(e)}")
        
    async def update_project_tracks(self, project_id: str, user_id: str, tracks_data: List[Dict[str, Any]]) -> None:
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
            
            # Create new project-track associations
            for track in tracks_data:
                if isinstance(track, dict) and "id" in track:
                    track_id = track["id"]
                    
                    # Create project-track association with all required fields
                    # Copy relevant fields from the track data
                    project_track_data = {
                        "project_id": project_id,
                        "track_id": track_id,
                        "name": track.get("name", "Unnamed Track"),
                        "volume": track.get("volume", 1.0),
                        "pan": track.get("pan", 0.0),
                        "mute": track.get("mute", False),
                        "x_position": track.get("x_position", 0.0),
                        "y_position": track.get("y_position", 0.0),
                        "trim_start_ticks": track.get("trim_start_ticks", 0),
                        "trim_end_ticks": track.get("trim_end_ticks", 0),
                        "duration_ticks": track.get("duration_ticks", 0),
                        "track_number": track.get("track_number", 0),
                        # Add type field from the track data
                        "type": track.get("type", "audio")  # Default to audio if not specified
                    }
                    await self.project_track_repository.create(project_track_data)
                    logger.info(f"Created project-track association: project={project_id}, track={track_id}")
                else:
                    logger.warning(f"Invalid track data format: {track}")
        except Exception as e:
            logger.error(f"Error updating project tracks: {str(e)}")
            logger.error(traceback.format_exc())
            raise ServiceException(f"Failed to update project tracks: {str(e)}")
        
    async def delete_project(self, project_id: str, user_id: str) -> bool:
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
            project = await self.get_project(project_id, user_id)
            
            # Delete all project-track associations first
            await self.project_track_repository.delete_by_project_id(project_id)
            
            # Delete the project
            result = await self.project_repository.delete(project_id)
            
            logger.info(f"Deleted project with ID: {project_id} for user ID: {user_id}")
            return result
        except Exception as e:
            if isinstance(e, (NotFoundException, ForbiddenException)):
                raise
            logger.error(f"Error deleting project: {str(e)}")
            logger.error(traceback.format_exc())
            raise ServiceException(f"Failed to delete project: {str(e)}")
            
    async def add_track(self, project_id: str, user_id: str, track_data: Dict[str, Any], 
                        file_repository=None) -> ProjectWithTracks:
        """
        Add a track to a project
        
        Args:
            project_id: The ID of the project
            user_id: The ID of the user
            track_data: The track data
            file_repository: Optional file repository for creating files
            
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
            project = await self.get_project(project_id, user_id)
            
            # Add user ID to track data
            track_data["user_id"] = user_id
            
            # Handle file creation if file_repository is provided
            if file_repository:
                # Process file data based on track type
                track_type = track_data.get("type")
                
                if track_type == "audio" and "audio_file" in track_data:
                    # Extract and create audio file
                    audio_file_data = track_data.pop("audio_file")
                    audio_file_data["user_id"] = user_id
                    audio_file = await file_repository.create(audio_file_data, FileType.AUDIO)
                    track_data["audio_file_id"] = str(audio_file.id)
                    
                elif track_type == "midi" and "midi_file" in track_data:
                    # Extract and create midi file
                    midi_file_data = track_data.pop("midi_file")
                    midi_file_data["user_id"] = user_id
                    midi_file = await file_repository.create(midi_file_data, FileType.MIDI)
                    track_data["midi_file_id"] = str(midi_file.id)
                    
                elif track_type == "instrument":
                    # Handle instrument files and MIDI data
                    if "instrument_file" in track_data:
                        # Extract and create instrument file
                        instrument_data = track_data.pop("instrument_file")
                        instrument_data["user_id"] = user_id
                        instrument_file = await file_repository.create(instrument_data, FileType.INSTRUMENT)
                        track_data["instrument_id"] = str(instrument_file.id)
                        
                    if "midi_file" in track_data:
                        # Extract and create midi file
                        midi_file_data = track_data.pop("midi_file")
                        midi_file_data["user_id"] = user_id
                        midi_file = await file_repository.create(midi_file_data, FileType.MIDI)
                        track_data["midi_file_id"] = str(midi_file.id)
            
            # Create the track
            track = await self.track_repository.create(track_data)
            
            # Create the project-track association
            project_track_data = {
                "project_id": project_id,
                "track_id": track.id
            }
            await self.project_track_repository.create(project_track_data)
            
            # Get the updated project with tracks
            updated_project = await self.get_project(project_id, user_id)
            
            logger.info(f"Added track with ID: {track.id} to project with ID: {project_id}")
            
            return updated_project
        except Exception as e:
            if isinstance(e, (NotFoundException, ForbiddenException)):
                raise
            logger.error(f"Error adding track to project: {str(e)}")
            logger.error(traceback.format_exc())
            raise ServiceException(f"Failed to add track to project: {str(e)}")
            
    async def update_track(self, project_id: str, user_id: str, track_id: str, track_data: Dict[str, Any], 
                          file_repository=None) -> ProjectWithTracks:
        """
        Update a track in a project
        
        Args:
            project_id: The ID of the project
            user_id: The ID of the user
            track_id: The ID of the track
            track_data: The updated track data
            file_repository: Optional file repository for updating files
            
        Returns:
            The updated project with tracks
            
        Raises:
            NotFoundException: If the project or track is not found
            ForbiddenException: If the user does not own the project
            ServiceException: If the operation fails
        """
        logger.info(f"Updating track with ID: {track_id} in project with ID: {project_id} for user ID: {user_id}")
        try:
            # First get the project to verify ownership
            project = await self.get_project(project_id, user_id)
            
            # Check if the track is in the project
            project_track = await self.project_track_repository.get_by_ids(project_id, track_id)
            if not project_track:
                logger.error(f"Track {track_id} not found in project {project_id}")
                raise NotFoundException("Track in project", f"{project_id}/{track_id}")
            
            # Handle file updates if file_repository is provided
            if file_repository:
                # Process file data based on track type
                track_type = track_data.get("type")
                
                if track_type == "audio" and "audio_file" in track_data:
                    # Extract and update or create audio file
                    audio_file_data = track_data.pop("audio_file")
                    audio_file_data["user_id"] = user_id
                    
                    # Check if there's an audio_file_id to update or if we need to create
                    if "audio_file_id" in track_data and track_data["audio_file_id"]:
                        # Update existing audio file
                        await file_repository.update(track_data["audio_file_id"], audio_file_data, FileType.AUDIO)
                    else:
                        # Create new audio file
                        audio_file = await file_repository.create(audio_file_data, FileType.AUDIO)
                        track_data["audio_file_id"] = str(audio_file.id)
                
                elif track_type == "midi" and "midi_file" in track_data:
                    # Extract and update or create midi file
                    midi_file_data = track_data.pop("midi_file")
                    midi_file_data["user_id"] = user_id
                    
                    # Check if there's a midi_file_id to update or if we need to create
                    if "midi_file_id" in track_data and track_data["midi_file_id"]:
                        # Update existing midi file
                        await file_repository.update(track_data["midi_file_id"], midi_file_data, FileType.MIDI)
                    else:
                        # Create new midi file
                        midi_file = await file_repository.create(midi_file_data, FileType.MIDI)
                        track_data["midi_file_id"] = str(midi_file.id)
                
                elif track_type == "instrument":
                    # Handle instrument file updates
                    if "instrument_file" in track_data:
                        instrument_data = track_data.pop("instrument_file")
                        instrument_data["user_id"] = user_id
                        
                        # Check if there's an instrument_id to update or if we need to create
                        if "instrument_id" in track_data and track_data["instrument_id"]:
                            # Update existing instrument file
                            await file_repository.update(track_data["instrument_id"], instrument_data, FileType.INSTRUMENT)
                        else:
                            # Create new instrument file
                            instrument_file = await file_repository.create(instrument_data, FileType.INSTRUMENT)
                            track_data["instrument_id"] = str(instrument_file.id)
                    
                    # Handle MIDI file updates for instrument tracks
                    if "midi_file" in track_data:
                        midi_file_data = track_data.pop("midi_file")
                        midi_file_data["user_id"] = user_id
                        
                        # Check if there's a midi_file_id to update or if we need to create
                        if "midi_file_id" in track_data and track_data["midi_file_id"]:
                            # Update existing midi file
                            await file_repository.update(track_data["midi_file_id"], midi_file_data, FileType.MIDI)
                        else:
                            # Create new midi file
                            midi_file = await file_repository.create(midi_file_data, FileType.MIDI)
                            track_data["midi_file_id"] = str(midi_file.id)
            
            # Update the track
            # Only update project-track specific fields in the project_track table
            # and track-specific fields in the track table
            project_track_fields = ["order", "position_x", "position_y"]
            pt_data = {k: v for k, v in track_data.items() if k in project_track_fields}
            track_fields = {k: v for k, v in track_data.items() if k not in project_track_fields}
            
            # Update the project-track if there are any project-track fields
            if pt_data:
                await self.project_track_repository.update(project_id, track_id, pt_data)
            
            # Update the track if there are any track fields
            if track_fields:
                await self.track_repository.update(track_id, track_fields)
            
            # Get the updated project with tracks
            updated_project = await self.get_project(project_id, user_id)
            
            logger.info(f"Updated track with ID: {track_id} in project with ID: {project_id}")
            
            return updated_project
        except Exception as e:
            if isinstance(e, (NotFoundException, ForbiddenException)):
                raise
            logger.error(f"Error updating track in project: {str(e)}")
            logger.error(traceback.format_exc())
            raise ServiceException(f"Failed to update track in project: {str(e)}")
            
    async def remove_track(self, project_id: str, user_id: str, track_id: str) -> ProjectWithTracks:
        """
        Remove a track from a project
        
        Args:
            project_id: The ID of the project
            user_id: The ID of the user
            track_id: The ID of the track
            
        Returns:
            The updated project with tracks
            
        Raises:
            NotFoundException: If the project or track is not found
            ForbiddenException: If the user does not own the project
            ServiceException: If the operation fails
        """
        logger.info(f"Removing track with ID: {track_id} from project with ID: {project_id} for user ID: {user_id}")
        try:
            # First get the project to verify ownership
            project = await self.get_project(project_id, user_id)
            
            # Check if the track is in the project
            project_track = await self.project_track_repository.get_by_ids(project_id, track_id)
            if not project_track:
                logger.error(f"Track {track_id} not found in project {project_id}")
                raise NotFoundException("Track in project", f"{project_id}/{track_id}")
            
            # Remove the track from the project
            await self.project_track_repository.delete(project_id, track_id)
            
            # Get the updated project with tracks
            updated_project = await self.project_repository.get_with_tracks(project_id)
            
            logger.info(f"Removed track with ID: {track_id} from project with ID: {project_id}")
            
            # Convert SQLModel object to API model
            return ProjectWithTracks.from_orm(updated_project)
        except Exception as e:
            if isinstance(e, (NotFoundException, ForbiddenException)):
                raise
            logger.error(f"Error removing track from project: {str(e)}")
            logger.error(traceback.format_exc())
            raise ServiceException(f"Failed to remove track from project: {str(e)}")