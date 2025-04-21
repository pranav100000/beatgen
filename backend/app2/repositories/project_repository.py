"""
Project repository for database operations using SQLModel
Handles basic CRUD operations for project entities
"""
from typing import Dict, Any, List, Optional
from sqlmodel import Session, select
from sqlalchemy.orm import selectinload
import traceback
from datetime import datetime
import uuid

from app2.core.exceptions import DatabaseException, NotFoundException
from app2.core.logging import get_repository_logger
from app2.models.project import Project
from app2.models.track_models.audio_track import AudioTrack
from app2.models.track_models.midi_track import MidiTrack
from app2.models.track_models.sampler_track import SamplerTrack
from app2.models.track_models.drum_track import DrumTrack

class ProjectRepository:
    """Repository for project operations"""
    
    def __init__(self, session: Session):
        """
        Initialize the repository with database session
        
        Args:
            session: The SQLModel session for database operations
        """
        self.session = session
        self.logger = get_repository_logger("project")
    
    async def get_by_id(self, project_id: uuid.UUID) -> Project:
        """
        Get a project by ID
        
        Args:
            project_id: The ID of the project
            
        Returns:
            The project
            
        Raises:
            NotFoundException: If the project is not found
            DatabaseException: If there's a database error
        """
        self.logger.info(f"Getting project with ID: {project_id}")
        try:
            statement = select(Project).where(Project.id == project_id)
            project = self.session.exec(statement).first()
            
            if not project:
                self.logger.error(f"Project with ID {project_id} not found")
                raise NotFoundException("Project", project_id)
            
            self.logger.info(f"Found project with ID: {project_id}")
            return project
        except Exception as e:
            if isinstance(e, NotFoundException):
                raise
            self.logger.error(f"Error getting project: {str(e)}")
            self.logger.error(traceback.format_exc())
            raise DatabaseException(f"Failed to get project: {str(e)}")
    
    async def get_with_tracks(self, project_id: uuid.UUID) -> Project:
        """
        Get a project by ID with its tracks and associated files loaded
        
        Args:
            project_id: The ID of the project
            
        Returns:
            The project with tracks and files loaded
            
        Raises:
            NotFoundException: If the project is not found
            DatabaseException: If there's a database error
        """
        self.logger.info(f"Getting project with ID: {project_id} with tracks and files")
        try:
            # We need a query with multiple selectinload calls to eagerly load tracks and related files
            from app2.models.track import Track
            from app2.models.file_models.audio_file import AudioFile
            from app2.models.file_models.midi_file import MidiFile
            from app2.models.file_models.instrument_file import InstrumentFile
            
            statement = (
                select(Project)
                .options(
                    selectinload(Project.tracks).options(
                        selectinload(Track.audio_file),
                        selectinload(Track.midi_file),
                        selectinload(Track.instrument_file)
                    )
                )
                .where(Project.id == project_id)
            )
            
            project = self.session.exec(statement).first()
            
            if not project:
                self.logger.error(f"Project with ID {project_id} not found")
                raise NotFoundException("Project", project_id)
            
            track_count = len(project.tracks) if project.tracks else 0
            self.logger.info(f"Found project with ID: {project_id} with {track_count} tracks")
            
            # Log file counts for debugging
            audio_file_count = sum(1 for t in project.tracks if hasattr(t, "audio_file") and t.audio_file is not None)
            midi_file_count = sum(1 for t in project.tracks if hasattr(t, "midi_file") and t.midi_file is not None)
            instrument_file_count = sum(1 for t in project.tracks if hasattr(t, "instrument_file") and t.instrument_file is not None)
            
            self.logger.info(f"Loaded {audio_file_count} audio files, {midi_file_count} MIDI files, and {instrument_file_count} instrument files")
            
            return project
        except Exception as e:
            if isinstance(e, NotFoundException):
                raise
            self.logger.error(f"Error getting project with tracks: {str(e)}")
            self.logger.error(traceback.format_exc())
            raise DatabaseException(f"Failed to get project with tracks: {str(e)}")
    
    async def get_all(self, **filters) -> List[Project]:
        """
        Get all projects with optional filters
        
        Args:
            **filters: Optional filter criteria (e.g., user_id=uuid)
            
        Returns:
            List of projects
            
        Raises:
            DatabaseException: If there's a database error
        """
        filter_str = ", ".join(f"{k}={v}" for k, v in filters.items())
        self.logger.info(f"Getting projects with filters: {filter_str}")
        try:
            # Build query with filters
            query = select(Project)
            for key, value in filters.items():
                if hasattr(Project, key):
                    query = query.where(getattr(Project, key) == value)
            
            # Execute query
            results = self.session.exec(query).all()
            
            self.logger.info(f"Found {len(results)} projects")
            return results
        except Exception as e:
            self.logger.error(f"Error getting projects: {str(e)}")
            self.logger.error(traceback.format_exc())
            raise DatabaseException(f"Failed to get projects: {str(e)}")
    
    async def get_by_user_id(self, user_id: uuid.UUID) -> List[Project]:
        """
        Get all projects for a user
        
        Args:
            user_id: The ID of the user
            
        Returns:
            List of projects
            
        Raises:
            DatabaseException: If there's a database error
        """
        self.logger.info(f"Getting projects for user: {user_id}")
        try:
            return await self.get_all(user_id=user_id)
        except Exception as e:
            self.logger.error(f"Error getting projects for user: {str(e)}")
            self.logger.error(traceback.format_exc())
            raise DatabaseException(f"Failed to get projects for user: {str(e)}")
    
    async def get_by_user_id_with_tracks(self, user_id: uuid.UUID) -> List[Project]:
        """
        Get all projects for a user with tracks loaded
        
        Args:
            user_id: The ID of the user
            
        Returns:
            List of projects with tracks loaded
            
        Raises:
            DatabaseException: If there's a database error
        """
        self.logger.info(f"Getting projects for user: {user_id} with tracks")
        try:
            statement = (
                select(Project)
                .options(selectinload(Project.tracks))
                .where(Project.user_id == user_id)
            )
            
            projects = self.session.exec(statement).all()
            
            self.logger.info(f"Found {len(projects)} projects for user: {user_id}")
            return projects
        except Exception as e:
            self.logger.error(f"Error getting projects with tracks: {str(e)}")
            self.logger.error(traceback.format_exc())
            raise DatabaseException(f"Failed to get projects with tracks: {str(e)}")
    
    async def create(self, project_data: Dict[str, Any]) -> Project:
        """
        Create a new project
        
        Args:
            project_data: The project data
            
        Returns:
            The created project
            
        Raises:
            DatabaseException: If there's a database error
        """
        self.logger.info("Creating new project")
        try:
            # Create project instance
            project = Project(**project_data)
            
            # Ensure ID is set
            if not getattr(project, 'id', None):
                project.id = uuid.uuid4()
            
            self.logger.info(f"Creating project with data: {project_data}, ID: {project.id}")
            
            # Add to session and commit
            self.session.add(project)
            self.session.commit()
            self.session.refresh(project)
            
            self.logger.info(f"Created project with ID: {project.id}")
            return project
        except Exception as e:
            self.session.rollback()
            self.logger.error(f"Error creating project: {str(e)}")
            self.logger.error(traceback.format_exc())
            raise DatabaseException(f"Failed to create project: {str(e)}")
    
    async def update(self, project_id: uuid.UUID, project_data: Dict[str, Any]) -> Project:
        """
        Update a project
        
        Args:
            project_id: The ID of the project
            project_data: The updated data
            
        Returns:
            The updated project
            
        Raises:
            NotFoundException: If the project is not found
            DatabaseException: If there's a database error
        """
        self.logger.info(f"Updating project with ID: {project_id}")
        try:
            # First check if project exists
            project = await self.get_by_id(project_id)
            
            # Update fields
            for key, value in project_data.items():
                if hasattr(project, key):
                    setattr(project, key, value)
            
            # Update timestamp if it exists
            if hasattr(project, "updated_at"):
                project.updated_at = datetime.utcnow()
            
            # Commit changes
            self.session.add(project)
            self.session.commit()
            self.session.refresh(project)
            
            self.logger.info(f"Updated project with ID: {project_id}")
            return project
        except Exception as e:
            self.session.rollback()
            if isinstance(e, NotFoundException):
                raise
            self.logger.error(f"Error updating project: {str(e)}")
            self.logger.error(traceback.format_exc())
            raise DatabaseException(f"Failed to update project: {str(e)}")
    
    async def delete(self, project_id: uuid.UUID) -> bool:
        """
        Delete a project
        
        Args:
            project_id: The ID of the project
            
        Returns:
            True if successful
            
        Raises:
            NotFoundException: If the project is not found
            DatabaseException: If there's a database error
        """
        self.logger.info(f"Deleting project with ID: {project_id}")
        try:
            # First check if project exists
            project = await self.get_by_id(project_id)
            
            # Delete the project (associated ProjectTrack entries should be deleted
            # by the service layer before calling this method)
            self.session.delete(project)
            self.session.commit()
            
            self.logger.info(f"Deleted project with ID: {project_id}")
            return True
        except Exception as e:
            self.session.rollback()
            if isinstance(e, NotFoundException):
                raise
            self.logger.error(f"Error deleting project: {str(e)}")
            self.logger.error(traceback.format_exc())
            raise DatabaseException(f"Failed to delete project: {str(e)}")