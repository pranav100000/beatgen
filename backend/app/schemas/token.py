from pydantic import BaseModel
from typing import Optional


class Token(BaseModel):
    access_token: str
    token_type: str
    message: Optional[str] = None


class TokenPayload(BaseModel):
    sub: Optional[str] = None
    exp: int = None