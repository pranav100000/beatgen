from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from uuid import UUID, uuid4


class TrackBase(BaseModel):
    """Base model for tracks"""
    name: str
    type: str  # "midi", "audio", "drum"
    volume: float = 1.0
    pan: float = 0.0
    mute: bool = False
    color: Optional[str] = None


class Track(TrackBase):
    """Model for track data"""
    id: str
    duration: Optional[float] = None
    x_position: float = 0.0  # Changed to float to support partial positions
    y_position: float = 0.0  # Changed to float for consistency
    storage_key: str
    left_trim_ms: int = 0
    track_number: int = 0
    right_trim_ms: int = 0


class ProjectBase(BaseModel):
    """Base model for projects"""
    name: str
    bpm: float = 120.0
    time_signature_numerator: int = 4
    time_signature_denominator: int = 4
    key_signature: str = "C"


class ProjectCreate(ProjectBase):
    """Model for creating a project"""
    pass


class Project(ProjectBase):
    """Model for a complete project"""
    id: UUID = Field(default_factory=uuid4)
    user_id: str
    tracks: List[Track] = []
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ProjectUpdate(BaseModel):
    """Model for updating a project"""
    name: Optional[str] = None
    bpm: Optional[float] = None
    time_signature_numerator: Optional[int] = None
    time_signature_denominator: Optional[int] = None
    key_signature: Optional[str] = None
    tracks: Optional[List[Track]] = None
    
    class Config:
        from_attributes = True