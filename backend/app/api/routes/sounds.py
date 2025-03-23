from fastapi import APIRouter, Depends, HTTPException, status, Request
from typing import Any, List, Optional
from datetime import datetime
import uuid
import logging
import traceback
from pydantic import BaseModel

from app.core.security import get_current_user
from app.core.supabase import supabase

# Configure logger
logger = logging.getLogger("beatgen.sounds")

router = APIRouter()

class UploadUrlRequest(BaseModel):
    file_name: str

class UploadUrlResponse(BaseModel):
    id: str
    upload_url: str
    storage_key: str

class SoundCreate(BaseModel):
    id: str
    name: str
    file_format: str
    duration: float
    file_size: int
    sample_rate: int
    waveform_data: List[float]
    storage_key: str

class Sound(SoundCreate):
    user_id: str
    created_at: datetime
    updated_at: datetime

@router.post("/upload-url", response_model=UploadUrlResponse)
async def get_upload_url(
    request: Request,
    request_data: UploadUrlRequest,
    current_user: dict = Depends(get_current_user)
) -> Any:
    """
    Generate a presigned URL for uploading an audio file
    """
    logger.info(f"Upload URL requested for file: {request_data.file_name} by user: {current_user['id']}")
    
    try:
        # Generate UUID for sound
        sound_id = str(uuid.uuid4())
        logger.info(f"Generated sound ID: {sound_id}")
        
        # Define storage path
        file_extension = request_data.file_name.split('.')[-1]
        storage_key = f"audio/{current_user['id']}/{sound_id}.{file_extension}"
        logger.info(f"Storage key: {storage_key}")
        
        # Check if bucket exists - we know from logs it returns a list of SyncBucket objects
        try:
            buckets = supabase.storage.list_buckets()
            logger.info(f"Available buckets (raw response): {buckets}")
            
            # Look for a SyncBucket with name='tracks'
            tracks_exists = False
            
            if isinstance(buckets, list):
                for bucket in buckets:
                    # Check if this bucket object has a name attribute equal to 'tracks'
                    if hasattr(bucket, 'name') and bucket.name == 'tracks':
                        tracks_exists = True
                        logger.info(f"Found 'tracks' bucket: {bucket}")
                        break
            
            if not tracks_exists:
                logger.warning("Tracks bucket not found in Supabase storage. Make sure it exists.")
            else:
                logger.info("'tracks' bucket found in Supabase storage")
                
        except Exception as bucket_err:
            logger.error(f"Error checking buckets: {str(bucket_err)}")
            logger.error("Continuing anyway, will attempt to use the bucket directly")
        
        # Generate presigned upload URL
        # According to docs: https://supabase.com/docs/reference/python/storage-from-createsigneduploadurl
        logger.info("Generating presigned upload URL...")
        try:
            response = supabase.storage.from_("tracks").create_signed_upload_url(storage_key)
            logger.info(f"Presigned URL response type: {type(response)}")
            logger.info(f"Presigned URL response data: {response}")
            
            # Extract the signed URL - from logs we know it's a dict with 'signed_url' key
            if isinstance(response, dict) and 'signed_url' in response:
                signed_url = response['signed_url']
                logger.info(f"Found signed_url in response dict: {signed_url}")
            else:
                logger.error(f"Unexpected response format: {response}")
                logger.error(f"Response type: {type(response)}")
                raise ValueError("Could not extract signed URL from response")
                
            logger.info(f"Successfully extracted signed URL: {signed_url}")
            
            result = {
                "id": sound_id,
                "upload_url": signed_url,
                "storage_key": storage_key
            }
        except Exception as url_err:
            logger.error(f"Error generating signed URL: {str(url_err)}")
            logger.error(traceback.format_exc())
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to generate upload URL: {str(url_err)}"
            )
        logger.info(f"Upload URL generated successfully: {result}")
        return result
    
    except HTTPException as he:
        # Re-raise HTTP exceptions
        logger.error(f"HTTP exception in get_upload_url: {str(he)}")
        raise
    except Exception as e:
        # Log the full exception with traceback
        logger.error(f"Unexpected exception in get_upload_url: {str(e)}")
        logger.error(traceback.format_exc())
        logger.error(f"Request path: {request.url.path}")
        
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate upload URL: {str(e)}"
        )

