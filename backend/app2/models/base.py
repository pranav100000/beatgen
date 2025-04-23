"""
Base models for SQL database entities
"""
from datetime import datetime
from typing import Optional, Type, List, Any
import pydantic
from sqlmodel import SQLModel, Field
from sqlalchemy import TIMESTAMP, Column
from sqlalchemy.dialects.postgresql import JSONB
from pydantic import BaseModel, create_model
import uuid

from app2.types.track_types import TrackType
from app2.types.file_types import FileType
from app2.types.drum_sample_types import DrumSampleType
from app2.types.genre_types import GenreType

def all_optional(base_model: Type[BaseModel], name: str) -> Type[BaseModel]:
    """
    Creates a new model with the same fields, but all optional.

    Usage: SomeOptionalModel = SomeModel.all_optional('SomeOptionalModel')
    """
    return create_model(
        name,
        __base__=base_model,
        **{name: (info.annotation, None) for name, info in base_model.model_fields.items() if name not in ['type', 'id']}
    )

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

class DefaultUUIDMixin(SQLModel):
    """Mixin that adds UUID primary key"""
    id: uuid.UUID = Field(
        default_factory=uuid.uuid4,
        primary_key=True,
        index=True
    )

class UUIDMixin(SQLModel):
    """Mixin that adds UUID primary key"""
    id: uuid.UUID = Field(
        primary_key=True,
        index=True
    )

class DefaultUUIDStandardBase(DefaultUUIDMixin, TimestampMixin):
    """Base model with default UUID primary key and default timestamp fields"""
    pass
    
class StandardBase(UUIDMixin, TimestampMixin):
    """Base model with UUID primary key with mandatory provided UUID and default timestamp fields"""
    pass

class FileBase(StandardBase):
    """Base model for files"""
    file_name: str
    display_name: str
    storage_key: str
    file_format: str
    file_size: int
    
class UserBase(DefaultUUIDStandardBase):
    """Base model for users"""
    email: str = Field(unique=True, index=True)
    username: Optional[str] = Field(default=None, unique=True, index=True)
    display_name: Optional[str] = Field(default=None)
    avatar_url: Optional[str] = Field(default=None)
    
class ProjectBase(DefaultUUIDStandardBase):
    """Base model for projects"""
    name: str
    bpm: float
    time_signature_numerator: int
    time_signature_denominator: int
    key_signature: str
    
class TrackBase(StandardBase):
    """Base model for tracks"""
    name: str
    
class ProjectTrackBase(TimestampMixin):
    """Base model for project tracks"""
    name: str
    volume: float
    pan: float
    mute: bool
    x_position: float
    y_position: float
    trim_start_ticks: int
    trim_end_ticks: int
    duration_ticks: int
    track_number: int
    

class InstrumentFileBase(FileBase):
    """Base model for instruments"""
    category: str
    is_public: bool
    description: Optional[str] = None

class DrumSamplePublicBase(FileBase):
    """Base model for drum samples"""
    genre: GenreType
    category: DrumSampleType
    kit_name: str
    description: Optional[str] = None
    waveform_data: Optional[List[float]] = Field(default=None, sa_column=Column(JSONB))