from pydantic import BaseModel
from typing import Optional

class Token(BaseModel):
    """Schema for authentication token responses"""
    access_token: str
    token_type: str = "bearer"
    message: Optional[str] = None
    user_id: Optional[str] = None

class TokenPayload(BaseModel):
    """Schema for token payload data"""
    sub: Optional[str] = None
    exp: Optional[int] = None