@router.post("/", response_model=Sound)
async def create_sound(
    request: Request,
    sound_data: SoundCreate,
    current_user: dict = Depends(get_current_user)
) -> Any:
    """
    Create a new sound record after successful upload
    """
    logger.info(f"Creating sound record for ID: {sound_data.id} by user: {current_user['id']}")
    logger.info(f"Sound data: Name={sound_data.name}, Format={sound_data.file_format}, Duration={sound_data.duration}s, Size={sound_data.file_size}B")
    
    try:
        # Verify the file exists in storage
        try:
            logger.info(f"Verifying file exists in storage: {sound_data.storage_key}")
            file_info = supabase.storage.from_("tracks").get_public_url(sound_data.storage_key)
            logger.info(f"File public URL: {file_info}")
        except Exception as file_err:
            logger.warning(f"Could not verify file in storage: {str(file_err)}")
        
        now = datetime.utcnow().isoformat()
        
        # Prepare sound record
        sound_record = {
            "id": sound_data.id,
            "user_id": current_user["id"],
            "name": sound_data.name,
            "file_format": sound_data.file_format,
            "duration": sound_data.duration,
            "file_size": sound_data.file_size,
            "sample_rate": sound_data.sample_rate,
            "waveform_data": sound_data.waveform_data,
            "storage_key": sound_data.storage_key,
            "created_at": now,
            "updated_at": now
        }
        
        logger.info(f"Prepared sound record: {sound_record}")
        
        # Check if table exists
        try:
            logger.info("Checking if audio_track table exists")
            table_check = supabase.table("audio_track").select("count").limit(1).execute()
            logger.info(f"Table check response: {table_check}")
        except Exception as table_err:
            logger.error(f"Error checking table existence: {str(table_err)}")
            if "relation \"audio_track\" does not exist" in str(table_err).lower():
                logger.critical("The 'audio_track' table does not exist in the database")
        
        # Insert record
        logger.info("Inserting sound record into database...")
        response = supabase.table("audio_track").insert(sound_record).execute()
        
        logger.info(f"Insert response: {response}")
        
        if hasattr(response, 'error') and response.error:
            logger.error(f"Database error creating sound record: {response.error}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Failed to create sound record: {response.error.message}"
            )
            
        if not response.data or len(response.data) == 0:
            logger.error("No data returned from sound record creation")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Sound record created but no data was returned"
            )
        
        logger.info(f"Sound record created successfully: {response.data[0]}")
        return response.data[0]
    
    except HTTPException as he:
        # Re-raise HTTP exceptions
        logger.error(f"HTTP exception in create_sound: {str(he)}")
        raise
    except Exception as e:
        # Log the full exception with traceback
        logger.error(f"Unexpected exception in create_sound: {str(e)}")
        logger.error(traceback.format_exc())
        logger.error(f"Request path: {request.url.path}")
        
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create sound record: {str(e)}"
        )

@router.get("/", response_model=List[Sound])
async def get_sounds(
    request: Request,
    current_user: dict = Depends(get_current_user)
) -> Any:
    """
    Get all sounds for the current user
    """
    logger.info(f"Getting sounds for user: {current_user['id']}")
    
    try:
        # Check if table exists
        try:
            logger.info("Checking if audio_track table exists")
            table_check = supabase.table("audio_track").select("count").limit(1).execute()
            logger.info(f"Table check response: {table_check}")
        except Exception as table_err:
            logger.error(f"Error checking table existence: {str(table_err)}")
            if "relation \"audio_track\" does not exist" in str(table_err).lower():
                logger.critical("The 'audio_track' table does not exist in the database")
                return []
        
        # Query the sounds
        logger.info(f"Querying audio_track table for user ID: {current_user['id']}")
        response = supabase.table("audio_track").select("*").eq("user_id", current_user["id"]).execute()
        
        logger.info(f"Query response: {response}")
        
        if hasattr(response, 'error') and response.error:
            logger.error(f"Error retrieving sounds: {response.error}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Failed to get sounds: {response.error.message}"
            )
        
        # If sounds table doesn't exist yet or is empty, return empty list
        if not response.data:
            logger.info(f"No sounds found for user ID: {current_user['id']}")
            return []
            
        logger.info(f"Found {len(response.data)} sounds for user ID: {current_user['id']}")
        return response.data
    
    except HTTPException as he:
        # Re-raise HTTP exceptions
        logger.error(f"HTTP exception in get_sounds: {str(he)}")
        raise
    except Exception as e:
        # Log the full exception with traceback
        logger.error(f"Unexpected exception in get_sounds: {str(e)}")
        logger.error(traceback.format_exc())
        logger.error(f"Request path: {request.url.path}")
        
        # If table doesn't exist, return empty list instead of error
        if "relation \"audio_track\" does not exist" in str(e).lower():
            logger.warning("Audio_track table does not exist yet - returning empty list")
            return []
        
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get sounds: {str(e)}"
        )

