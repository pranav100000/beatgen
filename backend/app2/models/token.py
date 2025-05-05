"""
Token models for authentication
"""

from typing import Optional
from sqlmodel import SQLModel


class Token(SQLModel):
    """Model for authentication token responses"""

    access_token: str
    token_type: str = "bearer"
    message: Optional[str] = None
    user_id: Optional[str] = None


class TokenPayload(SQLModel):
    """Model for token payload data"""

    sub: Optional[str] = None
    exp: Optional[int] = None
