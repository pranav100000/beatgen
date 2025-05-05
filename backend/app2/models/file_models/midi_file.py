# from typing import TYPE_CHECKING, Optional
# import uuid
# from pydantic import Field
# from sqlmodel import Relationship

# from app2.models.user import User
# from app2.models.base import MidiFileBase
# from app2.types.file_types import FileType

# if TYPE_CHECKING:
#     from app2.models.track import Track


# class MidiFile(MidiFileBase, table=True):
#     """Sound model for the database"""
#     __tablename__ = "midi_files"

#     # Relationships
#     track: Optional["Track"] = Relationship(back_populates="midi_file")

# class MidiFileRead(MidiFileBase):
#     """API response model for MIDI file data"""
#     pass

# class MidiFileCreate(MidiFileBase):
#     """Model for creating a new MIDI file"""
#     type: FileType = FileType.MIDI
#     midi_file_id: uuid.UUID
#     instrument_id: Optional[uuid.UUID] = None
