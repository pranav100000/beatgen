"""
Link table model for the many-to-many relationship between Projects and Track types
"""
from typing import Optional, TYPE_CHECKING, Union, Literal
import uuid
from sqlmodel import SQLModel, Field, Relationship
from sqlalchemy import Column, ForeignKey

from app2.models.base import ProjectTrackBase
from app2.types.track_types import TrackType

# Handle circular imports
if TYPE_CHECKING:
    from .project import Project
    from .track_models.audio_track import AudioTrack
    from .track_models.midi_track import MidiTrack
    from .track_models.sampler_track import SamplerTrack
    from .track_models.drum_track import DrumTrack

# Database model
class ProjectTrack(ProjectTrackBase, table=True):
    """
    Represents the association between a Project and a specific track type,
    storing properties specific to this relationship (e.g., position, volume).
    """
    __tablename__ = "project_tracks"
    
    # Basic identification fields
    project_id: uuid.UUID = Field(
        default=None,
        foreign_key="projects.id", 
        primary_key=True
    )
    
    # We need a composite primary key but can't use foreign keys for each track type
    # as the foreign key would depend on track_type
    track_id: uuid.UUID = Field(
        default=None,
        primary_key=True
    )
    
    # Track type discriminator
    track_type: TrackType
    
    # Relationships
    project: Optional["Project"] = Relationship(back_populates="project_tracks")
    
    # Define explicit join conditions for each track type relationship
    audio_track: Optional["AudioTrack"] = Relationship(
        back_populates="project_tracks",
        sa_relationship_kwargs={
            "primaryjoin": "and_(ProjectTrack.track_id == AudioTrack.id, ProjectTrack.track_type == 'audio')",
            "foreign_keys": "[ProjectTrack.track_id]"
        }
    )
    
    midi_track: Optional["MidiTrack"] = Relationship(
        back_populates="project_tracks",
        sa_relationship_kwargs={
            "primaryjoin": "and_(ProjectTrack.track_id == MidiTrack.id, ProjectTrack.track_type == 'midi')",
            "foreign_keys": "[ProjectTrack.track_id]"
        }
    )
    
    sampler_track: Optional["SamplerTrack"] = Relationship(
        back_populates="project_tracks",
        sa_relationship_kwargs={
            "primaryjoin": "and_(ProjectTrack.track_id == SamplerTrack.id, ProjectTrack.track_type == 'sampler')",
            "foreign_keys": "[ProjectTrack.track_id]"
        }
    )
    
    drum_track: Optional["DrumTrack"] = Relationship(
        back_populates="project_tracks",
        sa_relationship_kwargs={
            "primaryjoin": "and_(ProjectTrack.track_id == DrumTrack.id, ProjectTrack.track_type == 'drum')",
            "foreign_keys": "[ProjectTrack.track_id]"
        }
    )

    def __init__(self, **data):
        super().__init__(**data)

# API Models
class ProjectTrackDTO(ProjectTrackBase):
    """Base DTO for Project-Track relationships"""
    track_type: TrackType
    track_id: uuid.UUID

class ProjectTrackCreate(ProjectTrackDTO):
    """Model for creating a new project-track relationship"""
    project_id: uuid.UUID
    
class ProjectTrackRead(ProjectTrackDTO):
    """Model for reading project-track data"""
    project_id: uuid.UUID

class ProjectTrackUpdate(SQLModel):
    """Model for updating project-track settings"""
    name: Optional[str] = None
    volume: Optional[float] = None
    pan: Optional[float] = None
    mute: Optional[bool] = None
    x_position: Optional[float] = None
    y_position: Optional[float] = None
    trim_start_ticks: Optional[int] = None
    trim_end_ticks: Optional[int] = None
    duration_ticks: Optional[int] = None
    track_number: Optional[int] = None