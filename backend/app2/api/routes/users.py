from datetime import datetime
import uuid
from fastapi import APIRouter, Depends, status, HTTPException
from typing import Any, Dict, Optional
from pydantic import BaseModel, EmailStr

from app2.api.dependencies import get_current_user, get_user_service
from app2.services.user_service import UserService
from app2.core.logging import get_api_logger
from app2.core.exceptions import NotFoundException, ServiceException

router = APIRouter()
logger = get_api_logger("users")

class UserProfile(BaseModel):
    """User profile data"""
    id: uuid.UUID
    email: EmailStr
    username: Optional[str] = None
    display_name: Optional[str] = None
    avatar_url: Optional[str] = None
    created_at: datetime
    updated_at: datetime

class UpdateProfileRequest(BaseModel):
    """Request model for updating user profile"""
    username: Optional[str] = None
    display_name: Optional[str] = None

class ChangePasswordRequest(BaseModel):
    """Request model for changing password"""
    current_password: str
    new_password: str

class MessageResponse(BaseModel):
    """Generic success message response"""
    message: str

@router.get("/me", response_model=UserProfile)
async def get_current_user_profile(
    current_user: Dict[str, Any] = Depends(get_current_user),
    user_service: UserService = Depends(get_user_service)
) -> Any:
    """
    Get current user's profile
    """
    logger.info(f"Getting profile for user ID: {current_user['id']}")
    try:
        profile = await user_service.get_profile(current_user["id"])
        logger.info(f"Retrieved profile for user ID: {current_user['id']}")
        logger.info(f"PPPPPPProfile: {profile}")
        return profile
    except NotFoundException:
        logger.error(f"Profile not found for user ID: {current_user['id']}")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User profile not found"
        )
    except Exception as e:
        logger.error(f"Error getting user profile: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get user profile: {str(e)}"
        )

@router.patch("/me", response_model=UserProfile)
async def update_current_user_profile(
    update_data: UpdateProfileRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
    user_service: UserService = Depends(get_user_service)
) -> Any:
    """
    Update current user's profile
    """
    logger.info(f"Updating profile for user ID: {current_user['id']}")
    try:
        profile = await user_service.update_profile(
            current_user["id"], 
            update_data.dict(exclude_unset=True)
        )
        logger.info(f"Updated profile for user ID: {current_user['id']}")
        return profile
    except NotFoundException:
        logger.error(f"Profile not found for user ID: {current_user['id']}")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User profile not found"
        )
    except Exception as e:
        logger.error(f"Error updating user profile: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update user profile: {str(e)}"
        )

@router.post("/me/password", response_model=MessageResponse)
async def change_password(
    password_data: ChangePasswordRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
    user_service: UserService = Depends(get_user_service)
) -> Any:
    """
    Change user's password
    """
    logger.info(f"Changing password for user ID: {current_user['id']}")
    try:
        success = await user_service.change_password(
            user_id=current_user["id"],
            current_password=password_data.current_password,
            new_password=password_data.new_password
        )
        logger.info(f"Password changed for user ID: {current_user['id']}")
        return {"message": "Password changed successfully"}
    except UnauthorizedException:
        logger.error(f"Invalid current password for user ID: {current_user['id']}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Current password is incorrect"
        )
    except Exception as e:
        logger.error(f"Error changing password: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to change password: {str(e)}"
        )