from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm

from app.core.supabase import supabase, create_user_profile
from app.schemas.token import Token
from app.schemas.user import UserCreate, UserLogin

router = APIRouter()

@router.post("/signup", response_model=Token)
async def signup(user_data: UserCreate):
    """
    Create a new user in Supabase Auth
    """
    try:
        # Register user with Supabase Auth
        auth_response = supabase.auth.sign_up({
            "email": user_data.email,
            "password": user_data.password
        })
        
        print(f"Signup response: {auth_response}")
        
        if auth_response.user is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Registration failed"
            )
        
        # Check if we have a session (might not if email confirmation is required)
        user_id = auth_response.user.id
        
        try:
            # Try to create user profile - might fail if DB constraints
            create_user_profile(user_id, user_data.email)
        except Exception as profile_error:
            print(f"Profile creation error: {profile_error}")
            # Continue anyway - the important part is the user was created
        
        # Handle case where email confirmation is required
        if auth_response.session is None:
            return {
                "access_token": "",  # No token yet, needs email verification
                "token_type": "bearer",
                # Include a message about email confirmation
                "message": "Signup successful. Please check your email to confirm your account."
            }
        
        # Return the Supabase token if we have a session
        return {
            "access_token": auth_response.session.access_token,
            "token_type": "bearer"
        }
    
    except Exception as e:
        print(f"Signup error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )

@router.post("/login", response_model=Token)
async def login(form_data: OAuth2PasswordRequestForm = Depends()):
    """
    Login with email and password
    """
    try:
        # Authenticate with Supabase
        auth_response = supabase.auth.sign_in_with_password({
            "email": form_data.username,  # OAuth2 form uses 'username' field for email
            "password": form_data.password
        })
        
        if auth_response.user is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect email or password",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        # Return the Supabase token directly
        return {
            "access_token": auth_response.session.access_token,
            "token_type": "bearer"
        }
    
    except Exception as e:
        print(f"Login error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication failed",
            headers={"WWW-Authenticate": "Bearer"},
        )

@router.post("/forgot-password")
async def forgot_password(email: str):
    """
    Send a password reset email
    """
    try:
        # Updated method according to new Supabase Python SDK
        auth_response = supabase.auth.reset_password_for_email(email)
        
        # For security reasons, don't reveal if the email exists
        return {"message": "If the email exists, a password reset link will be sent"}
    
    except Exception as e:
        # Don't reveal if the email exists or not for security
        return {"message": "If the email exists, a password reset link will be sent"}