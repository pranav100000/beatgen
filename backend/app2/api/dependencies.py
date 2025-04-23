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
from app2.repositories.file_repository import FileRepository
from app2.repositories.audio_track_repository import AudioTrackRepository
from app2.repositories.midi_track_repository import MidiTrackRepository
from app2.repositories.sampler_track_repository import SamplerTrackRepository
from app2.repositories.drum_track_repository import DrumTrackRepository

from app2.services.auth_service import AuthService
from app2.services.user_service import UserService
from app2.services.project_service import ProjectService
from app2.services.track_service import TrackService
from app2.services.file_service import FileService
from app2.repositories.drum_sample_public_repository import DrumSamplePublicRepository
from app2.services.drum_sample_service import DrumSampleService

logger = get_logger("beatgen.api.dependencies")

# OAuth2 scheme for token extraction
oauth2_scheme = OAuth2PasswordBearer(tokenUrl=f"{settings.app.API_PREFIX}/auth/login")

# Database session dependency
SessionDep = Annotated[Session, Depends(get_session)]

# Repository instances
def get_user_repository(session: SessionDep) -> UserRepository:
    """Get the user repository instance"""
    return UserRepository(session)
    
def get_project_repository(session: SessionDep) -> ProjectRepository:
    """Get the project repository instance"""
    return ProjectRepository(session)
    
def get_file_repository(session: SessionDep) -> FileRepository:
    """Get the file repository instance"""
    return FileRepository(session)

def get_audio_track_repository(session: SessionDep) -> AudioTrackRepository:
    """Get the audio track repository instance"""
    return AudioTrackRepository(session)

def get_midi_track_repository(session: SessionDep) -> MidiTrackRepository:
    """Get the MIDI track repository instance"""
    return MidiTrackRepository(session)

def get_sampler_track_repository(session: SessionDep) -> SamplerTrackRepository:
    """Get the sampler track repository instance"""
    return SamplerTrackRepository(session)

def get_drum_track_repository(session: SessionDep) -> DrumTrackRepository:
    """Get the drum track repository instance"""
    return DrumTrackRepository(session)

def get_project_track_repository(session: SessionDep) -> ProjectTrackRepository:
    """Get the project-track repository instance"""
    return ProjectTrackRepository(session)

def get_drum_sample_public_repository(session: SessionDep) -> DrumSamplePublicRepository:
    """Get the drum sample public repository instance"""
    return DrumSamplePublicRepository(session)
    
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
    project_track_repository: Annotated[ProjectTrackRepository, Depends(get_project_track_repository)],
    track_service: Annotated[TrackService, Depends(lambda: get_track_service())]
) -> ProjectService:
    """Get the project service instance"""
    return ProjectService(project_repository, project_track_repository, track_service)
    
def get_track_service() -> TrackService:
    """Get the track service instance with specialized track repositories"""
    # This is a bit of a hack to avoid circular dependencies
    # We create a new session here to avoid the circular dependency issue
    session = next(get_session())
    
    audio_repository = AudioTrackRepository(session)
    midi_repository = MidiTrackRepository(session)
    sampler_repository = SamplerTrackRepository(session)
    drum_repository = DrumTrackRepository(session)
    project_track_repository = ProjectTrackRepository(session)
    file_repository = FileRepository(session)
    
    return TrackService(
        audio_repository=audio_repository,
        midi_repository=midi_repository,
        sampler_repository=sampler_repository,
        drum_repository=drum_repository,
        project_track_repository=project_track_repository,
        file_repository=file_repository
    )

def get_file_service(
    file_repository: Annotated[FileRepository, Depends(get_file_repository)]
) -> FileService:
    """Get the file service instance"""
    return FileService(file_repository)

def get_drum_sample_service(
    drum_sample_repository: Annotated[DrumSamplePublicRepository, Depends(get_drum_sample_public_repository)]
) -> DrumSampleService:
    """Get the drum sample service instance"""
    return DrumSampleService(drum_sample_repository)
    
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