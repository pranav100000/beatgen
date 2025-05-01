from enum import Enum
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field, validator
from abc import ABC

from app2.models.public_models.drum_samples import DrumSamplePublicRead

class TrackType(str, Enum):
    AUDIO = "audio"
    MIDI = "midi"
    DRUM = "drum"

class KeySignature(str, Enum):
    C_MAJOR = "C Major"
    G_MAJOR = "G Major"
    D_MAJOR = "D Major"
    A_MAJOR = "A Major"
    E_MAJOR = "E Major"
    B_MAJOR = "B Major"
    F_SHARP_MAJOR = "F# Major"
    C_SHARP_MAJOR = "C# Major"
    F_MAJOR = "F Major"
    B_FLAT_MAJOR = "Bb Major"
    E_FLAT_MAJOR = "Eb Major"
    A_FLAT_MAJOR = "Ab Major"
    D_FLAT_MAJOR = "Db Major"
    G_FLAT_MAJOR = "Gb Major"
    # Minor keys
    A_MINOR = "A Minor"
    E_MINOR = "E Minor"
    B_MINOR = "B Minor"
    F_SHARP_MINOR = "F# Minor"
    C_SHARP_MINOR = "C# Minor"
    G_SHARP_MINOR = "G# Minor"
    D_SHARP_MINOR = "D# Minor"
    A_SHARP_MINOR = "A# Minor"
    D_MINOR = "D Minor"
    G_MINOR = "G Minor"
    C_MINOR = "C Minor"
    F_MINOR = "F Minor"
    B_FLAT_MINOR = "Bb Minor"
    E_FLAT_MINOR = "Eb Minor"
    
class ActionType(str, Enum):
    CHANGE_BPM = "change_bpm"
    CHANGE_KEY = "change_key"
    CHANGE_TIME_SIGNATURE = "change_time_signature"
    ADD_TRACK = "add_track"
    ADD_DRUM_TRACK = "add_drum_track"
    ADJUST_VOLUME = "adjust_volume"
    ADJUST_PAN = "adjust_pan"
    TOGGLE_MUTE = "toggle_mute"
    TOGGLE_SOLO = "toggle_solo"

# Base models for action data
class ActionData(BaseModel):
    """Base class for all action data"""
    pass

class BPMData(ActionData):
    value: float = Field(..., ge=20.0, le=400.0, description="The new BPM value between 20 and 400")

class KeyData(ActionData):
    value: KeySignature = Field(..., description="The new key value")

class TimeSignatureData(ActionData):
    numerator: int = Field(..., gt=0, le=32, description="Time signature numerator (1-32)")
    denominator: int = Field(..., description="Time signature denominator (power of 2)")

    @validator('denominator')
    def validate_denominator(cls, v):
        valid_denominators = [1, 2, 4, 8, 16, 32]
        if v not in valid_denominators:
            raise ValueError(f'Denominator must be a power of 2 up to 32. Got {v}')
        return v

class TrackData(ActionData):
    type: TrackType
    instrument_id: str = Field(..., description="The instrument ID")
    notes: List[dict] = Field(..., description="The notes to add to the track")

class SingleDrumTrackData(ActionData):
    type: TrackType
    sample: DrumSamplePublicRead = Field(..., description="The sample to add to the track")
    notes: List[dict] = Field(..., description="The notes to add to the track")

class DrumTrackData(ActionData):
    type: TrackType
    tracks: List[SingleDrumTrackData] = Field(..., description="The tracks to add to the drum track")

class VolumeData(ActionData):
    track_id: str = Field(..., description="The track ID")
    value: float = Field(..., ge=0.0, le=1.0, description="The new volume value between 0 (silent) and 1 (full volume)")

class PanData(ActionData):
    track_id: str = Field(..., description="The track ID")
    value: float = Field(..., ge=-1, le=1, description="The new pan value between -1 (full left) and 1 (full right)")

class MuteData(ActionData):
    track_id: str = Field(..., description="The track ID")
    muted: bool = Field(..., description="The new mute state")

class SoloData(ActionData):
    track_id: str = Field(..., description="The track ID")
    soloed: bool = Field(..., description="The new solo state")

class AssistantAction(BaseModel):
    """Base class for all assistant actions"""
    action_type: ActionType = Field(..., description="The type of action to perform")
    data: ActionData = Field(..., description="The data for this action")

    @classmethod
    def change_bpm(cls, value: float) -> "AssistantAction":
        return cls(action_type=ActionType.CHANGE_BPM, data=BPMData(value=value))

    @classmethod
    def change_key(cls, value: KeySignature) -> "AssistantAction":
        return cls(action_type=ActionType.CHANGE_KEY, data=KeyData(value=value))

    @classmethod
    def change_time_signature(cls, numerator: int, denominator: int) -> "AssistantAction":
        return cls(
            action_type=ActionType.CHANGE_TIME_SIGNATURE,
            data=TimeSignatureData(numerator=numerator, denominator=denominator)
        )

    @classmethod
    def add_track(cls, type: TrackType, instrument_id: str, notes: List[dict]) -> "AssistantAction":
        return cls(
            action_type=ActionType.ADD_TRACK,
            data=TrackData(type=type, instrument_id=instrument_id, notes=notes)
        )
        
    @classmethod
    def add_drum_track(cls, type: TrackType, tracks: List[SingleDrumTrackData]) -> "AssistantAction":
        return cls(
            action_type=ActionType.ADD_DRUM_TRACK,
            data=DrumTrackData(type=type, tracks=tracks)
        )

    @classmethod
    def adjust_volume(cls, track_id: str, value: float) -> "AssistantAction":
        return cls(
            action_type=ActionType.ADJUST_VOLUME,
            data=VolumeData(track_id=track_id, value=value)
        )

    @classmethod
    def adjust_pan(cls, track_id: str, value: float) -> "AssistantAction":
        return cls(
            action_type=ActionType.ADJUST_PAN,
            data=PanData(track_id=track_id, value=value)
        )

    @classmethod
    def toggle_mute(cls, track_id: str, muted: bool) -> "AssistantAction":
        return cls(
            action_type=ActionType.TOGGLE_MUTE,
            data=MuteData(track_id=track_id, muted=muted)
        )

    @classmethod
    def toggle_solo(cls, track_id: str, soloed: bool) -> "AssistantAction":
        return cls(
            action_type=ActionType.TOGGLE_SOLO,
            data=SoloData(track_id=track_id, soloed=soloed)
        )

    def model_dump(self, **kwargs) -> Dict[str, Any]:
        """Override model_dump to provide a clean serialization"""
        result = super().model_dump(**kwargs)
        if 'data' in result:
            result.update(result['data'])
            del result['data']
        return result