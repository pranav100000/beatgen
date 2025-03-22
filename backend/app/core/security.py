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
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    try:
        # Use Supabase to verify the token and get user
        user_response = supabase.auth.get_user(token)
        
        if user_response.user is None:
            raise credentials_exception
            
        # Return user ID from Supabase
        return {"id": user_response.user.id}
        
    except Exception as e:
        print(f"Auth error: {str(e)}")
        raise credentials_exception