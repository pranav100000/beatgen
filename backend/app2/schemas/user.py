from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import datetime

class UserBase(BaseModel):
    """Base model for user data"""
    email: EmailStr

class UserCreate(UserBase):
    """Model for user registration"""
    password: str
    username: Optional[str] = None
    display_name: Optional[str] = None

class UserLogin(UserBase):
    """Model for user login"""
    password: str

class UserProfile(UserBase):
    """Model for user profile data"""
    id: str
    username: Optional[str] = None
    display_name: Optional[str] = None
    avatar_url: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True

class UserProfileUpdate(BaseModel):
    """Model for updating user profile"""
    username: Optional[str] = None
    display_name: Optional[str] = None
    
    class Config:
        from_attributes = True

class UserPasswordChange(BaseModel):
    """Model for changing user password"""
    current_password: str
    new_password: str