from fastapi import APIRouter, Depends, status
from typing import Any, List, Dict
from uuid import UUID

from app2.api.dependencies import get_current_user, get_project_service, get_file_service
from app2.services.project_service import ProjectService
from app2.services.file_service import FileService
from app2.core.exceptions import ServiceException, NotFoundException, ForbiddenException
from app2.core.logging import get_api_logger
from app2.models.project import ProjectRead, ProjectWithTracks, ProjectCreate, ProjectUpdate
from app2.models.track import TrackCreate, TrackUpdate

router = APIRouter()
logger = get_api_logger("projects")

@router.get("", response_model=List[ProjectRead])
@router.get("/", response_model=List[ProjectRead])
async def get_projects(
    current_user: Dict[str, Any] = Depends(get_current_user),
    project_service: ProjectService = Depends(get_project_service)
) -> List[ProjectRead]:
    """
    Get all projects for the current user
    """
    logger.info(f"Getting projects for user ID: {current_user['id']}")
    return await project_service.get_user_projects(current_user["id"])

@router.post("", response_model=ProjectWithTracks, status_code=status.HTTP_201_CREATED)
@router.post("/", response_model=ProjectWithTracks, status_code=status.HTTP_201_CREATED)
async def create_project(
    project_data: Dict[str, Any],
    current_user: Dict[str, Any] = Depends(get_current_user),
    project_service: ProjectService = Depends(get_project_service),
    file_service = Depends(get_file_service)
) -> ProjectWithTracks:
    """
    Create a new project with all associated tracks and files
    
    This endpoint handles creating a complete project structure in one request:
    - The project itself
    - Multiple tracks
    - Audio files for audio tracks
    - MIDI files for MIDI tracks
    - Instrument files for instrument tracks
    """
    logger.info(f"Creating project for user ID: {current_user['id']}")
    logger.info(f"Project data: {project_data}")
    return await project_service.create_project(
        current_user["id"], 
        project_data, 
        file_service.file_repository
    )

@router.get("/{project_id}", response_model=ProjectWithTracks)
async def get_project(
    project_id: UUID,
    current_user: Dict[str, Any] = Depends(get_current_user),
    project_service: ProjectService = Depends(get_project_service)
) -> ProjectWithTracks:
    """
    Get a specific project by ID
    """
    logger.info(f"Getting project with ID: {project_id} for user: {current_user['id']}")
    return await project_service.get_project(str(project_id), current_user["id"])

@router.patch("/{project_id}", response_model=ProjectRead)
async def update_project(
    project_id: UUID,
    project_update: ProjectUpdate,
    current_user: Dict[str, Any] = Depends(get_current_user),
    project_service: ProjectService = Depends(get_project_service)
) -> ProjectRead:
    """
    Update a project
    """
    logger.info(f"Updating project with ID: {project_id} for user: {current_user['id']}")
    logger.info(f"Project update: {project_update}")
    return await project_service.update_project(
        str(project_id), 
        current_user["id"], 
        project_update.dict(exclude_unset=True)
    )

@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_project(
    project_id: UUID,
    current_user: Dict[str, Any] = Depends(get_current_user),
    project_service: ProjectService = Depends(get_project_service)
) -> None:
    """
    Delete a project
    """
    logger.info(f"Deleting project with ID: {project_id} for user: {current_user['id']}")
    await project_service.delete_project(str(project_id), current_user["id"])
    return None

@router.post("/{project_id}/tracks", response_model=ProjectWithTracks)
async def add_track(
    project_id: UUID,
    track_data: Dict[str, Any],
    current_user: Dict[str, Any] = Depends(get_current_user),
    project_service: ProjectService = Depends(get_project_service),
    file_service = Depends(get_file_service)
) -> ProjectWithTracks:
    """
    Add a track to a project
    
    This endpoint handles creating new tracks with associated files:
    - Track metadata
    - Audio files for audio tracks
    - MIDI files for MIDI tracks
    - Instrument files for instrument tracks
    """
    logger.info(f"Adding track to project with ID: {project_id} for user: {current_user['id']}")
    return await project_service.add_track(
        str(project_id),
        current_user["id"],
        track_data,
        file_service.file_repository
    )

@router.patch("/{project_id}/tracks/{track_id}", response_model=ProjectWithTracks)
async def update_track(
    project_id: UUID,
    track_id: UUID,
    track_data: Dict[str, Any],
    current_user: Dict[str, Any] = Depends(get_current_user),
    project_service: ProjectService = Depends(get_project_service),
    file_service = Depends(get_file_service)
) -> ProjectWithTracks:
    """
    Update a track in a project
    
    This endpoint handles updating track properties along with associated files:
    - Track metadata
    - Audio files for audio tracks
    - MIDI files for MIDI tracks
    - Instrument files for instrument tracks
    """
    logger.info(f"Updating track with ID: {track_id} in project with ID: {project_id} for user: {current_user['id']}")
    return await project_service.update_track(
        str(project_id),
        current_user["id"],
        str(track_id),
        track_data,
        file_service.file_repository
    )

@router.delete("/{project_id}/tracks/{track_id}", response_model=ProjectWithTracks)
async def delete_track(
    project_id: UUID,
    track_id: UUID,
    current_user: Dict[str, Any] = Depends(get_current_user),
    project_service: ProjectService = Depends(get_project_service)
) -> ProjectWithTracks:
    """
    Delete a track from a project
    """
    logger.info(f"Deleting track with ID: {track_id} from project with ID: {project_id} for user: {current_user['id']}")
    return await project_service.remove_track(
        str(project_id),
        current_user["id"],
        str(track_id)
    )