@router.get("/{sound_id}", response_model=Sound)
async def get_sound(
    request: Request,
    sound_id: str,
    current_user: dict = Depends(get_current_user)
) -> Any:
    """
    Get a specific sound by ID
    """
    logger.info(f"Getting sound with ID: {sound_id} for user: {current_user['id']}")
    
    try:
        # Query the specific sound
        logger.info(f"Executing query: SELECT * FROM audio_track WHERE id = {sound_id} AND user_id = {current_user['id']}")
        response = supabase.table("audio_track").select("*").eq("id", sound_id).eq("user_id", current_user["id"]).execute()
        
        logger.info(f"Query response: {response}")
        
        if hasattr(response, 'error') and response.error:
            logger.error(f"Error fetching sound: {response.error}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Failed to get sound: {response.error.message}"
            )
        
        if not response.data or len(response.data) == 0:
            logger.error(f"No sound found with ID: {sound_id} for user: {current_user['id']}")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Sound not found"
            )
        
        logger.info(f"Successfully retrieved sound: {response.data[0]['id']}")
        return response.data[0]
    
    except HTTPException as he:
        # Re-raise HTTP exceptions
        logger.error(f"HTTP exception in get_sound: {str(he)}")
        raise
    except Exception as e:
        # Log the full exception with traceback
        logger.error(f"Unexpected exception in get_sound: {str(e)}")
        logger.error(traceback.format_exc())
        logger.error(f"Request path: {request.url.path}")
        
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get sound: {str(e)}"
        )

@router.delete("/{sound_id}")
async def delete_sound(
    request: Request,
    sound_id: str,
    current_user: dict = Depends(get_current_user)
) -> Any:
    """
    Delete a sound and its storage file
    """
    logger.info(f"Deleting sound with ID: {sound_id} for user: {current_user['id']}")
    
    try:
        # First get the sound to check ownership and get storage key
        logger.info(f"Verifying sound exists and belongs to user")
        response = supabase.table("audio_track").select("*").eq("id", sound_id).eq("user_id", current_user["id"]).execute()
        
        logger.info(f"Verification response: {response}")
        
        if hasattr(response, 'error') and response.error:
            logger.error(f"Error verifying sound: {response.error}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Failed to get sound: {response.error.message}"
            )
        
        if not response.data or len(response.data) == 0:
            logger.error(f"No sound found with ID: {sound_id} for user: {current_user['id']}")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Sound not found"
            )
        
        sound = response.data[0]
        storage_key = sound["storage_key"]
        logger.info(f"Found sound with storage key: {storage_key}")
        
        # Delete from database
        logger.info(f"Deleting sound record from database")
        delete_response = supabase.table("audio_track").delete().eq("id", sound_id).execute()
        
        logger.info(f"Database delete response: {delete_response}")
        
        if hasattr(delete_response, 'error') and delete_response.error:
            logger.error(f"Error deleting sound from database: {delete_response.error}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Failed to delete sound record: {delete_response.error.message}"
            )
        
        # Delete from storage following Supabase documentation
        logger.info(f"Deleting sound file from storage: {storage_key}")
        try:
            # According to docs: remove() takes a list of file paths as argument
            # Ensure path doesn't have leading slash as per Supabase convention
            clean_path = storage_key
            if clean_path.startswith('/'):
                clean_path = clean_path[1:]
            
            logger.info(f"Using storage key: {clean_path}")
            
            # Set RLS policy on Supabase dashboard:
            # CREATE POLICY "Anyone can delete objects" ON storage.objects FOR DELETE USING (true);
            
            # The official way to delete per Supabase docs
            bucket = "tracks"
            
            # First check file exists
            try:
                logger.info(f"Checking if file exists before deletion: {clean_path}")
                parent_path = "/".join(clean_path.split('/')[:-1])  # Get parent folder
                files_list = supabase.storage.from_(bucket).list(parent_path)
                logger.info(f"Files in directory before deletion: {files_list}")
            except Exception as list_err:
                logger.warning(f"Could not list files: {str(list_err)}")
            
            # Perform deletion exactly as in docs
            logger.info(f"Removing file from bucket '{bucket}': {clean_path}")
            storage_response = supabase.storage.from_(bucket).remove([clean_path])
            logger.info(f"Storage delete response: {storage_response}")
            
            # Check after deletion
            try:
                logger.info(f"Verifying deletion of: {clean_path}")
                parent_path = "/".join(clean_path.split('/')[:-1])  # Get parent folder
                remaining_files = supabase.storage.from_(bucket).list(parent_path)
                logger.info(f"Files remaining after deletion: {remaining_files}")
                
                file_name = clean_path.split('/')[-1]
                still_exists = any(getattr(f, 'name', '') == file_name for f in remaining_files)
                
                if still_exists:
                    logger.warning(f"File still appears to exist after deletion: {file_name}")
                else:
                    logger.info(f"File no longer appears in directory listing: {file_name}")
            except Exception as verify_err:
                logger.warning(f"Could not verify deletion: {str(verify_err)}")
                
        except Exception as storage_err:
            logger.error(f"Exception during storage deletion: {str(storage_err)}")
            logger.error(traceback.format_exc())
        
        logger.info(f"Sound deleted successfully: {sound_id}")
        return {"message": "Sound deleted successfully"}
    
    except HTTPException as he:
        # Re-raise HTTP exceptions
        logger.error(f"HTTP exception in delete_sound: {str(he)}")
        raise
    except Exception as e:
        # Log the full exception with traceback
        logger.error(f"Unexpected exception in delete_sound: {str(e)}")
        logger.error(traceback.format_exc())
        logger.error(f"Request path: {request.url.path}")
        
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete sound: {str(e)}"
        )