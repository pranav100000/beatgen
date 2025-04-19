"""
Track models for SQL database
"""
from enum import Enum
from typing import List, Optional, TYPE_CHECKING
from pydantic import validator, root_validator
from sqlmodel import SQLModel, Field, Relationship
from datetime import datetime
import uuid

from app2.models.base import TimestampMixin, UUIDMixin, TrackBase
from .project_track import ProjectTrack
from app2.types.track_types import TrackType

# Handle circular imports
if TYPE_CHECKING:
    from app2.models.user import User
    from app2.models.project import Project
    from .project_track import ProjectTrack
    from app2.models.file_models.audio_file import AudioFile
    from app2.models.file_models.midi_file import MidiFile
    from app2.models.file_models.instrument_file import InstrumentFile


# Database model
class Track(TrackBase, table=True):
    """Track model for the database"""
    __tablename__ = "tracks"
    # Foreign Key
    user_id: uuid.UUID = Field(foreign_key="users.id")
    # Relationships
    user: Optional["User"] = Relationship(back_populates="tracks")

    # Foreign keys to resources - used differently based on track type
    audio_file_id: Optional[uuid.UUID] = Field(default=None, foreign_key="audio_files.id")
    midi_file_id: Optional[uuid.UUID] = Field(default=None, foreign_key="midi_files.id")
    instrument_id: Optional[uuid.UUID] = Field(default=None, foreign_key="instrument_files.id")
    drum_track_id: Optional[uuid.UUID] = Field(default=None, foreign_key="tracks.id")
    
    # Relationships
    audio_file: Optional["AudioFile"] = Relationship(
        back_populates="track",  # Link to AudioFile.track
        sa_relationship_kwargs=dict(foreign_keys="[Track.audio_file_id]")
    )
    midi_file: Optional["MidiFile"] = Relationship(sa_relationship_kwargs=dict(foreign_keys="[Track.midi_file_id]"))
    instrument_file: Optional["InstrumentFile"] = Relationship(
        back_populates="track", # Added back_populates
        sa_relationship_kwargs=dict(foreign_keys="[Track.instrument_id]")
    )
    
    projects: List["Project"] = Relationship(back_populates="tracks", link_model=ProjectTrack)
    
    # Relationship to the association object
    project_tracks: List["ProjectTrack"] = Relationship(back_populates="track")
    
    @root_validator(pre=False, skip_on_failure=True)
    def check_track_type_constraints(cls, values):
        track_type = values.get('type')
        audio_file_id = values.get('audio_file_id')
        midi_file_id = values.get('midi_file_id')
        instrument_id = values.get('instrument_id')
        drum_track_id = values.get('drum_track_id')

        if track_type == TrackType.AUDIO:
            if not audio_file_id:
                raise ValueError("AUDIO tracks must have an audio_file_id")
            if midi_file_id or instrument_id or drum_track_id:
                raise ValueError("AUDIO tracks must only have audio_file_id")
        elif track_type == TrackType.INSTRUMENT:
            if not instrument_id or not midi_file_id:
                raise ValueError("INSTRUMENT tracks must have instrument_id and midi_file_id")
            if audio_file_id or drum_track_id:
                raise ValueError("INSTRUMENT tracks must only have instrument_id and midi_file_id")
        elif track_type == TrackType.SAMPLER:
            if not audio_file_id or not midi_file_id: 
                raise ValueError("SAMPLER tracks must have audio_file_id")
            if instrument_id:
                raise ValueError("SAMPLER tracks must only have audio_file_id")
        elif track_type == TrackType.DRUM:
            if audio_file_id or midi_file_id or instrument_id or drum_track_id:
                raise ValueError("DRUM tracks must not have audio_file_id, midi_file_id, instrument_id, or drum_track_id")
        else:
            pass

        return values

# API Models
class TrackRead(TrackBase):
    """API response model for track data"""

class TrackCreate(TrackBase):
    """API request model for creating a track"""
    user_id: uuid.UUID
    audio_file_id: Optional[uuid.UUID] = None
    midi_file_id: Optional[uuid.UUID] = None
    instrument_id: Optional[uuid.UUID] = None
    drum_track_id: Optional[uuid.UUID] = None

class TrackUpdate(TrackBase):
    """API request model for updating a track"""