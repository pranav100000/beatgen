"""
Repository for MidiTrack models
"""

from typing import List, Optional
import uuid
from sqlmodel import Session, select, func

from app2.models.track_models.midi_track import (
    MidiTrack,
)
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

    async def get_by_user_id_paginated(
        self, user_id: uuid.UUID, skip: int, limit: int
    ) -> tuple[List[MidiTrack], int]:
        """Get paginated midi tracks for a specific user."""
        # Query for items
        items_query = (
            select(MidiTrack)
            .where(MidiTrack.user_id == user_id)
            .offset(skip)
            .limit(limit)
        )
        items = self.session.exec(items_query).all()

        # Query for total count
        # Ensure the count is performed on a unique, non-nullable column if possible, e.g., MidiTrack.id
        count_query = (
            select(func.count(MidiTrack.id))
            .select_from(MidiTrack)
            .where(MidiTrack.user_id == user_id)
        )
        total_count = self.session.exec(count_query).one_or_none() or 0 # Use one_or_none() and default to 0

        return items, total_count
