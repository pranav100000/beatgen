"""
Repository for DrumTrack models
"""

from typing import List
import uuid
from sqlmodel import Session, select

from app2.models.track_models.drum_track import (
    DrumTrack,
)
from app2.repositories.base_repository import BaseRepository


class DrumTrackRepository(BaseRepository[DrumTrack]):
    """Repository for drum track operations"""

    def __init__(self, session: Session):
        super().__init__(DrumTrack, session)

    async def get(self, track_id: uuid.UUID) -> DrumTrack:
        """Get a drum track by ID"""
        query = select(DrumTrack).where(DrumTrack.id == track_id)
        return self.session.exec(query).first()

    async def get_by_user_id(self, user_id: uuid.UUID) -> List[DrumTrack]:
        """Get all drum tracks for a specific user"""
        query = select(DrumTrack).where(DrumTrack.user_id == user_id)
        return self.session.exec(query).all()
