from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from uuid import UUID, uuid4


class TrackBase(BaseModel):
    name: str
    type: str  # "midi", "audio", "drum"
    volume: float = 1.0
    pan: float = 0.0
    mute: bool = False
    color: Optional[str] = None


class Track(TrackBase):
    id: str
    duration: Optional[float] = None
    x_position: int = 0
    y_position: int = 0
    storage_key: str
    left_trim_ms: int = 0
    track_number: int = 0
    right_trim_ms: int = 0


class ProjectBase(BaseModel):
    name: str
    bpm: float = 120.0
    time_signature_numerator: int
    time_signature_denominator: int
    key_signature: str


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
    key_signature: str
    tracks: Optional[List[Track]] = None