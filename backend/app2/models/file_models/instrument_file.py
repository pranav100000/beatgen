"""
Soundfont models for SQL database
"""
from typing import Optional, TYPE_CHECKING
from sqlmodel import SQLModel, Field, Relationship
from datetime import datetime
import uuid

from app2.models.base import InstrumentFileBase
from app2.models.track import Track

# Handle circular imports
if TYPE_CHECKING:
    from app2.models.user import User

# Database model
class InstrumentFile(InstrumentFileBase, table=True):
    """Instrument model for the database"""
    __tablename__ = "instrument_files"
    # Relationships
    track: Optional["Track"] = Relationship(back_populates="instrument_file")
    
# API Models
class InstrumentFileRead(InstrumentFileBase):
    """API response model for instrument file data"""
    pass