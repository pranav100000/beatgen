"""
Drum Track model for SQL database
"""
from typing import Optional, TYPE_CHECKING
from sqlmodel import SQLModel, Field, Relationship
import uuid

from app2.models.base import DefaultUUIDStandardBase, TimestampMixin, TrackBase, all_optional
from app2.types.track_types import TrackType
from app2.models.track_models.sampler_track import SamplerTrackRead

# Handle circular imports
if TYPE_CHECKING:
    from app2.models.user import User
    from app2.models.project_track import ProjectTrack
    from app2.models.track_models.sampler_track import SamplerTrack

class DrumTrackBase(TrackBase):
    """Base model for drum tracks"""
    pass

# Database model
class DrumTrack(DrumTrackBase, table=True):
    """Drum Track model for the database"""
    __tablename__ = "drum_tracks"
    
    # Explicitly define the primary key
    id: uuid.UUID = Field(primary_key=True)
    
    # User relationship
    user_id: uuid.UUID = Field(foreign_key="users.id")
    user: Optional["User"] = Relationship(back_populates="drum_tracks")
    
    # Drum grid data can be added here if needed
    
    # Relationships to project tracks
    sampler_tracks: list["SamplerTrack"] = Relationship(
        back_populates="drum_track",
    )
    project_tracks: list["ProjectTrack"] = Relationship(
        back_populates="drum_track",
        sa_relationship_kwargs={
            "primaryjoin": "and_(ProjectTrack.track_id == DrumTrack.id, ProjectTrack.track_type == 'drum')",
            "foreign_keys": "[ProjectTrack.track_id]",
            "overlaps": "audio_track,midi_track,project_tracks,sampler_track"
        }
    )

# API Models
class DrumTrackRead(DrumTrackBase):
    """API response model for drum track data"""
    sampler_track_ids: list[uuid.UUID] = Field(default_factory=list)
    sampler_tracks: list["SamplerTrackRead"] = Field(default_factory=list)

class DrumTrackCreate(DrumTrackBase):
    """API request model for creating a drum track"""
    
class DrumTrackUpdate(all_optional(DrumTrackBase, "DrumTrackUpdate")):
    """API request model for updating a drum track"""
