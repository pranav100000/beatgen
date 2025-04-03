from datetime import datetime, timedelta
from typing import Any, Optional, Union, Dict

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from pydantic import ValidationError

from app.core.config import settings
from app.schemas.token import TokenPayload
from app.core.supabase import supabase

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl=f"{settings.API_PREFIX}/auth/login")

# We're no longer creating our own tokens - we'll pass through Supabase tokens instead
def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Verify a password against a hash
    """
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password: str) -> str:
    """
    Hash a password
    """
    return pwd_context.hash(password)

async def get_current_user(token: str = Depends(oauth2_scheme)) -> Dict[str, Any]:
    """
    Get the current user from the token using Supabase's auth
    """
    import logging
    logger = logging.getLogger("beatgen.auth")
    logger.setLevel(logging.DEBUG)
    
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    # Log headers for debugging
    logger.debug("Authentication requested with token")
    
    if not token:
        logger.error("No token provided in request")
        raise credentials_exception
        
    try:
        # Use Supabase to verify the token and get user
        logger.info(f"Verifying token: {token[:10]}...")
        user_response = supabase.auth.get_user(token)
        
        if user_response.user is None:
            logger.error("No user found for provided token")
            raise credentials_exception
            
        # Log successful authentication
        logger.info(f"Successfully authenticated user: {user_response.user.id}")
            
        # Return user ID from Supabase
        return {"id": user_response.user.id}
        
    except Exception as e:
        logger.error(f"Authentication error: {str(e)}")
        logger.error(f"Token: {token[:10]}...")
        import traceback
        logger.error(traceback.format_exc())
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Authentication error: {str(e)}",
            headers={"WWW-Authenticate": "Bearer"},
        )