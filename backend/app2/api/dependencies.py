from typing import Dict, Any, Optional, Annotated
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlmodel import Session

from app2.core.config import settings
from app2.core.exceptions import UnauthorizedException
from app2.core.logging import get_logger
from app2.infrastructure.database.sqlmodel_client import get_session

from app2.models.user import User
from app2.models.project import Project

from app2.repositories.user_repository import UserRepository
from app2.repositories.project_repository import ProjectRepository
from app2.repositories.project_track_repository import ProjectTrackRepository
from app2.repositories.track_repository import TrackRepository
from app2.repositories.file_repository import FileRepository

from app2.services.auth_service import AuthService
from app2.services.user_service import UserService
from app2.services.project_service import ProjectService
from app2.services.track_service import TrackService
from app2.services.file_service import FileService
from app2.models.file_models.audio_file import AudioFile

logger = get_logger("beatgen.api.dependencies")

# OAuth2 scheme for token extraction
oauth2_scheme = OAuth2PasswordBearer(tokenUrl=f"{settings.app.API_PREFIX}/auth/login")

# Database session dependency
SessionDep = Annotated[Session, Depends(get_session)]

# Repository instances
def get_user_repository(session: SessionDep) -> UserRepository:
    """
    Get the user repository instance with an active database session
    
    Args:
        session: The database session from dependency injection
        
    Returns:
        A UserRepository instance
    """
    return UserRepository(session)
    
def get_project_repository(session: SessionDep) -> ProjectRepository:
    """
    Get the project repository instance with an active database session
    
    Args:
        session: The database session from dependency injection
        
    Returns:
        A ProjectRepository instance
    """
    return ProjectRepository(session)
    
def get_file_repository(session: SessionDep) -> FileRepository:
    """
    Get the file repository instance with an active database session
    
    Args:
        session: The database session from dependency injection
        
    Returns:
        A FileRepository instance
    """
    return FileRepository(session)

def get_track_repository(session: SessionDep) -> TrackRepository:
    """
    Get the track repository instance with an active database session
    
    Args:
        session: The database session from dependency injection
        
    Returns:
        A TrackRepository instance
    """
    return TrackRepository(session)

def get_project_track_repository(session: SessionDep) -> ProjectTrackRepository:
    """
    Get the project-track repository instance with an active database session
    
    Args:
        session: The database session from dependency injection
        
    Returns:
        A ProjectTrackRepository instance
    """
    return ProjectTrackRepository(session)
    
# Service instances
def get_auth_service(
    user_repository: Annotated[UserRepository, Depends(get_user_repository)]
) -> AuthService:
    """Get the auth service instance"""
    return AuthService(user_repository)
    
def get_user_service(
    user_repository: Annotated[UserRepository, Depends(get_user_repository)]
) -> UserService:
    """Get the user service instance"""
    return UserService(user_repository)
    
def get_project_service(
    project_repository: Annotated[ProjectRepository, Depends(get_project_repository)],
    track_repository: Annotated[TrackRepository, Depends(get_track_repository)],
    project_track_repository: Annotated[ProjectTrackRepository, Depends(get_project_track_repository)]
) -> ProjectService:
    """Get the project service instance"""
    return ProjectService(project_repository, track_repository, project_track_repository)
    
def get_track_service(
    track_repository: Annotated[TrackRepository, Depends(get_track_repository)],
    file_repository: Annotated[FileRepository, Depends(get_file_repository)]
) -> TrackService:
    """Get the track service instance"""
    return TrackService(track_repository, file_repository)

def get_file_service(
    track_repository: Annotated[TrackRepository, Depends(get_track_repository)],
    file_repository: Annotated[FileRepository, Depends(get_file_repository)]
) -> FileService:
    """Get the file service instance"""
    return FileService(track_repository, file_repository)
    
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