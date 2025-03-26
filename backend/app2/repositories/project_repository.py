from typing import Dict, Any, List, Optional
from uuid import UUID
import traceback
from datetime import datetime

from app2.core.exceptions import DatabaseException, NotFoundException
from .base_repository import BaseRepository

class ProjectRepository(BaseRepository):
    """Repository for project operations"""
    
    def __init__(self):
        """Initialize the repository with the project table"""
        super().__init__("project")
        
    async def find_project_with_tracks(self, project_id: str, user_id: str) -> Dict[str, Any]:
        """
        Find a project with all its tracks
        
        Args:
            project_id: The ID of the project
            user_id: The ID of the user who owns the project
            
        Returns:
            The project with tracks
            
        Raises:
            NotFoundException: If the project is not found
            DatabaseException: If the query fails
        """
        self.logger.info(f"Finding project with ID {project_id} for user {user_id}")
        try:
            from app2.infrastructure.database.supabase_client import supabase
            
            result = supabase.execute_query(
                self.table_name,
                lambda table: table.select("*").eq("id", str(project_id)).eq("user_id", str(user_id)).single()
            )
            
            if not result:
                self.logger.error(f"Project with ID {project_id} not found for user {user_id}")
                raise NotFoundException("Project", project_id)
                
            self.logger.info(f"Found project with ID {project_id} for user {user_id}")
            return result
        except Exception as e:
            if isinstance(e, NotFoundException):
                raise
            self.logger.error(f"Error finding project with tracks: {str(e)}")
            self.logger.error(traceback.format_exc())
            raise DatabaseException(f"Failed to find project: {str(e)}")
            
    async def add_track_to_project(self, project_id: str, user_id: str, track_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Add a track to a project
        
        Args:
            project_id: The ID of the project
            user_id: The ID of the user who owns the project
            track_data: The track data to add
            
        Returns:
            The updated project
            
        Raises:
            NotFoundException: If the project is not found
            DatabaseException: If the operation fails
        """
        self.logger.info(f"Adding track to project {project_id}")
        try:
            # Get the existing project
            project = await self.find_project_with_tracks(project_id, user_id)
            
            # Get existing tracks or empty list
            tracks = project.get("tracks", [])
            
            # Add the new track
            tracks.append(track_data)
            
            # Update the project
            update_data = {
                "tracks": tracks,
                "updated_at": datetime.utcnow().isoformat()
            }
            
            # Update the project
            updated_project = await self.update(project_id, update_data)
            
            self.logger.info(f"Added track to project {project_id}")
            return updated_project
        except Exception as e:
            if isinstance(e, NotFoundException):
                raise
            self.logger.error(f"Error adding track to project: {str(e)}")
            self.logger.error(traceback.format_exc())
            raise DatabaseException(f"Failed to add track to project: {str(e)}")
            
    async def update_track_in_project(self, project_id: str, user_id: str, track_id: str, track_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Update a track in a project
        
        Args:
            project_id: The ID of the project
            user_id: The ID of the user who owns the project
            track_id: The ID of the track to update
            track_data: The updated track data
            
        Returns:
            The updated project
            
        Raises:
            NotFoundException: If the project or track is not found
            DatabaseException: If the operation fails
        """
        self.logger.info(f"Updating track {track_id} in project {project_id}")
        try:
            # Get the existing project
            project = await self.find_project_with_tracks(project_id, user_id)
            
            # Get existing tracks
            tracks = project.get("tracks", [])
            
            # Update the specific track
            updated_tracks = []
            track_found = False
            
            for track in tracks:
                if track["id"] == str(track_id):
                    updated_tracks.append(track_data)
                    track_found = True
                else:
                    updated_tracks.append(track)
            
            if not track_found:
                self.logger.error(f"Track {track_id} not found in project {project_id}")
                raise NotFoundException("Track", track_id)
            
            # Update the project
            update_data = {
                "tracks": updated_tracks,
                "updated_at": datetime.utcnow().isoformat()
            }
            
            # Update the project
            updated_project = await self.update(project_id, update_data)
            
            self.logger.info(f"Updated track {track_id} in project {project_id}")
            return updated_project
        except Exception as e:
            if isinstance(e, NotFoundException):
                raise
            self.logger.error(f"Error updating track in project: {str(e)}")
            self.logger.error(traceback.format_exc())
            raise DatabaseException(f"Failed to update track in project: {str(e)}")
            
    async def remove_track_from_project(self, project_id: str, user_id: str, track_id: str) -> Dict[str, Any]:
        """
        Remove a track from a project
        
        Args:
            project_id: The ID of the project
            user_id: The ID of the user who owns the project
            track_id: The ID of the track to remove
            
        Returns:
            The updated project
            
        Raises:
            NotFoundException: If the project or track is not found
            DatabaseException: If the operation fails
        """
        self.logger.info(f"Removing track {track_id} from project {project_id}")
        try:
            # Get the existing project
            project = await self.find_project_with_tracks(project_id, user_id)
            
            # Get existing tracks
            tracks = project.get("tracks", [])
            
            # Filter out the track to delete
            updated_tracks = [track for track in tracks if track["id"] != str(track_id)]
            
            if len(updated_tracks) == len(tracks):
                self.logger.error(f"Track {track_id} not found in project {project_id}")
                raise NotFoundException("Track", track_id)
            
            # Update the project
            update_data = {
                "tracks": updated_tracks,
                "updated_at": datetime.utcnow().isoformat()
            }
            
            # Update the project
            updated_project = await self.update(project_id, update_data)
            
            self.logger.info(f"Removed track {track_id} from project {project_id}")
            return updated_project
        except Exception as e:
            if isinstance(e, NotFoundException):
                raise
            self.logger.error(f"Error removing track from project: {str(e)}")
            self.logger.error(traceback.format_exc())
            raise DatabaseException(f"Failed to remove track from project: {str(e)}")