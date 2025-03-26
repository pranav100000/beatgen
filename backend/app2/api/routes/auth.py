from fastapi import APIRouter, Depends, status, HTTPException
from fastapi.security import OAuth2PasswordRequestForm
from typing import Any, Dict, Optional
from pydantic import BaseModel, EmailStr

from app2.api.dependencies import get_auth_service
from app2.services.auth_service import AuthService
from app2.core.logging import get_api_logger
from app2.core.exceptions import UnauthorizedException, ServiceException

# Import the schemas for compatibility with the old API
from app2.schemas.token import Token
from app2.schemas.user import UserCreate

router = APIRouter()
logger = get_api_logger("auth")

class ForgotPasswordRequest(BaseModel):
    """Request model for password reset"""
    email: EmailStr

class MessageResponse(BaseModel):
    """Generic success message response"""
    message: str

@router.post("/signup", response_model=Token, status_code=status.HTTP_201_CREATED)
async def signup(
    user_data: UserCreate,
    auth_service: AuthService = Depends(get_auth_service)
) -> Any:
    """
    Register a new user account
    """
    logger.info(f"Processing signup request for email: {user_data.email}")
    try:
        # Call Supabase auth service to create user
        result = await auth_service.create_user(
            email=user_data.email,
            password=user_data.password,
            username=user_data.username,
            display_name=user_data.display_name
        )
        logger.info(f"User registered successfully: {result.get('user_id', '')}")
        
        # Handle case where email confirmation is required
        if not result.get('access_token'):
            return {
                "access_token": "",  # No token yet, needs email verification
                "token_type": "bearer",
                # Include a message about email confirmation
                "message": "Signup successful. Please check your email to confirm your account."
            }
            
        return {
            "access_token": result["access_token"],
            "token_type": "bearer",
            "user_id": result.get("user_id")
        }
    except Exception as e:
        logger.error(f"Signup failed: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Registration failed: {str(e)}"
        )

@router.post("/login", response_model=TokenResponse)
async def login(
    request: LoginRequest,
    auth_service: AuthService = Depends(get_auth_service)
) -> Any:
    """
    Authenticate user and return access token
    """
    logger.info(f"Processing login request for email: {request.email}")
    try:
        # Call Supabase auth service to sign in user
        result = await auth_service.login_user(
            email=request.email,
            password=request.password
        )
        logger.info(f"User logged in successfully: {result['user_id']}")
        return result
    except UnauthorizedException as e:
        logger.error(f"Login failed - invalid credentials: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password"
        )
    except Exception as e:
        logger.error(f"Login failed - unexpected error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Login failed: {str(e)}"
        )

@router.post("/forgot-password", response_model=MessageResponse)
async def forgot_password(
    request: ForgotPasswordRequest,
    auth_service: AuthService = Depends(get_auth_service)
) -> Any:
    """
    Send password reset email
    """
    logger.info(f"Processing password reset request for email: {request.email}")
    try:
        # Call Supabase auth service to send reset password email
        await auth_service.send_password_reset(request.email)
        logger.info(f"Password reset email sent to: {request.email}")
        return {"message": "Password reset instructions sent to your email"}
    except Exception as e:
        logger.error(f"Password reset failed: {str(e)}")
        # Don't expose whether email exists or not for security
        return {"message": "If your email is registered, you will receive reset instructions"}