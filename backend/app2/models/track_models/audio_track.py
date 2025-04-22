"""
Audio Track model for SQL database
"""
from typing import Optional, TYPE_CHECKING, List
from sqlmodel import SQLModel, Field, Relationship
import uuid

from app2.models.base import StandardBase, TimestampMixin, TrackBase, all_optional
from app2.types.track_types import TrackType

# Handle circular imports
if TYPE_CHECKING:
    from app2.models.user import User
    from app2.models.project_track import ProjectTrack

class AudioTrackBase(TrackBase):
    """Base model for audio tracks"""
    audio_file_storage_key: str
    audio_file_format: str
    audio_file_size: int
    audio_file_duration: float
    audio_file_sample_rate: int
    

# Database model
class AudioTrack(AudioTrackBase, table=True):
    """Audio Track model for the database"""
    __tablename__ = "audio_tracks"
    
    # Explicitly define the primary key
    id: uuid.UUID = Field(primary_key=True)
    
    # User relationship
    user_id: uuid.UUID = Field(foreign_key="users.id")
    user: Optional["User"] = Relationship(back_populates="audio_tracks")
    
    # Relationships to project tracks
    project_tracks: List["ProjectTrack"] = Relationship(
        back_populates="audio_track",
        sa_relationship_kwargs={
            "primaryjoin": "and_(ProjectTrack.track_id == AudioTrack.id, ProjectTrack.track_type == 'audio')",
            "foreign_keys": "[ProjectTrack.track_id]",
            "overlaps": "project_tracks"
        }
    )

# API Models
class AudioTrackRead(AudioTrackBase):
    """API response model for audio track data"""

class AudioTrackCreate(AudioTrackBase):
    """API request model for creating an audio track"""
    
class AudioTrackUpdate(all_optional(AudioTrackBase, "AudioTrackUpdate")):
    """API request model for updating an audio track"""
    
class AudioTrackDelete(SQLModel):
    """API request model for deleting an audio track"""
