"""
Sampler Track model for SQL database
"""
from typing import Optional, TYPE_CHECKING, Dict
from sqlalchemy import Column
from sqlalchemy.dialects.postgresql import JSONB
from sqlmodel import SQLModel, Field, Relationship
import uuid

from app2.models.base import TimestampMixin, TrackBase, all_optional
from app2.types.track_types import TrackType

# Handle circular imports
if TYPE_CHECKING:
    from app2.models.user import User
    from app2.models.project_track import ProjectTrack

class SamplerTrackBase(TrackBase):
    """Base model for sampler tracks"""
    base_midi_note: int
    grain_size: float
    overlap: float
    audio_storage_key: str
    audio_file_format: str
    audio_file_size: int
    audio_file_name: str
    audio_file_duration: float
    audio_file_sample_rate: int
    midi_notes_json: Dict = Field(default_factory=dict, sa_column=Column(JSONB))

# Database model
class SamplerTrack(SamplerTrackBase, table=True):
    """Sampler Track model for the database"""
    __tablename__ = "sampler_tracks"
    
    # Basic track information
    id: uuid.UUID = Field(primary_key=True)
    name: str
    type: TrackType = TrackType.SAMPLER
    
    # User relationship
    user_id: uuid.UUID = Field(foreign_key="users.id")
    user: Optional["User"] = Relationship(back_populates="sampler_tracks")
    
    # Relationships to project tracks
    project_tracks: list["ProjectTrack"] = Relationship(
        back_populates="sampler_track",
        sa_relationship_kwargs={
            "primaryjoin": "and_(ProjectTrack.track_id == SamplerTrack.id, ProjectTrack.track_type == 'sampler')",
            "foreign_keys": "[ProjectTrack.track_id]",
            "overlaps": "project_tracks"
        }
    )

# API Models
class SamplerTrackRead(SamplerTrackBase):
    """API response model for sampler track data"""

class SamplerTrackCreate(SamplerTrackBase):
    """API request model for creating a sampler track"""
    
class SamplerTrackUpdate(all_optional(SamplerTrackBase, "SamplerTrackUpdate")):
    """API request model for updating a sampler track"""
