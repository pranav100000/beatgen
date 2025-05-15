"""
Repository for SamplerTrack models
"""

from typing import List
import uuid
from sqlmodel import Session, select, func

from app2.models.track_models.sampler_track import (
    SamplerTrack,
)
from app2.repositories.base_repository import BaseRepository


class SamplerTrackRepository(BaseRepository[SamplerTrack]):
    """Repository for sampler track operations"""

    def __init__(self, session: Session):
        super().__init__(SamplerTrack, session)

    async def get(self, track_id: uuid.UUID) -> SamplerTrack:
        """Get a sampler track by ID"""
        query = select(SamplerTrack).where(SamplerTrack.id == track_id)
        return self.session.exec(query).first()

    async def get_by_user_id(self, user_id: uuid.UUID) -> List[SamplerTrack]:
        """Get all sampler tracks for a specific user"""
        query = select(SamplerTrack).where(SamplerTrack.user_id == user_id)
        return self.session.exec(query).all()

    async def get_by_user_id_paginated(
        self, user_id: uuid.UUID, skip: int, limit: int
    ) -> tuple[List[SamplerTrack], int]:
        """Get paginated sampler tracks for a specific user."""
        # Query for items
        items_query = (
            select(SamplerTrack)
            .where(SamplerTrack.user_id == user_id)
            .offset(skip)
            .limit(limit)
        )
        items = self.session.exec(items_query).all()

        # Query for total count
        count_query = (
            select(func.count(SamplerTrack.id))
            .select_from(SamplerTrack)
            .where(SamplerTrack.user_id == user_id)
        )
        total_count = self.session.exec(count_query).one_or_none() or 0

        return items, total_count
