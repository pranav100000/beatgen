"""
Link table model for the many-to-many relationship between Projects and Track types
"""
from typing import Optional, TYPE_CHECKING, Union, Literal
import uuid
from sqlmodel import SQLModel, Field, Relationship
from sqlalchemy import Column, ForeignKey, Enum as SAEnum

from app2.models.base import ProjectTrackBase, all_optional
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
    
    track_type: TrackType = Field(
        sa_column=Column(SAEnum(TrackType), nullable=False)
    )
    
    # Relationships
    project: Optional["Project"] = Relationship(
        back_populates="project_tracks",
        sa_relationship_kwargs={"foreign_keys": "[ProjectTrack.project_id]"}
    )
    
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
            "foreign_keys": "[ProjectTrack.track_id]",
            "overlaps": "audio_track,midi_track,project_tracks,sampler_track"
        }
    )

# API Models
class ProjectTrackRead(ProjectTrackBase):
    """Base DTO for Project-Track relationships"""
    project_id: uuid.UUID
    track_id: uuid.UUID
    track_type: TrackType
class ProjectTrackCreate(ProjectTrackBase):
    """Model for creating a new project-track relationship"""
    project_id: uuid.UUID
    track_id: uuid.UUID
    track_type: TrackType
class ProjectTrackUpdate(all_optional(ProjectTrackRead, "ProjectTrackUpdate")):
    """Model for updating project-track settings"""
    track_id: uuid.UUID
    project_id: uuid.UUID
    track_type: TrackType