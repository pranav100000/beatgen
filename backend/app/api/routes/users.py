from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from typing import Any

from app.core.security import get_current_user
from app.core.supabase import supabase
from app.schemas.user import UserProfile, UserProfileUpdate, UserPasswordChange

router = APIRouter()

@router.get("/me", response_model=UserProfile)
async def get_current_user_profile(current_user: dict = Depends(get_current_user)) -> Any:
    """
    Get current user profile
    """
    try:
        # Get profile from Supabase
        response = supabase.table("person").select("*").eq("id", current_user["id"]).single().execute()
        
        if response.error:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Profile not found"
            )
        
        return response.data
    
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )

@router.patch("/me", response_model=UserProfile)
async def update_user_profile(
    profile_update: UserProfileUpdate,
    current_user: dict = Depends(get_current_user)
) -> Any:
    """
    Update current user profile
    """
    try:
        # Update profile in Supabase
        response = supabase.table("person").update(profile_update.dict(exclude_unset=True)).eq("id", current_user["id"]).execute()
        
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

@router.post("/me/avatar")
async def upload_avatar(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user)
) -> Any:
    """
    Upload user avatar
    """
    try:
        # Define file path in Supabase Storage
        file_path = f"avatars/{current_user['id']}/{file.filename}"
        
        # Upload file to Supabase Storage
        response = supabase.storage.from_("avatars").upload(file_path, file.file)
        
        if response.error:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=response.error.message
            )
        
        # Get public URL
        url = supabase.storage.from_("avatars").get_public_url(file_path)
        
        # Update profile with new avatar URL
        profile_response = supabase.table("person").update({"avatar_url": url}).eq("id", current_user["id"]).execute()
        
        if profile_response.error:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=profile_response.error.message
            )
        
        return {"avatar_url": url}
    
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )

@router.post("/me/password")
async def change_password(
    password_data: UserPasswordChange,
    current_user: dict = Depends(get_current_user)
) -> Any:
    """
    Change user password
    """
    try:
        # Update password in Supabase Auth
        response = supabase.auth.update_user({
            "password": password_data.new_password
        })
        
        if response.error:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=response.error.message
            )
        
        return {"message": "Password updated successfully"}
    
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )