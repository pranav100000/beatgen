"""
ProjectTrack repository for database operations using SQLModel
Handles operations on the project-track join table
"""
from typing import Dict, Any, List, Optional, Tuple
from sqlmodel import Session, select
from sqlalchemy.orm import joinedload
import traceback
from datetime import datetime
import uuid

from app2.core.exceptions import DatabaseException, NotFoundException
from app2.core.logging import get_repository_logger
from app2.models.project_track import ProjectTrack
from app2.models.track import Track
from app2.models.project import Project

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
    
    async def get_by_ids(self, project_id: uuid.UUID, track_id: uuid.UUID) -> Optional[ProjectTrack]:
        """
        Get a project-track association by project ID and track ID
        
        Args:
            project_id: The ID of the project
            track_id: The ID of the track
            
        Returns:
            The project-track association if found, None otherwise
            
        Raises:
            DatabaseException: If there's a database error
        """
        self.logger.info(f"Getting project-track for project {project_id} and track {track_id}")
        try:
            statement = (
                select(ProjectTrack)
                .where(
                    ProjectTrack.project_id == project_id,
                    ProjectTrack.track_id == track_id
                )
            )
            
            result = self.session.exec(statement).first()
            
            if result:
                self.logger.info(f"Found project-track for project {project_id} and track {track_id}")
            else:
                self.logger.info(f"No project-track found for project {project_id} and track {track_id}")
                
            return result
        except Exception as e:
            self.logger.error(f"Error getting project-track: {str(e)}")
            self.logger.error(traceback.format_exc())
            raise DatabaseException(f"Failed to get project-track: {str(e)}")
    
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
    
    async def get_by_track_id(self, track_id: uuid.UUID) -> List[ProjectTrack]:
        """
        Get all project-track associations for a track
        
        Args:
            track_id: The ID of the track
            
        Returns:
            List of project-track associations
            
        Raises:
            DatabaseException: If there's a database error
        """
        self.logger.info(f"Getting project-tracks for track {track_id}")
        try:
            statement = select(ProjectTrack).where(ProjectTrack.track_id == track_id)
            results = self.session.exec(statement).all()
            
            self.logger.info(f"Found {len(results)} project-tracks for track {track_id}")
            return results
        except Exception as e:
            self.logger.error(f"Error getting project-tracks: {str(e)}")
            self.logger.error(traceback.format_exc())
            raise DatabaseException(f"Failed to get project-tracks: {str(e)}")
    
    async def create(self, project_track_data: Dict[str, Any]) -> ProjectTrack:
        """
        Create a new project-track association
        
        Args:
            project_track_data: The project-track data (must include project_id and track_id)
            
        Returns:
            The created project-track association
            
        Raises:
            DatabaseException: If there's a database error
        """
        self.logger.info(f"Creating new project-track: {project_track_data}")
        try:
            # Validate required fields
            if "project_id" not in project_track_data or "track_id" not in project_track_data:
                raise ValueError("project_id and track_id are required")
            
            # Create project-track instance
            project_track = ProjectTrack(**project_track_data)
            
            # Add to session and commit
            self.session.add(project_track)
            self.session.commit()
            self.session.refresh(project_track)
            
            self.logger.info(f"Created project-track for project {project_track.project_id} and track {project_track.track_id}")
            return project_track
        except Exception as e:
            self.session.rollback()
            self.logger.error(f"Error creating project-track: {str(e)}")
            self.logger.error(traceback.format_exc())
            raise DatabaseException(f"Failed to create project-track: {str(e)}")
    
    async def update(self, project_id: uuid.UUID, track_id: uuid.UUID, project_track_data: Dict[str, Any]) -> ProjectTrack:
        """
        Update a project-track association
        
        Args:
            project_id: The ID of the project
            track_id: The ID of the track
            project_track_data: The updated data (excluding project_id and track_id)
            
        Returns:
            The updated project-track association
            
        Raises:
            NotFoundException: If the project-track association is not found
            DatabaseException: If there's a database error
        """
        self.logger.info(f"Updating project-track for project {project_id} and track {track_id}")
        try:
            # Get existing project-track
            project_track = await self.get_by_ids(project_id, track_id)
            
            if not project_track:
                self.logger.error(f"Project-track not found for project {project_id} and track {track_id}")
                raise NotFoundException("ProjectTrack", f"project_id={project_id},track_id={track_id}")
            
            # Don't allow changing project_id or track_id
            if "project_id" in project_track_data:
                del project_track_data["project_id"]
            if "track_id" in project_track_data:
                del project_track_data["track_id"]
            
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
            
            self.logger.info(f"Updated project-track for project {project_id} and track {track_id}")
            return project_track
        except Exception as e:
            self.session.rollback()
            if isinstance(e, NotFoundException):
                raise
            self.logger.error(f"Error updating project-track: {str(e)}")
            self.logger.error(traceback.format_exc())
            raise DatabaseException(f"Failed to update project-track: {str(e)}")
    
    async def delete(self, project_id: uuid.UUID, track_id: uuid.UUID) -> bool:
        """
        Delete a project-track association
        
        Args:
            project_id: The ID of the project
            track_id: The ID of the track
            
        Returns:
            True if successful, False if the association doesn't exist
            
        Raises:
            DatabaseException: If there's a database error
        """
        self.logger.info(f"Deleting project-track for project {project_id} and track {track_id}")
        try:
            # Get existing project-track
            project_track = await self.get_by_ids(project_id, track_id)
            
            if not project_track:
                self.logger.info(f"Project-track not found for project {project_id} and track {track_id}")
                return False
            
            # Delete from database
            self.session.delete(project_track)
            self.session.commit()
            
            self.logger.info(f"Deleted project-track for project {project_id} and track {track_id}")
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
    
    async def delete_by_track_id(self, track_id: uuid.UUID) -> int:
        """
        Delete all project-track associations for a track
        
        Args:
            track_id: The ID of the track
            
        Returns:
            The number of associations deleted
            
        Raises:
            DatabaseException: If there's a database error
        """
        self.logger.info(f"Deleting all project-tracks for track {track_id}")
        try:
            # Get all associations for this track
            project_tracks = await self.get_by_track_id(track_id)
            
            # Delete all associations
            for pt in project_tracks:
                self.session.delete(pt)
            
            # Commit changes
            self.session.commit()
            
            self.logger.info(f"Deleted {len(project_tracks)} project-tracks for track {track_id}")
            return len(project_tracks)
        except Exception as e:
            self.session.rollback()
            self.logger.error(f"Error deleting project-tracks: {str(e)}")
            self.logger.error(traceback.format_exc())
            raise DatabaseException(f"Failed to delete project-tracks: {str(e)}")