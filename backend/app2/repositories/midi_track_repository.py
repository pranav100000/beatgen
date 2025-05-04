"""
Repository for MidiTrack models
"""
from typing import List, Optional, Union
import uuid
from sqlmodel import Session, select

from app2.models.track_models.midi_track import MidiTrack, MidiTrackCreate, MidiTrackUpdate
from app2.repositories.base_repository import BaseRepository

class MidiTrackRepository(BaseRepository[MidiTrack]):
    """Repository for midi track operations"""
    
    def __init__(self, session: Session):
        super().__init__(MidiTrack, session)
    
    async def get(self, midi_track_id: uuid.UUID) -> Optional[MidiTrack]:
        """Get a midi track by ID"""
        query = select(MidiTrack).where(MidiTrack.id == midi_track_id)
        return self.session.exec(query).first()
    
    async def get_by_user_id(self, user_id: uuid.UUID) -> List[MidiTrack]:
        """Get all midi tracks for a specific user"""
        query = select(MidiTrack).where(MidiTrack.user_id == user_id)
        return self.session.exec(query).all()