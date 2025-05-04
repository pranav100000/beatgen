"""
Project models for SQL database
"""
from typing import Optional, List, TYPE_CHECKING, Union
from sqlmodel import SQLModel, Field, Relationship
from datetime import datetime
import uuid

from app2.models.base import ProjectBase
from app2.models.track_models.audio_track import AudioTrackRead
from app2.models.track_models.drum_track import DrumTrackRead
from app2.models.track_models.sampler_track import SamplerTrackRead
from .project_track import ProjectTrack, ProjectTrackRead
from app2.types.track_types import TrackType
from app2.models.track_models.midi_track import MidiTrackRead

# Handle circular imports
if TYPE_CHECKING:
    from app2.models.user import User
    from app2.models.track_models.audio_track import AudioTrack
    from app2.models.track_models.midi_track import MidiTrack
    from app2.models.track_models.sampler_track import SamplerTrack
    from app2.models.track_models.drum_track import DrumTrack
    from app2.models.project_track import ProjectTrack, ProjectTrackRead

# Database model
class Project(ProjectBase, table=True):
    """Project model for the database"""
    __tablename__ = "projects"
    # Relationships
    user_id: uuid.UUID = Field(foreign_key="users.id")
    user: Optional["User"] = Relationship(back_populates="projects")
    # Direct relationship to ProjectTrack entries
    project_tracks: List["ProjectTrack"] = Relationship(back_populates="project")

# API Models
class ProjectRead(ProjectBase):
    """API response model for project data"""

class ProjectCreate(ProjectBase):
    """API request model for creating a project"""

class ProjectUpdate(SQLModel):
    """API request model for updating a project"""
    name: Optional[str] = None
    bpm: Optional[float] = None
    time_signature_numerator: Optional[int] = None
    time_signature_denominator: Optional[int] = None
    key_signature: Optional[str] = None

# Combined track model for API responses
class CombinedTrack(SQLModel):
    """Model that combines Track and ProjectTrack data for API responses"""
    id: uuid.UUID
    name: str
    type: TrackType
    # ProjectTrack fields
    volume: Optional[float] = 0.0
    pan: Optional[float] = 0.0
    mute: Optional[bool] = False
    x_position: Optional[float] = 0.0
    y_position: Optional[float] = 0.0
    trim_start_ticks: Optional[int] = 0
    trim_end_ticks: Optional[int] = 0
    duration_ticks: Optional[int] = 0
    track_number: Optional[int] = 0
    
    # Track data based on type
    track: Union[AudioTrackRead, MidiTrackRead, SamplerTrackRead, DrumTrackRead]

# Projects with tracks included
class ProjectWithTracks(ProjectBase):
    """API response model for project with tracks data"""
    user_id: uuid.UUID
    # Only combined tracks
    tracks: List[CombinedTrack] = Field(default_factory=list)