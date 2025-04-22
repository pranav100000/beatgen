"""
Soundfont models for SQL database
"""
from typing import Optional, TYPE_CHECKING, List
from sqlmodel import SQLModel, Field, Relationship
from datetime import datetime
import uuid

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