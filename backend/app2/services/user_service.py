from typing import Dict, Any, Optional
import traceback

from app2.core.logging import get_service_logger
from app2.core.exceptions import ServiceException, NotFoundException, UnauthorizedException
from app2.repositories.user_repository import UserRepository
from app2.infrastructure.database.supabase_client import supabase

logger = get_service_logger("user")

class UserService:
    """Service for user operations"""
    
    def __init__(self, user_repository: UserRepository):
        """
        Initialize the service with repositories
        
        Args:
            user_repository: The repository for user operations
        """
        self.user_repository = user_repository
        
    async def get_profile(self, user_id: str) -> Dict[str, Any]:
        """
        Get a user's profile
        
        Args:
            user_id: The ID of the user
            
        Returns:
            The user profile
            
        Raises:
            NotFoundException: If the profile is not found
            ServiceException: If the operation fails
        """
        logger.info(f"Getting profile for user ID: {user_id}")
        try:
            profile = await self.user_repository.get_profile(user_id)
            logger.info(f"Found profile for user ID: {user_id}")
            return profile
        except Exception as e:
            if isinstance(e, NotFoundException):
                raise
            logger.error(f"Error getting user profile: {str(e)}")
            logger.error(traceback.format_exc())
            raise ServiceException(f"Failed to get user profile: {str(e)}")
            
    async def update_profile(self, user_id: str, profile_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Update a user's profile
        
        Args:
            user_id: The ID of the user
            profile_data: The updated profile data
            
        Returns:
            The updated profile
            
        Raises:
            NotFoundException: If the profile is not found
            ServiceException: If the operation fails
        """
        logger.info(f"Updating profile for user ID: {user_id}")
        try:
            # Filter out fields that cannot be updated
            safe_data = {k: v for k, v in profile_data.items() if k not in ["id", "email", "created_at"]}
            
            profile = await self.user_repository.update_profile(user_id, safe_data)
            logger.info(f"Updated profile for user ID: {user_id}")
            return profile
        except Exception as e:
            if isinstance(e, NotFoundException):
                raise
            logger.error(f"Error updating user profile: {str(e)}")
            logger.error(traceback.format_exc())
            raise ServiceException(f"Failed to update user profile: {str(e)}")
            
    async def change_password(self, user_id: str, current_password: str, new_password: str) -> bool:
        """
        Change a user's password
        
        Args:
            user_id: The ID of the user
            current_password: The current password
            new_password: The new password
            
        Returns:
            True if password was changed successfully
            
        Raises:
            UnauthorizedException: If current password is invalid
            ServiceException: If the operation fails
        """
        logger.info(f"Changing password for user ID: {user_id}")
        try:
            # First verify the current password by attempting to sign in
            # Get user email from profile
            profile = await self.get_profile(user_id)
            email = profile.get("email")
            
            if not email:
                logger.error(f"No email found for user ID: {user_id}")
                raise ServiceException("User profile is incomplete")
                
            # Try to authenticate with current password
            try:
                auth_response = supabase.client.auth.sign_in_with_password({
                    "email": email,
                    "password": current_password
                })
                
                if not auth_response.user:
                    logger.error(f"Authentication failed for user ID: {user_id}")
                    raise UnauthorizedException("Current password is incorrect")
            except Exception as auth_err:
                logger.error(f"Authentication failed: {str(auth_err)}")
                raise UnauthorizedException("Current password is incorrect")
                
            # Change password using Supabase Auth
            supabase.client.auth.update_user({"password": new_password})
            
            logger.info(f"Password changed for user ID: {user_id}")
            return True
        except Exception as e:
            if isinstance(e, UnauthorizedException):
                raise
            logger.error(f"Error changing password: {str(e)}")
            logger.error(traceback.format_exc())
            raise ServiceException(f"Failed to change password: {str(e)}")