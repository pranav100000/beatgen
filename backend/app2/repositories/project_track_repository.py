"""
ProjectTrack repository for database operations using SQLModel
Handles operations on the project-track join table with the new track model structure
"""
from typing import Dict, Any, List, Optional, Union, Tuple
from sqlmodel import Session, select
from sqlalchemy.orm import joinedload
import traceback
from datetime import datetime
import uuid

from app2.core.exceptions import DatabaseException, NotFoundException
from app2.core.logging import get_repository_logger
from app2.models.project_track import ProjectTrack
from app2.models.project import Project
from app2.models.track_models.audio_track import AudioTrack
from app2.models.track_models.midi_track import MidiTrack
from app2.models.track_models.sampler_track import SamplerTrack
from app2.models.track_models.drum_track import DrumTrack
from app2.types.track_types import TrackType

class ProjectTrackRepository:
    """Repository for project-track relationship operations"""
    
    def __init__(self, session: Session):
        """
        Initialize the repository with database session
        
        Args:
            session: The SQLModel session for database operations
        """
        self.session = session
        self.logger = get_repository_logger("project_track")
    
    async def get_by_project_id(self, project_id: uuid.UUID) -> List[ProjectTrack]:
        """
        Get all project-track associations for a project
        
        Args:
            project_id: The ID of the project
            
        Returns:
            List of project-track associations
            
        Raises:
            DatabaseException: If there's a database error
        """
        self.logger.info(f"Getting project-tracks for project {project_id}")
        try:
            statement = select(ProjectTrack).where(ProjectTrack.project_id == project_id)
            results = self.session.exec(statement).all()
            
            self.logger.info(f"Found {len(results)} project-tracks for project {project_id}")
            return results
        except Exception as e:
            self.logger.error(f"Error getting project-tracks: {str(e)}")
            self.logger.error(traceback.format_exc())
            raise DatabaseException(f"Failed to get project-tracks: {str(e)}")
    
    async def get_by_track(self, track_type: TrackType, track_id: uuid.UUID) -> List[ProjectTrack]:
        """
        Get all project-track associations for a track by its type and ID
        
        Args:
            track_type: The type of the track (AUDIO, MIDI, SAMPLER, DRUM)
            track_id: The ID of the track
            
        Returns:
            List of project-track associations
            
        Raises:
            DatabaseException: If there's a database error
        """
        self.logger.info(f"Getting project-tracks for {track_type} track {track_id}")
        try:
            # Select based on track_id and track_type
            statement = select(ProjectTrack).where(
                ProjectTrack.track_type == track_type,
                ProjectTrack.track_id == track_id
            )
                
            results = self.session.exec(statement).all()
            
            self.logger.info(f"Found {len(results)} project-tracks for {track_type} track {track_id}")
            return results
        except Exception as e:
            self.logger.error(f"Error getting project-tracks: {str(e)}")
            self.logger.error(traceback.format_exc())
            raise DatabaseException(f"Failed to get project-tracks: {str(e)}")
    
    async def get_by_project_and_track(
        self, 
        project_id: uuid.UUID, 
        track_type: TrackType, 
        track_id: uuid.UUID
    ) -> Optional[ProjectTrack]:
        """
        Get a project-track association by project ID and track details
        
        Args:
            project_id: The ID of the project
            track_type: The type of the track
            track_id: The ID of the track
            
        Returns:
            The project-track association if found, None otherwise
            
        Raises:
            DatabaseException: If there's a database error
        """
        self.logger.info(f"Getting project-track for project {project_id} and {track_type} track {track_id}")
        try:
            # Select based on project_id, track_id and track_type
            statement = select(ProjectTrack).where(
                ProjectTrack.project_id == project_id,
                ProjectTrack.track_type == track_type,
                ProjectTrack.track_id == track_id
            )
                
            result = self.session.exec(statement).first()
            
            if result:
                self.logger.info(f"Found project-track for project {project_id} and {track_type} track {track_id}")
            else:
                self.logger.info(f"No project-track found for project {project_id} and {track_type} track {track_id}")
                
            return result
        except Exception as e:
            self.logger.error(f"Error getting project-track: {str(e)}")
            self.logger.error(traceback.format_exc())
            raise DatabaseException(f"Failed to get project-track: {str(e)}")
    
    async def create(self, project_track_data: Dict[str, Any]) -> ProjectTrack:
        """
        Create a new project-track association
        
        Args:
            project_track_data: The project-track data (must include project_id, track_type,
                                and the appropriate track_id field based on track_type)
            
        Returns:
            The created project-track association
            
        Raises:
            DatabaseException: If there's a database error
        """
        self.logger.info(f"Creating new project-track: {project_track_data}")
        try:
            # Validate required fields
            if "project_id" not in project_track_data or "track_type" not in project_track_data or "track_id" not in project_track_data:
                raise ValueError("project_id, track_type, and track_id are required")
            
            # Create project-track instance
            project_track = ProjectTrack(**project_track_data)
            
            # Add to session and commit
            self.session.add(project_track)
            self.session.commit()
            self.session.refresh(project_track)
            
            self.logger.info(f"Created project-track for project {project_track.project_id}")
            return project_track
        except Exception as e:
            self.session.rollback()
            self.logger.error(f"Error creating project-track: {str(e)}")
            self.logger.error(traceback.format_exc())
            raise DatabaseException(f"Failed to create project-track: {str(e)}")
    
    async def update(
        self, 
        project_id: uuid.UUID, 
        track_type: TrackType,
        track_id: uuid.UUID, 
        project_track_data: Dict[str, Any]
    ) -> ProjectTrack:
        """
        Update a project-track association
        
        Args:
            project_id: The ID of the project
            track_type: The type of the track
            track_id: The ID of the track
            project_track_data: The updated data
            
        Returns:
            The updated project-track association
            
        Raises:
            NotFoundException: If the project-track association is not found
            DatabaseException: If there's a database error
        """
        self.logger.info(f"Updating project-track for project {project_id} and {track_type} track {track_id}")
        try:
            # Get existing project-track
            project_track = await self.get_by_project_and_track(project_id, track_type, track_id)
            
            if not project_track:
                self.logger.error(f"Project-track not found for project {project_id} and {track_type} track {track_id}")
                raise NotFoundException("ProjectTrack", f"project_id={project_id}, track_type={track_type}, track_id={track_id}")
            
            # Don't allow changing project_id, track_type, or track_id
            protected_fields = ["project_id", "track_type", "track_id"]
            for field in protected_fields:
                if field in project_track_data:
                    del project_track_data[field]
            
            # Update fields
            for key, value in project_track_data.items():
                if hasattr(project_track, key):
                    setattr(project_track, key, value)
            
            # Update timestamp if it exists
            if hasattr(project_track, "updated_at"):
                project_track.updated_at = datetime.utcnow()
            
            # Commit changes
            self.session.add(project_track)
            self.session.commit()
            self.session.refresh(project_track)
            
            self.logger.info(f"Updated project-track for project {project_id} and {track_type} track {track_id}")
            return project_track
        except Exception as e:
            self.session.rollback()
            if isinstance(e, NotFoundException):
                raise
            self.logger.error(f"Error updating project-track: {str(e)}")
            self.logger.error(traceback.format_exc())
            raise DatabaseException(f"Failed to update project-track: {str(e)}")
    
    async def delete(
        self, 
        project_id: uuid.UUID, 
        track_type: TrackType,
        track_id: uuid.UUID
    ) -> bool:
        """
        Delete a project-track association
        
        Args:
            project_id: The ID of the project
            track_type: The type of the track
            track_id: The ID of the track
            
        Returns:
            True if successful, False if the association doesn't exist
            
        Raises:
            DatabaseException: If there's a database error
        """
        self.logger.info(f"Deleting project-track for project {project_id} and {track_type} track {track_id}")
        try:
            # Get existing project-track
            project_track = await self.get_by_project_and_track(project_id, track_type, track_id)
            
            if not project_track:
                self.logger.info(f"Project-track not found for project {project_id} and {track_type} track {track_id}")
                return False
            
            # Delete from database
            self.session.delete(project_track)
            self.session.commit()
            
            self.logger.info(f"Deleted project-track for project {project_id} and {track_type} track {track_id}")
            return True
        except Exception as e:
            self.session.rollback()
            self.logger.error(f"Error deleting project-track: {str(e)}")
            self.logger.error(traceback.format_exc())
            raise DatabaseException(f"Failed to delete project-track: {str(e)}")
    
    async def delete_by_project_id(self, project_id: uuid.UUID) -> int:
        """
        Delete all project-track associations for a project
        
        Args:
            project_id: The ID of the project
            
        Returns:
            The number of associations deleted
            
        Raises:
            DatabaseException: If there's a database error
        """
        self.logger.info(f"Deleting all project-tracks for project {project_id}")
        try:
            # Get all associations for this project
            project_tracks = await self.get_by_project_id(project_id)
            
            # Delete all associations
            for pt in project_tracks:
                self.session.delete(pt)
            
            # Commit changes
            self.session.commit()
            
            self.logger.info(f"Deleted {len(project_tracks)} project-tracks for project {project_id}")
            return len(project_tracks)
        except Exception as e:
            self.session.rollback()
            self.logger.error(f"Error deleting project-tracks: {str(e)}")
            self.logger.error(traceback.format_exc())
            raise DatabaseException(f"Failed to delete project-tracks: {str(e)}")
    
    async def delete_by_track(self, track_type: TrackType, track_id: uuid.UUID) -> int:
        """
        Delete all project-track associations for a track
        
        Args:
            track_type: The type of the track
            track_id: The ID of the track
            
        Returns:
            The number of associations deleted
            
        Raises:
            DatabaseException: If there's a database error
        """
        self.logger.info(f"Deleting all project-tracks for {track_type} track {track_id}")
        try:
            # Get all associations for this track
            project_tracks = await self.get_by_track(track_type, track_id)
            
            # Delete all associations
            for pt in project_tracks:
                self.session.delete(pt)
            
            # Commit changes
            self.session.commit()
            
            self.logger.info(f"Deleted {len(project_tracks)} project-tracks for {track_type} track {track_id}")
            return len(project_tracks)
        except Exception as e:
            self.session.rollback()
            self.logger.error(f"Error deleting project-tracks: {str(e)}")
            self.logger.error(traceback.format_exc())
            raise DatabaseException(f"Failed to delete project-tracks: {str(e)}")
            
    async def get_track_with_settings(self, project_id: uuid.UUID) -> List[Dict[str, Any]]:
        """
        Get all tracks with their project-specific settings for a project
        
        Args:
            project_id: The ID of the project
            
        Returns:
            List of dictionaries with track data and settings
            
        Raises:
            DatabaseException: If there's a database error
        """
        self.logger.info(f"Getting tracks with settings for project {project_id}")
        try:
            # Get all project-track associations for this project
            project_tracks = await self.get_by_project_id(project_id)
            
            result = []
            
            # For each association, load the track based on its type
            for pt in project_tracks:
                # Use composite key (project_id, track_id) instead of a single id
                track_data = {
                    "project_id": pt.project_id,
                    "track_id": pt.track_id,
                    "name": pt.name,
                    "volume": pt.volume,
                    "pan": pt.pan,
                    "mute": pt.mute,
                    "x_position": pt.x_position,
                    "y_position": pt.y_position,
                    "trim_start_ticks": pt.trim_start_ticks,
                    "trim_end_ticks": pt.trim_end_ticks,
                    "duration_ticks": pt.duration_ticks,
                    "track_number": pt.track_number,
                    "track_type": pt.track_type
                }
                
                # Get track based on type
                if pt.track_type == TrackType.AUDIO and pt.audio_track:
                    track_data["track"] = pt.audio_track
                elif pt.track_type == TrackType.MIDI and pt.midi_track:
                    track_data["track"] = pt.midi_track
                elif pt.track_type == TrackType.SAMPLER and pt.sampler_track:
                    track_data["track"] = pt.sampler_track
                elif pt.track_type == TrackType.DRUM and pt.drum_track:
                    track_data["track"] = pt.drum_track
                
                result.append(track_data)
            
            self.logger.info(f"result: {result}")
            
            self.logger.info(f"Found {len(result)} tracks with settings for project {project_id}")
            return result
        except Exception as e:
            self.logger.error(f"Error getting tracks with settings: {str(e)}")
            self.logger.error(traceback.format_exc())
            raise DatabaseException(f"Failed to get tracks with settings: {str(e)}")