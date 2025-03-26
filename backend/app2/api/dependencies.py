from typing import Dict, Any, Optional
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer

from app2.core.config import settings
from app2.core.exceptions import UnauthorizedException
from app2.core.logging import get_logger

from app2.repositories.user_repository import UserRepository
from app2.repositories.project_repository import ProjectRepository
from app2.repositories.sound_repository import SoundRepository

from app2.services.auth_service import AuthService
from app2.services.user_service import UserService
from app2.services.project_service import ProjectService
from app2.services.sound_service import SoundService

logger = get_logger("beatgen.api.dependencies")

# OAuth2 scheme for token extraction
oauth2_scheme = OAuth2PasswordBearer(tokenUrl=f"{settings.app.API_PREFIX}/auth/login")

# Repository instances
def get_user_repository() -> UserRepository:
    """Get the user repository instance"""
    return UserRepository()
    
def get_project_repository() -> ProjectRepository:
    """Get the project repository instance"""
    return ProjectRepository()
    
def get_sound_repository() -> SoundRepository:
    """Get the sound repository instance"""
    return SoundRepository()
    
# Service instances
def get_auth_service(
    user_repository: UserRepository = Depends(get_user_repository)
) -> AuthService:
    """Get the auth service instance"""
    return AuthService(user_repository)
    
def get_user_service(
    user_repository: UserRepository = Depends(get_user_repository)
) -> UserService:
    """Get the user service instance"""
    return UserService(user_repository)
    
def get_project_service(
    project_repository: ProjectRepository = Depends(get_project_repository)
) -> ProjectService:
    """Get the project service instance"""
    return ProjectService(project_repository)
    
def get_sound_service(
    sound_repository: SoundRepository = Depends(get_sound_repository)
) -> SoundService:
    """Get the sound service instance"""
    return SoundService(sound_repository)
    
# Auth dependency
async def get_current_user(
    token: str = Depends(oauth2_scheme),
    auth_service: AuthService = Depends(get_auth_service)
) -> Dict[str, Any]:
    """
    Get the current authenticated user
    
    Args:
        token: The JWT token from the request
        auth_service: The auth service
        
    Returns:
        The user info
        
    Raises:
        UnauthorizedException: If the token is invalid
    """
    try:
        return await auth_service.get_current_user(token)
    except Exception as e:
        logger.error(f"Authentication error: {str(e)}")
        raise UnauthorizedException("Could not validate credentials")