from typing import Dict, Any, Optional
import traceback

from app2.core.logging import get_service_logger
from app2.core.exceptions import UnauthorizedException, ServiceException
from app2.infrastructure.database.supabase_client import supabase
from app2.repositories.user_repository import UserRepository

logger = get_service_logger("auth")

class AuthService:
    """Service for authentication operations"""
    
    def __init__(self, user_repository: UserRepository):
        """
        Initialize the service with repositories
        
        Args:
            user_repository: The repository for user operations
        """
        self.user_repository = user_repository
        
    async def create_user(self, email: str, password: str, username: Optional[str] = None, display_name: Optional[str] = None) -> Dict[str, Any]:
        """
        Register a new user account
        
        Args:
            email: User's email address
            password: User's password
            username: Optional username
            display_name: Optional display name
            
        Returns:
            Dict with access_token, token_type, and user_id
            
        Raises:
            ServiceException: If registration fails
        """
        logger.info(f"Creating new user with email: {email}")
        try:
            # Register user with Supabase Auth
            auth_response = supabase.client.auth.sign_up({
                "email": email,
                "password": password
            })
            
            # Extract user data
            if not auth_response.user:
                logger.error("No user returned from Supabase sign_up")
                raise ServiceException("Failed to create user account")
                
            user_id = auth_response.user.id
            logger.info(f"User created with ID: {user_id}")
            
            # Create user profile in database
            await self.user_repository.create_profile(
                user_id=user_id,
                email=email,
                username=username,
                display_name=display_name
            )
            
            # Return token and user info
            return {
                "access_token": auth_response.session.access_token,
                "token_type": "bearer",
                "user_id": user_id
            }
        except Exception as e:
            logger.error(f"Failed to create user: {str(e)}")
            logger.error(traceback.format_exc())
            raise ServiceException(f"User registration failed: {str(e)}")
            
    async def login_user(self, email: str, password: str) -> Dict[str, Any]:
        """
        Authenticate user with email and password
        
        Args:
            email: User's email address
            password: User's password
            
        Returns:
            Dict with access_token, token_type, and user_id
            
        Raises:
            UnauthorizedException: If credentials are invalid
            ServiceException: If login fails due to other reasons
        """
        logger.info(f"Authenticating user with email: {email}")
        try:
            # Sign in with Supabase Auth
            auth_response = supabase.client.auth.sign_in_with_password({
                "email": email,
                "password": password
            })
            
            # Extract user data
            if not auth_response.user:
                logger.error("No user returned from Supabase sign_in")
                raise UnauthorizedException("Invalid email or password")
                
            user_id = auth_response.user.id
            logger.info(f"User authenticated with ID: {user_id}")
            
            # Return token and user info
            return {
                "access_token": auth_response.session.access_token,
                "token_type": "bearer",
                "user_id": user_id
            }
        except Exception as e:
            logger.error(f"Failed to authenticate user: {str(e)}")
            logger.error(traceback.format_exc())
            if "invalid" in str(e).lower() or "not found" in str(e).lower():
                raise UnauthorizedException("Invalid email or password")
            raise ServiceException(f"Authentication failed: {str(e)}")
            
    async def send_password_reset(self, email: str) -> bool:
        """
        Send password reset email
        
        Args:
            email: User's email address
            
        Returns:
            True if email was sent successfully
            
        Raises:
            ServiceException: If operation fails
        """
        logger.info(f"Sending password reset email to: {email}")
        try:
            # Use Supabase Auth to send password reset email
            supabase.client.auth.reset_password_email(email)
            logger.info(f"Password reset email sent to: {email}")
            return True
        except Exception as e:
            logger.error(f"Failed to send password reset email: {str(e)}")
            logger.error(traceback.format_exc())
            raise ServiceException(f"Failed to send password reset email: {str(e)}")
        
    async def verify_token(self, token: str) -> Dict[str, Any]:
        """
        Verify a JWT token and get the user info
        
        Args:
            token: The JWT token to verify
            
        Returns:
            The user info from the token
            
        Raises:
            UnauthorizedException: If the token is invalid
        """
        logger.info(f"Verifying token: {token[:10]}...")
        try:
            user_info = supabase.verify_token(token)
            logger.info(f"Successfully verified token for user: {user_info['id']}")
            return user_info
        except Exception as e:
            logger.error(f"Token verification failed: {str(e)}")
            logger.error(traceback.format_exc())
            raise UnauthorizedException(f"Invalid token: {str(e)}")
            
    async def get_current_user(self, token: str) -> Dict[str, Any]:
        """
        Get the current user from a token
        
        Args:
            token: The JWT token
            
        Returns:
            The user info
            
        Raises:
            UnauthorizedException: If the token is invalid
        """
        logger.info(f"Getting current user from token: {token[:10]}...")
        return await self.verify_token(token)
        
    async def create_user_profile(self, user_id: str, email: str, username: Optional[str] = None, display_name: Optional[str] = None) -> Dict[str, Any]:
        """
        Create a new user profile in the database
        
        Args:
            user_id: The ID of the user
            email: The user's email
            username: The user's username (optional)
            display_name: The user's display name (optional)
            
        Returns:
            The created profile
            
        Raises:
            ServiceException: If the operation fails
        """
        logger.info(f"Creating user profile for user ID: {user_id}")
        try:
            profile = await self.user_repository.create_profile(user_id, email, username, display_name)
            logger.info(f"Created user profile for user ID: {user_id}")
            return profile
        except Exception as e:
            logger.error(f"Error creating user profile: {str(e)}")
            logger.error(traceback.format_exc())
            raise ServiceException(f"Failed to create user profile: {str(e)}")