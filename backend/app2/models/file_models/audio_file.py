"""
Sound models for SQL database
"""
from typing import Optional, List, TYPE_CHECKING
from sqlmodel import SQLModel, Field, Relationship
from sqlalchemy import Column
from sqlalchemy.types import JSON # Import JSON type
from datetime import datetime
import uuid
from app2.models.user import User
from app2.models.base import AudioFileBase
from app2.models.track import Track
from app2.types.file_types import FileType
# Database model
class AudioFile(AudioFileBase, table=True):
    """Sound model for the database"""
    __tablename__ = "audio_files"
    # Relationships
    track: Optional["Track"] = Relationship(back_populates="audio_file")
    
class AudioFileCreate(AudioFileBase):
    """Model for creating a new audio file"""
    type: str = FileType.AUDIO
    audio_file_id: uuid.UUID
    pass

class AudioFileRead(AudioFileBase):
    """Model for reading an audio file"""
    pass

# # API Models
# class AudioFileRead(SQLModel):
#     """API response model for sound data"""
#     id: uuid.UUID
#     name: str
#     file_format: str
#     duration: float
#     file_size: int
#     sample_rate: int
#     waveform_data: List[float]
#     storage_key: str
#     user_id: uuid.UUID
#     created_at: datetime
#     updated_at: datetime

# class AudioFileCreate(SQLModel):
#     """API request model for creating a sound"""
#     id: uuid.UUID  # Used for Supabase Storage path
#     name: str
#     file_format: str
#     duration: float
#     file_size: int
#     sample_rate: int
#     waveform_data: List[float]
#     storage_key: str