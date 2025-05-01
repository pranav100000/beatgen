from fastapi import APIRouter, Depends, status, HTTPException, Query, Request, Response
from fastapi.security import OAuth2PasswordRequestForm
from fastapi.responses import RedirectResponse
from typing import Any, Dict, Optional
from pydantic import BaseModel, EmailStr

from app2.api.dependencies import get_auth_service
from app2.services.auth_service import AuthService
from app2.core.logging import get_api_logger
from app2.core.exceptions import UnauthorizedException, ServiceException
from app2.core.config import settings

# Import the schemas for compatibility with the old API
from app2.models.token import Token
from app2.models.user import UserCreate

router = APIRouter()
logger = get_api_logger("auth")

class ForgotPasswordRequest(BaseModel):
    """Request model for password reset"""
    email: EmailStr

class MessageResponse(BaseModel):
    """Generic success message response"""
    message: str
    
class OAuthURLResponse(BaseModel):
    """Response with OAuth URL for redirect"""
    url: str

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
        logger.info(f"User registered successfully: {result.get('user_id', '') if result else 'N/A'}")

        # Check if user creation failed or returned None
        if result is None:
            logger.error("User creation returned None from auth_service")
            raise ServiceException("User registration failed unexpectedly.")

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

@router.post("/login", response_model=Token)
async def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    auth_service: AuthService = Depends(get_auth_service)
) -> Any:
    """
    Authenticate user and return access token
    
    Uses OAuth2PasswordRequestForm for compatibility with standard OAuth2 clients.
    The username field is used for email.
    """
    logger.info(f"Processing login request for email: {form_data.username}")
    try:
        # Call Supabase auth service to sign in user
        result = await auth_service.login_user(
            email=form_data.username,  # OAuth2 form uses 'username' field for email
            password=form_data.password
        )
        logger.info(f"User logged in successfully: {result['user_id']}")
        return {
            "access_token": result["access_token"],
            "token_type": "bearer",
            "user_id": result.get("user_id")
        }
    except UnauthorizedException as e:
        logger.error(f"Login failed - invalid credentials: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except Exception as e:
        logger.error(f"Login failed - unexpected error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication failed",
            headers={"WWW-Authenticate": "Bearer"},
        )

@router.post("/forgot-password", response_model=MessageResponse)
async def forgot_password(
    email: str,  # Changed to simple string parameter to match old API
    auth_service: AuthService = Depends(get_auth_service)
) -> Any:
    """
    Send password reset email
    
    For security reasons, always returns success whether the email exists or not.
    """
    logger.info(f"Processing password reset request for email: {email}")
    try:
        # Call Supabase auth service to send reset password email
        await auth_service.send_password_reset(email)
        logger.info(f"Password reset email sent to: {email}")
    except Exception as e:
        # Log the error but don't expose it to the client
        logger.error(f"Password reset failed: {str(e)}")
        
    # Always return the same message whether successful or not for security
    return {"message": "If the email exists, a password reset link will be sent"}
    
@router.get("/login/google", response_model=OAuthURLResponse)
async def login_google(
    response: Response,
    auth_service: AuthService = Depends(get_auth_service)
) -> Any:
    """
    Get Google OAuth URL for the frontend to redirect to
    """
    logger.info("Starting Google OAuth flow")
    try:
        redirect_url = await auth_service.get_google_auth_url(response)
        logger.info(f"Google auth URL generated: {redirect_url[:30]}...")
        return {"url": redirect_url}
    except Exception as e:
        logger.error(f"Failed to generate Google auth URL: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"OAuth error: {str(e)}"
        )

@router.get("/callback/google")
async def callback_google(
    request: Request,
    response: Response,
    code: str = Query(...),
    redirect_to: Optional[str] = Query(None),
    auth_service: AuthService = Depends(get_auth_service)
) -> Any:
    """
    Handle Google OAuth callback
    """
    logger.info("Processing Google OAuth callback")
    
    # Get all the query parameters
    params = dict(request.query_params)
    logger.info(f"Received callback with params: {params}")
    
    # Check for the code parameter
    code = params.get('code')
    if not code:
        logger.error("No code parameter found in callback request")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Missing required 'code' parameter"
        )
    
    try:
        result = await auth_service.handle_google_callback(code, request, response)
        logger.info(f"Google auth successful for user: {result.get('user_id', 'unknown')}")
        
        access_token = result.get("access_token")
        if not access_token:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to retrieve access token after Google login"
            )
            
        # Determine the final redirect URL for the frontend
        # Default to frontend base URL if no specific redirect_to was provided
        final_redirect_url = redirect_to or settings.app.FRONTEND_BASE_URL or "/"
        
        # Add the access token to the redirect URL fragment for the frontend to handle
        # Note: Storing tokens in URL fragments is common but consider security implications.
        # An alternative is to set another secure cookie readable by the frontend.
        redirect_url_with_token = f"{final_redirect_url}#access_token={access_token}"
        
        # Use RedirectResponse for the final redirect
        # Response object passed to handle_google_callback already handled clearing the PKCE cookie
        logger.info(f"Redirecting user to frontend: {final_redirect_url}")
        return RedirectResponse(redirect_url_with_token)

    except UnauthorizedException as e:
        logger.error(f"Google OAuth callback failed: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Google authentication failed: {str(e)}",
            headers={"WWW-Authenticate": "Bearer"},
        )