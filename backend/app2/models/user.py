"""
User models for SQL database
"""
from typing import Optional, List, TYPE_CHECKING
from sqlmodel import SQLModel, Field, Relationship
from datetime import datetime
import uuid

from app2.models.base import UserBase

# Handle circular imports
if TYPE_CHECKING:
    from app2.models.project import Project
    from app2.models.track_models.audio_track import AudioTrack
    from app2.models.track_models.midi_track import MidiTrack
    from app2.models.track_models.sampler_track import SamplerTrack
    from app2.models.track_models.drum_track import DrumTrack

# Database model
class User(UserBase, table=True):
    """User model for the database"""
    __tablename__ = "users"
    
    # id, created_at, updated_at are inherited from UUIDModel and TimestampMixin
    
    # Relationships (will be populated when those models are created)
    projects: List["Project"] = Relationship(back_populates="user")
    
    # Track relationships (by type)
    audio_tracks: List["AudioTrack"] = Relationship(back_populates="user")
    midi_tracks: List["MidiTrack"] = Relationship(back_populates="user")
    sampler_tracks: List["SamplerTrack"] = Relationship(back_populates="user")
    drum_tracks: List["DrumTrack"] = Relationship(back_populates="user")

# API Models
class UserRead(SQLModel):
    """API response model for user data"""
    id: uuid.UUID
    email: str
    username: Optional[str] = None
    display_name: Optional[str] = None
    avatar_url: Optional[str] = None
    created_at: datetime
    updated_at: datetime

class UserCreate(SQLModel):
    """API request model for creating a user"""
    email: str
    password: str
    username: Optional[str] = None
    display_name: Optional[str] = None

class UserUpdate(SQLModel):
    """API request model for updating a user"""
    email: Optional[str] = None
    username: Optional[str] = None
    display_name: Optional[str] = None
    avatar_url: Optional[str] = None

class UserLogin(SQLModel):
    """API request model for user login"""
    email: str
    password: str

class UserPasswordChange(SQLModel):
    """API request model for changing user password"""
    current_password: str
    new_password: str