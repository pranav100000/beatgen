"""
Repository for AudioTrack models
"""

from typing import List
import uuid
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from app2.models.track_models.audio_track import (
    AudioTrack,
)
from app2.repositories.base_repository import BaseRepository


class AudioTrackRepository(BaseRepository[AudioTrack]):
    """Repository for audio track operations"""

    def __init__(self, session: AsyncSession):
        super().__init__(AudioTrack, session)

    async def get(self, track_id: uuid.UUID) -> AudioTrack:
        """Get an audio track by ID"""
        query = select(AudioTrack).where(AudioTrack.id == track_id)
        result_proxy = await self.session.execute(query)
        return result_proxy.scalars().first()

    async def get_by_user_id(self, user_id: uuid.UUID) -> List[AudioTrack]:
        """Get all audio tracks for a specific user"""
        query = select(AudioTrack).where(AudioTrack.user_id == user_id)
        result_proxy = await self.session.execute(query)
        return result_proxy.scalars().all()
