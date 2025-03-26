from fastapi import APIRouter, Depends, HTTPException, status
from typing import Any, List
from datetime import datetime
from uuid import UUID

from app.core.security import get_current_user
from app.core.supabase import supabase
from app.schemas.project import Project, ProjectCreate, ProjectUpdate, Track

router = APIRouter()

@router.get("", response_model=List[Project])
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
        logger.info(f"Found {len(response.data)} projects for user ID: {current_user['id']}")
        
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

@router.post("", response_model=Project)
@router.post("/", response_model=Project)
async def create_project(
    project_data: ProjectCreate,
    current_user: dict = Depends(get_current_user)
) -> Any:
    """
    Create a new project
    """
    import logging
    import traceback
    logger = logging.getLogger("beatgen.projects")
    
    logger.info(f"Creating project for user ID: {current_user['id']}")
    logger.info(f"Project data: {project_data}")
    
    try:
        now = datetime.utcnow().isoformat()
        
        # Prepare project data using the exact schema
        project = {
            "name": project_data.name,
            "user_id": current_user["id"],
            "bpm": project_data.bpm,
            "time_signature_numerator": project_data.time_signature_numerator,
            "time_signature_denominator": project_data.time_signature_denominator,
            "key_signature": project_data.key_signature,
            "tracks": []
            # Omitting created_at and updated_at as they have database defaults
        }
        
        logger.info(f"Prepared project data: {project}")
        
        # First, check if the table exists
        try:
            # Using consistent table name "project" throughout
            check_table = supabase.table("project").select("count").limit(1).execute()
            logger.info(f"Table check response: {check_table}")
        except Exception as table_err:
            logger.error(f"Error checking table existence: {str(table_err)}")
            logger.error(traceback.format_exc())
            # If the table doesn't exist, this could be our issue
            if "relation \"project\" does not exist" in str(table_err).lower():
                logger.critical("The 'project' table does not exist in the database")
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Database setup error: The project table does not exist. Please set up the database tables first."
                )
            
        # Insert project into Supabase
        logger.info("Attempting to insert project into Supabase...")
        response = supabase.table("project").insert(project).execute()
        
        logger.info(f"Supabase insert response: {response}")
        
        if hasattr(response, 'error') and response.error:
            logger.error(f"Error creating project: {response.error}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Error creating project: {response.error.message if hasattr(response.error, 'message') else str(response.error)}"
            )
        
        if not response.data or len(response.data) == 0:
            logger.error("No data returned from project creation")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Project created but no data was returned"
            )
            
        logger.info(f"Successfully created project with ID: {response.data[0].get('id', 'unknown')}")
        return response.data[0]
    
    except HTTPException as he:
        # Re-raise HTTP exceptions as they already have the right status code
        logger.error(f"HTTP exception in create_project: {str(he)}")
        raise
    except Exception as e:
        logger.error(f"Unexpected exception in create_project: {str(e)}")
        logger.error(traceback.format_exc())
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error creating project: {str(e)}"
        )

@router.get("/{project_id}", response_model=Project)
async def get_project(
    project_id: UUID,
    current_user: dict = Depends(get_current_user)
) -> Any:
    """
    Get a specific project by ID
    """
    import logging
    import traceback
    logger = logging.getLogger("beatgen.projects")
    
    logger.info(f"Getting project with ID: {project_id} for user: {current_user['id']}")
    
    try:
        # Query the specific project
        logger.info(f"Executing query: SELECT * FROM project WHERE id = {str(project_id)} AND user_id = {current_user['id']}")
        response = supabase.table("project").select("*").eq("id", str(project_id)).eq("user_id", current_user["id"]).single().execute()
        
        # Log the response
        logger.info(f"Supabase response: {response}")
        
        if hasattr(response, 'error') and response.error:
            logger.error(f"Error fetching project: {response.error}")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Project not found: {response.error.message if hasattr(response.error, 'message') else str(response.error)}"
            )
        
        if not response.data:
            logger.error(f"No project found with ID: {project_id} for user: {current_user['id']}")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Project not found"
            )
        
        logger.info(f"Successfully retrieved project: {response.data}")
        return response.data
    
    except HTTPException as he:
        # Re-raise HTTP exceptions as they already have the right status code
        logger.error(f"HTTP exception in get_project: {str(he)}")
        raise
    except Exception as e:
        logger.error(f"Unexpected exception in get_project: {str(e)}")
        logger.error(traceback.format_exc())
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error retrieving project: {str(e)}"
        )

