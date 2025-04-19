"""
User repository for database operations using SQLModel
"""
from typing import Dict, Any, List, Optional
from sqlmodel import Session, select
import traceback
import uuid

from app2.models.user import User
from app2.core.exceptions import DatabaseException, NotFoundException
from .base_repository import BaseRepository

class UserRepository(BaseRepository[User]):
    """Repository for user operations"""
    
    def __init__(self, session: Session):
        """
        Initialize the repository with User model class and session
        
        Args:
            session: The SQLModel session for database operations
        """
        super().__init__(User, session)
        
    async def get_profile(self, user_id: uuid.UUID) -> User:
        """
        Get a user's profile
        
        Args:
            user_id: The ID of the user
            
        Returns:
            The user profile as User object
            
        Raises:
            NotFoundException: If the profile is not found
            DatabaseException: If the operation fails
        """
        self.logger.info(f"Getting profile for user {user_id}")
        try:
            result = await self.find_by_id(str(user_id))
            self.logger.info(f"Found profile for user {user_id}")
            return result
        except Exception as e:
            if isinstance(e, NotFoundException):
                raise
            self.logger.error(f"Error getting user profile: {str(e)}")
            self.logger.error(traceback.format_exc())
            raise DatabaseException(f"Failed to get user profile: {str(e)}")
            
    async def update_profile(self, user_id: uuid.UUID, profile_data: Dict[str, Any]) -> User:
        """
        Update a user's profile
        
        Args:
            user_id: The ID of the user
            profile_data: The updated profile data
            
        Returns:
            The updated profile as User object
            
        Raises:
            NotFoundException: If the profile is not found
            DatabaseException: If the operation fails
        """
        self.logger.info(f"Updating profile for user {user_id}")
        try:
            result = await self.update(str(user_id), profile_data)
            self.logger.info(f"Updated profile for user {user_id}")
            return result
        except Exception as e:
            if isinstance(e, NotFoundException):
                raise
            self.logger.error(f"Error updating user profile: {str(e)}")
            self.logger.error(traceback.format_exc())
            raise DatabaseException(f"Failed to update user profile: {str(e)}")
            
    async def create_profile(self, user_id: uuid.UUID, email: str, username: Optional[str] = None, display_name: Optional[str] = None) -> User:
        """
        Create a new user profile
        
        Args:
            user_id: The ID of the user
            email: The user's email
            username: The user's username (optional)
            display_name: The user's display name (optional)
            
        Returns:
            The created profile as User object
            
        Raises:
            DatabaseException: If the operation fails
        """
        self.logger.info(f"Creating profile for user {user_id}")
        try:
            # Check if profile already exists
            try:
                existing_profile = await self.find_by_id(str(user_id))
                self.logger.info(f"Profile already exists for user {user_id}")
                return existing_profile
            except NotFoundException:
                # Profile doesn't exist, proceed with creation
                pass
                
            profile_data = {
                "id": user_id,
                "email": email,
                "username": username,
                "display_name": display_name,
                "avatar_url": None
            }
            
            result = await self.create(profile_data)
            self.logger.info(f"Created profile for user {user_id}")
            return result
        except Exception as e:
            if isinstance(e, NotFoundException):
                # This means we're creating a new profile, so we can ignore this exception
                pass
            self.logger.error(f"Error creating user profile: {str(e)}")
            self.logger.error(traceback.format_exc())
            raise DatabaseException(f"Failed to create user profile: {str(e)}")
            
    async def find_by_email(self, email: str) -> Optional[User]:
        """
        Find a user by email
        
        Args:
            email: The email to search for
            
        Returns:
            The user if found, None otherwise
            
        Raises:
            DatabaseException: If the query fails
        """
        self.logger.info(f"Finding user with email {email}")
        try:
            statement = select(self.model_class).where(self.model_class.email == email)
            result = self.session.exec(statement).first()
            
            if result:
                self.logger.info(f"Found user with email {email}")
            else:
                self.logger.info(f"No user found with email {email}")
                
            return result
        except Exception as e:
            self.logger.error(f"Error finding user by email: {str(e)}")
            self.logger.error(traceback.format_exc())
            raise DatabaseException(f"Failed to find user by email: {str(e)}")