from typing import Optional
import uuid
from pydantic import Field
from sqlmodel import Relationship

from app2.models.user import User
from app2.models.base import MidiFileBase
from app2.models.track import Track


class MidiFile(MidiFileBase, table=True):
    """Sound model for the database"""
    __tablename__ = "midi_files"
    
    # Relationships
    track: Optional["Track"] = Relationship(back_populates="midi_file")