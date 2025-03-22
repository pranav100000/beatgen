from fastapi import APIRouter, Depends, HTTPException, status
from typing import Any, List
from datetime import datetime
from uuid import UUID

from app.core.security import get_current_user
from app.core.supabase import supabase
from app.schemas.project import Project, ProjectCreate, ProjectUpdate, Track

router = APIRouter()

@router.get("/", response_model=List[Project])
async def get_projects(
    current_user: dict = Depends(get_current_user)
) -> Any:
    """
    Get all projects for the current user
    """
    import logging
    import traceback
    logger = logging.getLogger("beatgen.projects")
    
    logger.info(f"Getting projects for user ID: {current_user['id']}")
    
    try:
        # Try to check if the projects table exists (depends on Supabase access level)
        try:
            metadata = supabase.table("project").select("count").limit(1).execute()
            logger.info(f"Project table access check: {metadata}")
        except Exception as table_err:
            logger.warning(f"Could not verify table existence: {str(table_err)}")
        
        # Query the projects table
        logger.info(f"Querying 'project' table for user ID: {current_user['id']}")
        response = supabase.table("project").select("*").eq("user_id", current_user["id"]).execute()
        
        # Debug response
        logger.info(f"Supabase response for projects: {response}")
        
        if hasattr(response, 'error') and response.error:
            logger.error(f"Error retrieving projects: {response.error.message}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Error retrieving projects: {response.error.message}"
            )
        
        # If projects table doesn't exist yet or is empty, return empty list
        if not response.data:
            logger.info(f"No projects found for user ID: {current_user['id']}")
            return []
            
        logger.info(f"Found {len(response.data)} projects for user ID: {current_user['id']}")
        return response.data
    
    except Exception as e:
        logger.error(f"Exception when getting projects: {str(e)}")
        logger.error(traceback.format_exc())
        
        # If table doesn't exist, return empty list instead of error
        if "relation \"projects\" does not exist" in str(e).lower():
            logger.warning("Projects table does not exist yet - returning empty list")
            return []
            
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error retrieving projects: {str(e)}"
        )

@router.post("/", response_model=Project)
async def create_project(
    project_data: ProjectCreate,
    current_user: dict = Depends(get_current_user)
) -> Any:
    """
    Create a new project
    """
    try:
        now = datetime.utcnow().isoformat()
        
        # Prepare project data
        project = {
            **project_data.dict(),
            "user_id": current_user["id"],
            "tracks": [],
            "created_at": now,
            "updated_at": now
        }
        
        # Insert project into Supabase
        response = supabase.table("projects").insert(project).execute()
        
        if response.error:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=response.error.message
            )
        
        return response.data[0]
    
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )

@router.get("/{project_id}", response_model=Project)
async def get_project(
    project_id: UUID,
    current_user: dict = Depends(get_current_user)
) -> Any:
    """
    Get a specific project by ID
    """
    try:
        response = supabase.table("projects").select("*").eq("id", str(project_id)).eq("user_id", current_user["id"]).single().execute()
        
        if response.error:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Project not found"
            )
        
        return response.data
    
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )

@router.patch("/{project_id}", response_model=Project)
async def update_project(
    project_id: UUID,
    project_update: ProjectUpdate,
    current_user: dict = Depends(get_current_user)
) -> Any:
    """
    Update a project
    """
    try:
        # Verify project exists and belongs to user
        check_response = supabase.table("projects").select("id").eq("id", str(project_id)).eq("user_id", current_user["id"]).single().execute()
        
        if check_response.error or not check_response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Project not found"
            )
        
        # Update project
        update_data = {
            **project_update.dict(exclude_unset=True),
            "updated_at": datetime.utcnow().isoformat()
        }
        
        response = supabase.table("projects").update(update_data).eq("id", str(project_id)).execute()
        
        if response.error:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=response.error.message
            )
        
        return response.data[0]
    
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )

@router.delete("/{project_id}")
async def delete_project(
    project_id: UUID,
    current_user: dict = Depends(get_current_user)
) -> Any:
    """
    Delete a project
    """
    try:
        # Verify project exists and belongs to user
        check_response = supabase.table("projects").select("id").eq("id", str(project_id)).eq("user_id", current_user["id"]).single().execute()
        
        if check_response.error or not check_response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Project not found"
            )
        
        # Delete project
        response = supabase.table("projects").delete().eq("id", str(project_id)).execute()
        
        if response.error:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=response.error.message
            )
        
        return {"message": "Project deleted successfully"}
    
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )

@router.post("/{project_id}/tracks", response_model=Project)
async def add_track(
    project_id: UUID,
    track_data: Track,
    current_user: dict = Depends(get_current_user)
) -> Any:
    """
    Add a track to a project
    """
    try:
        # Get project data including tracks
        project_response = supabase.table("projects").select("*").eq("id", str(project_id)).eq("user_id", current_user["id"]).single().execute()
        
        if project_response.error or not project_response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Project not found"
            )
        
        project = project_response.data
        tracks = project.get("tracks", [])
        
        # Add new track
        tracks.append(track_data.dict())
        
        # Update project with new tracks
        update_data = {
            "tracks": tracks,
            "updated_at": datetime.utcnow().isoformat()
        }
        
        response = supabase.table("projects").update(update_data).eq("id", str(project_id)).execute()
        
        if response.error:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=response.error.message
            )
        
        return response.data[0]
    
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )

@router.patch("/{project_id}/tracks/{track_id}", response_model=Project)
async def update_track(
    project_id: UUID,
    track_id: UUID,
    track_data: Track,
    current_user: dict = Depends(get_current_user)
) -> Any:
    """
    Update a track in a project
    """
    try:
        # Get project data including tracks
        project_response = supabase.table("projects").select("*").eq("id", str(project_id)).eq("user_id", current_user["id"]).single().execute()
        
        if project_response.error or not project_response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Project not found"
            )
        
        project = project_response.data
        tracks = project.get("tracks", [])
        
        # Update specific track
        updated_tracks = []
        track_found = False
        
        for track in tracks:
            if track["id"] == str(track_id):
                updated_tracks.append(track_data.dict())
                track_found = True
            else:
                updated_tracks.append(track)
        
        if not track_found:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Track not found"
            )
        
        # Update project with modified tracks
        update_data = {
            "tracks": updated_tracks,
            "updated_at": datetime.utcnow().isoformat()
        }
        
        response = supabase.table("projects").update(update_data).eq("id", str(project_id)).execute()
        
        if response.error:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=response.error.message
            )
        
        return response.data[0]
    
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )

@router.delete("/{project_id}/tracks/{track_id}", response_model=Project)
async def delete_track(
    project_id: UUID,
    track_id: UUID,
    current_user: dict = Depends(get_current_user)
) -> Any:
    """
    Delete a track from a project
    """
    try:
        # Get project data including tracks
        project_response = supabase.table("projects").select("*").eq("id", str(project_id)).eq("user_id", current_user["id"]).single().execute()
        
        if project_response.error or not project_response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Project not found"
            )
        
        project = project_response.data
        tracks = project.get("tracks", [])
        
        # Filter out the track to delete
        updated_tracks = [track for track in tracks if track["id"] != str(track_id)]
        
        if len(updated_tracks) == len(tracks):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Track not found"
            )
        
        # Update project with modified tracks
        update_data = {
            "tracks": updated_tracks,
            "updated_at": datetime.utcnow().isoformat()
        }
        
        response = supabase.table("projects").update(update_data).eq("id", str(project_id)).execute()
        
        if response.error:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=response.error.message
            )
        
        return response.data[0]
    
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )