"""
Soundfont models for SQL database
"""

from typing import TYPE_CHECKING, List
from sqlmodel import Relationship

from app2.models.base import InstrumentFileBase

if TYPE_CHECKING:
    from app2.models.track_models.midi_track import MidiTrack


# Database model
class InstrumentFile(InstrumentFileBase, table=True):
    """Instrument model for the database"""

    __tablename__ = "instrument_files"

    # Relationship with specialized track models
    midi_tracks: List["MidiTrack"] = Relationship(back_populates="instrument_file")


# API Models
class InstrumentFileRead(InstrumentFileBase):
    """API response model for instrument file data"""

    pass
