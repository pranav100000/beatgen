"""
MIDI Track model for SQL database
"""

from typing import Dict, Optional, TYPE_CHECKING
from sqlalchemy import Column
from sqlalchemy.dialects.postgresql import JSONB
from sqlmodel import Field, Relationship
import uuid

from app2.models.base import TrackBase, all_optional
from app2.models.public_models.instrument_file import InstrumentFileRead

# Handle circular imports
if TYPE_CHECKING:
    from app2.models.user import User
    from app2.models.project_track import ProjectTrack
    from app2.models.public_models.instrument_file import InstrumentFile


class MidiTrackBase(TrackBase):
    """Base model for MIDI tracks"""

    instrument_id: uuid.UUID
    midi_notes_json: Dict = Field(default_factory=dict, sa_column=Column(JSONB))


# Database model
class MidiTrack(MidiTrackBase, table=True):
    """MIDI Track model for the database"""

    __tablename__ = "midi_tracks"

    # User relationship
    user_id: uuid.UUID = Field(foreign_key="users.id", index=True)
    user: Optional["User"] = Relationship(back_populates="midi_tracks")

    instrument_id: uuid.UUID = Field(foreign_key="instrument_files.id", index=True)
    instrument_file: Optional["InstrumentFile"] = Relationship(
        back_populates="midi_tracks"
    )

    # Relationships to project tracks
    project_tracks: list["ProjectTrack"] = Relationship(
        back_populates="midi_track",
        sa_relationship_kwargs={
            "primaryjoin": "and_(ProjectTrack.track_id == MidiTrack.id, ProjectTrack.track_type == 'midi')",
            "foreign_keys": "[ProjectTrack.track_id]",
            "overlaps": "midi_track",
        },
    )


# API Models
class MidiTrackRead(MidiTrackBase):
    """API response model for MIDI track data"""

    instrument_file: InstrumentFileRead


class MidiTrackCreate(MidiTrackBase):
    """API request model for creating a MIDI track"""


class MidiTrackUpdate(all_optional(MidiTrackBase, "MidiTrackUpdate")):
    """API request model for updating a MIDI track"""
