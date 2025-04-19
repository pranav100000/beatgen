"""
Base models for SQL database entities
"""
from datetime import datetime
from enum import Enum
from typing import Optional, List, TypeVar
from sqlmodel import SQLModel, Field, Relationship
from sqlalchemy import TIMESTAMP
from pydantic import validator
import uuid

from app2.types.track_types import TrackType
from app2.types.file_types import FileType

class TimestampMixin(SQLModel):
    """Mixin that adds created_at and updated_at fields to models"""
    created_at: datetime = Field(
        default_factory=datetime.utcnow,
        sa_column=TIMESTAMP(timezone=True)
    )
    updated_at: datetime = Field(
        default_factory=datetime.utcnow,
        sa_column=TIMESTAMP(timezone=True)
    )

class UUIDMixin(SQLModel):
    """Mixin that adds UUID primary key"""
    id: uuid.UUID = Field(
        default_factory=lambda: uuid.uuid4(),
        primary_key=True,
        index=True
    )

class StandardBase(UUIDMixin, TimestampMixin):
    """Base model with UUID primary key and timestamp fields"""
    pass
    
class FileBase(StandardBase):
    """Base model for files"""
    name: str
    storage_key: str
    file_format: str
    file_size: int
    
class UserBase(StandardBase):
    """Base model for users"""
    email: str = Field(unique=True, index=True)
    username: Optional[str] = Field(default=None, unique=True, index=True)
    display_name: Optional[str] = Field(default=None)
    avatar_url: Optional[str] = Field(default=None)
    
class ProjectBase(StandardBase):
    """Base model for projects"""
    name: str
    bpm: float
    time_signature_numerator: int
    time_signature_denominator: int
    key_signature: str
    
class TrackBase(StandardBase):
    """Base model for tracks"""
    name: str
    type: TrackType
    
class ProjectTrackBase(StandardBase):
    """Base model for project tracks"""
    name: str
    volume: Optional[float] = 0.0
    pan: Optional[float] = 0.0
    mute: Optional[bool] = False
    x_position: Optional[float] = 0.0
    y_position: Optional[float] = 0.0
    trim_start_ticks: Optional[int] = 0
    trim_end_ticks: Optional[int] = 0
    duration_ticks: Optional[int] = 0
    track_number: Optional[int] = 0
    
class AudioFileBase(FileBase):
    """Base model for audio files"""
    duration: float
    sample_rate: int
    
class MidiFileBase(FileBase):
    """Base model for MIDI files"""
    pass

class InstrumentFileBase(FileBase):
    """Base model for instruments"""
    instrument_name: str
    category: str
    is_public: bool
    description: Optional[str] = None
    pass