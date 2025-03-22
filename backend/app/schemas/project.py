from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from uuid import UUID, uuid4


class TrackBase(BaseModel):
    name: str
    type: str  # "midi", "audio", "drum"
    volume: float = 1.0
    pan: float = 0.0
    solo: bool = False
    mute: bool = False
    color: Optional[str] = None


class Track(TrackBase):
    id: UUID = Field(default_factory=uuid4)
    content: Dict[str, Any] = {}  # Flexible content based on track type


class ProjectBase(BaseModel):
    name: str
    bpm: float = 120.0
    time_signature_numerator: int
    time_signature_denominator: int


class ProjectCreate(ProjectBase):
    pass


class Project(ProjectBase):
    id: UUID = Field(default_factory=uuid4)
    user_id: str
    tracks: List[Track] = []
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    bpm: Optional[float] = None
    time_signature_numerator: int
    time_signature_denominator: int