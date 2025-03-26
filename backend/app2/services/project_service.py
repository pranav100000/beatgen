from typing import Dict, Any, List, Optional
from uuid import UUID
import traceback
from datetime import datetime

from app2.core.logging import get_service_logger
from app2.core.exceptions import ServiceException, NotFoundException, ForbiddenException
from app2.repositories.project_repository import ProjectRepository

logger = get_service_logger("project")

class ProjectService:
    """Service for project operations"""
    
    def __init__(self, project_repository: ProjectRepository):
        """
        Initialize the service with repositories
        
        Args:
            project_repository: The repository for project operations
        """
        self.project_repository = project_repository
        
    async def get_user_projects(self, user_id: str) -> List[Dict[str, Any]]:
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
            projects = await self.project_repository.find_by_user(user_id)
            logger.info(f"Found {len(projects)} projects for user ID: {user_id}")
            return projects
        except Exception as e:
            logger.error(f"Error getting user projects: {str(e)}")
            logger.error(traceback.format_exc())
            raise ServiceException(f"Failed to get user projects: {str(e)}")
            
    async def get_project(self, project_id: str, user_id: str) -> Dict[str, Any]:
        """
        Get a project by ID
        
        Args:
            project_id: The ID of the project
            user_id: The ID of the user
            
        Returns:
            The project
            
        Raises:
            NotFoundException: If the project is not found
            ForbiddenException: If the user does not own the project
            ServiceException: If the operation fails
        """
        logger.info(f"Getting project with ID: {project_id} for user ID: {user_id}")
        try:
            project = await self.project_repository.find_project_with_tracks(project_id, user_id)
            
            # Verify project ownership
            if project.get("user_id") != user_id:
                logger.error(f"User {user_id} does not own project {project_id}")
                raise ForbiddenException("You do not have permission to access this project")
                
            logger.info(f"Found project with ID: {project_id} for user ID: {user_id}")
            return project
        except Exception as e:
            if isinstance(e, (NotFoundException, ForbiddenException)):
                raise
            logger.error(f"Error getting project: {str(e)}")
            logger.error(traceback.format_exc())
            raise ServiceException(f"Failed to get project: {str(e)}")
            
    async def create_project(self, user_id: str, project_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Create a new project
        
        Args:
            user_id: The ID of the user
            project_data: The project data
            
        Returns:
            The created project
            
        Raises:
            ServiceException: If the operation fails
        """
        logger.info(f"Creating project for user ID: {user_id}")
        try:
            # Add user ID and timestamp
            project_data["user_id"] = user_id
            
            # Set tracks to empty list if not provided
            if "tracks" not in project_data:
                project_data["tracks"] = []
                
            # Create the project
            project = await self.project_repository.create(project_data)
            
            logger.info(f"Created project with ID: {project.get('id')} for user ID: {user_id}")
            return project
        except Exception as e:
            logger.error(f"Error creating project: {str(e)}")
            logger.error(traceback.format_exc())
            raise ServiceException(f"Failed to create project: {str(e)}")
            
    async def update_project(self, project_id: str, user_id: str, project_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Update a project
        
        Args:
            project_id: The ID of the project
            user_id: The ID of the user
            project_data: The updated project data
            
        Returns:
            The updated project
            
        Raises:
            NotFoundException: If the project is not found
            ForbiddenException: If the user does not own the project
            ServiceException: If the operation fails
        """
        logger.info(f"Updating project with ID: {project_id} for user ID: {user_id}")
        try:
            # First get the project to verify ownership
            project = await self.get_project(project_id, user_id)
            
            # Filter out fields that cannot be updated
            safe_data = {k: v for k, v in project_data.items() if k not in ["id", "user_id", "created_at"]}
            
            # Add updated timestamp
            safe_data["updated_at"] = datetime.utcnow().isoformat()
            
            # Update the project
            updated_project = await self.project_repository.update(project_id, safe_data)
            
            logger.info(f"Updated project with ID: {project_id} for user ID: {user_id}")
            return updated_project
        except Exception as e:
            if isinstance(e, (NotFoundException, ForbiddenException)):
                raise
            logger.error(f"Error updating project: {str(e)}")
            logger.error(traceback.format_exc())
            raise ServiceException(f"Failed to update project: {str(e)}")
            
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
            
    async def add_track(self, project_id: str, user_id: str, track_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Add a track to a project
        
        Args:
            project_id: The ID of the project
            user_id: The ID of the user
            track_data: The track data
            
        Returns:
            The updated project
            
        Raises:
            NotFoundException: If the project is not found
            ForbiddenException: If the user does not own the project
            ServiceException: If the operation fails
        """
        logger.info(f"Adding track to project with ID: {project_id} for user ID: {user_id}")
        try:
            # Add track to project
            updated_project = await self.project_repository.add_track_to_project(project_id, user_id, track_data)
            
            logger.info(f"Added track to project with ID: {project_id} for user ID: {user_id}")
            return updated_project
        except Exception as e:
            if isinstance(e, (NotFoundException, ForbiddenException)):
                raise
            logger.error(f"Error adding track to project: {str(e)}")
            logger.error(traceback.format_exc())
            raise ServiceException(f"Failed to add track to project: {str(e)}")
            
    async def update_track(self, project_id: str, user_id: str, track_id: str, track_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Update a track in a project
        
        Args:
            project_id: The ID of the project
            user_id: The ID of the user
            track_id: The ID of the track
            track_data: The updated track data
            
        Returns:
            The updated project
            
        Raises:
            NotFoundException: If the project or track is not found
            ForbiddenException: If the user does not own the project
            ServiceException: If the operation fails
        """
        logger.info(f"Updating track with ID: {track_id} in project with ID: {project_id} for user ID: {user_id}")
        try:
            # Update track in project
            updated_project = await self.project_repository.update_track_in_project(project_id, user_id, track_id, track_data)
            
            logger.info(f"Updated track with ID: {track_id} in project with ID: {project_id} for user ID: {user_id}")
            return updated_project
        except Exception as e:
            if isinstance(e, (NotFoundException, ForbiddenException)):
                raise
            logger.error(f"Error updating track in project: {str(e)}")
            logger.error(traceback.format_exc())
            raise ServiceException(f"Failed to update track in project: {str(e)}")
            
    async def remove_track(self, project_id: str, user_id: str, track_id: str) -> Dict[str, Any]:
        """
        Remove a track from a project
        
        Args:
            project_id: The ID of the project
            user_id: The ID of the user
            track_id: The ID of the track
            
        Returns:
            The updated project
            
        Raises:
            NotFoundException: If the project or track is not found
            ForbiddenException: If the user does not own the project
            ServiceException: If the operation fails
        """
        logger.info(f"Removing track with ID: {track_id} from project with ID: {project_id} for user ID: {user_id}")
        try:
            # Remove track from project
            updated_project = await self.project_repository.remove_track_from_project(project_id, user_id, track_id)
            
            logger.info(f"Removed track with ID: {track_id} from project with ID: {project_id} for user ID: {user_id}")
            return updated_project
        except Exception as e:
            if isinstance(e, (NotFoundException, ForbiddenException)):
                raise
            logger.error(f"Error removing track from project: {str(e)}")
            logger.error(traceback.format_exc())
            raise ServiceException(f"Failed to remove track from project: {str(e)}")