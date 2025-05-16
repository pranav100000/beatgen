"""
Repository for SamplerTrack models
"""

from typing import List
import uuid
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select, func

from app2.models.track_models.sampler_track import (
    SamplerTrack,
)
from app2.repositories.base_repository import BaseRepository


class SamplerTrackRepository(BaseRepository[SamplerTrack]):
    """Repository for sampler track operations"""

    def __init__(self, session: AsyncSession):
        super().__init__(SamplerTrack, session)

    async def get(self, track_id: uuid.UUID) -> SamplerTrack:
        """Get a sampler track by ID"""
        query = select(SamplerTrack).where(SamplerTrack.id == track_id)
        result_proxy = await self.session.execute(query)
        return result_proxy.scalars().first()

    async def get_by_user_id(self, user_id: uuid.UUID) -> List[SamplerTrack]:
        """Get all sampler tracks for a specific user"""
        query = select(SamplerTrack).where(SamplerTrack.user_id == user_id)
        result_proxy = await self.session.execute(query)
        return result_proxy.scalars().all()

    async def get_by_user_id_paginated(
        self, user_id: uuid.UUID, skip: int, limit: int
    ) -> tuple[List[SamplerTrack], int]:
        """Get paginated sampler tracks for a specific user."""
        items_query = (
            select(SamplerTrack)
            .where(SamplerTrack.user_id == user_id)
            .offset(skip)
            .limit(limit)
        )
        items_result_proxy = await self.session.execute(items_query)
        items = items_result_proxy.scalars().all()

        count_query = (
            select(func.count(SamplerTrack.id))
            .select_from(SamplerTrack)
            .where(SamplerTrack.user_id == user_id)
        )
        total_count_result_proxy = await self.session.execute(count_query)
        total_count = total_count_result_proxy.scalar_one_or_none() or 0

        return items, total_count