@router.patch("/{project_id}", response_model=Project)
async def update_project(
    project_id: UUID,
    project_update: ProjectUpdate,
    current_user: dict = Depends(get_current_user)
) -> Any:
    """
    Update a project
    
    This endpoint handles updating a project with all its tracks. If tracks are provided, 
    they will replace all existing tracks in the project. The front-end handles:
    1. Uploading sound files to Supabase storage
    2. Creating audio track records in the database
    3. Saving the project with the track data that includes storage keys
    """
    import logging
    import traceback
    logger = logging.getLogger("beatgen.projects")
    
    logger.info(f"Updating project with ID: {project_id} for user: {current_user['id']}")
    
    # Track info for logging
    if project_update.tracks:
        logger.info(f"Update includes {len(project_update.tracks)} tracks")
        # Log some info about the first few tracks
        for i, track in enumerate(project_update.tracks[:3]):
            track_info = {
                'name': track.name,
                'type': track.type,
                'id': track.id
            }
            if track.type == 'audio':
                track_info['storage_key'] = track.storage_key if hasattr(track, 'storage_key') else 'not set'
                track_info['duration'] = track.duration if hasattr(track, 'duration') else 'not set'
            logger.info(f"Track {i}: {track_info}")
    else:
        logger.info("Update does not include tracks")
    
    try:
        # Verify project exists and belongs to user
        logger.info(f"Checking if project exists: ID={project_id}, user_id={current_user['id']}")
        check_response = supabase.table("project").select("id").eq("id", str(project_id)).eq("user_id", current_user["id"]).single().execute()
        
        logger.info(f"Check response: {check_response}")
        
        if hasattr(check_response, 'error') and check_response.error:
            logger.error(f"Error checking project existence: {check_response.error}")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Project not found: {check_response.error.message if hasattr(check_response.error, 'message') else str(check_response.error)}"
            )
            
        if not check_response.data:
            logger.error(f"No project found with ID: {project_id} for user: {current_user['id']}")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Project not found"
            )
        
        # Process the update data
        update_data = project_update.dict(exclude_unset=True)
        
        # Ensure key_signature is included
        if "key_signature" not in update_data:
            logger.error("key_signature not provided in update data")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="key_signature is required"
            )
        
        # If tracks are present, process them
        if 'tracks' in update_data and update_data['tracks'] is not None:
            # Convert Track objects to dictionaries with proper serialization
            tracks_data = []
            for track in update_data['tracks']:
                # If it's a Pydantic model, convert to dict
                if hasattr(track, 'dict'):
                    track_dict = track.dict()
                else:
                    track_dict = track
                
                # Convert any UUID values to strings
                for key, value in track_dict.items():
                    if isinstance(value, UUID):
                        track_dict[key] = str(value)
                
                tracks_data.append(track_dict)
            
            update_data['tracks'] = tracks_data
            logger.info(f"Processed {len(tracks_data)} tracks for update")
        
        # Add updated timestamp
        update_data["updated_at"] = datetime.utcnow().isoformat()
        
        logger.info(f"Executing update with data keys: {update_data.keys()}")
        response = supabase.table("project").update(update_data).eq("id", str(project_id)).execute()
        
        if hasattr(response, 'error') and response.error:
            logger.error(f"Error updating project: {response.error}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Project update failed: {response.error.message if hasattr(response.error, 'message') else str(response.error)}"
            )
        
        if not response.data or len(response.data) == 0:
            logger.error("No data returned from project update")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Project updated but no data was returned"
            )
            
        logger.info(f"Successfully updated project with ID: {response.data[0].get('id', 'unknown')}")
        return response.data[0]
    
    except HTTPException as he:
        # Re-raise HTTP exceptions as they already have the right status code
        logger.error(f"HTTP exception in update_project: {str(he)}")
        raise
    except Exception as e:
        logger.error(f"Unexpected exception in update_project: {str(e)}")
        logger.error(traceback.format_exc())
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error updating project: {str(e)}"
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
        check_response = supabase.table("project").select("id").eq("id", str(project_id)).eq("user_id", current_user["id"]).single().execute()
        
        if check_response.error or not check_response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Project not found"
            )
        
        # Delete project
        response = supabase.table("project").delete().eq("id", str(project_id)).execute()
        
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
        project_response = supabase.table("project").select("*").eq("id", str(project_id)).eq("user_id", current_user["id"]).single().execute()
        
        if project_response.error or not project_response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Project not found"
            )
        
        project = project_response.data
        tracks = project.get("tracks", [])
        
        # Convert track data to dict, ensuring UUID is converted to string
        track_dict = track_data.dict()
        if isinstance(track_dict['id'], UUID):
            track_dict['id'] = str(track_dict['id'])
        
        # Add new track
        tracks.append(track_dict)
        
        # Update project with new tracks
        update_data = {
            "tracks": tracks,
            "updated_at": datetime.utcnow().isoformat()
        }
        
        response = supabase.table("project").update(update_data).eq("id", str(project_id)).execute()
        
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
        project_response = supabase.table("project").select("*").eq("id", str(project_id)).eq("user_id", current_user["id"]).single().execute()
        
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
        
        response = supabase.table("project").update(update_data).eq("id", str(project_id)).execute()
        
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
        project_response = supabase.table("project").select("*").eq("id", str(project_id)).eq("user_id", current_user["id"]).single().execute()
        
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
        
        response = supabase.table("project").update(update_data).eq("id", str(project_id)).execute()
        
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

