from pydantic import BaseModel
from typing import Optional, List, Dict, Any, Union, Literal

from app2.types.assistant_actions import AssistantAction


class AssistantRequestBase(BaseModel):
    """Base request data for the AI assistant"""
    model: str
    prompt: str
    project_id: Optional[str] = None
    context: Optional[Dict[str, Any]] = None


class AssistantResponseBase(BaseModel):
    """Base response from the AI assistant"""

    response: str
    actions: Optional[List[AssistantAction]] = None


class TrackData(BaseModel):
    """Data for a generated or edited track"""

    notes: List[Dict[str, Any]]
    instrument_name: Optional[str] = None
    instrument_id: Optional[str] = None  # Key for the instrument soundfont


# Tool calling models for Claude API
class ToolDefinition(BaseModel):
    """Definition of a tool that Claude can use"""

    name: str
    description: str
    parameters: Dict[str, Any]  # Will contain properties and required fields


class ToolCallResponse(BaseModel):
    """Tool call output from Claude API"""

    name: str
    parameters: Dict[str, Any]


class ToolResults(BaseModel):
    """Results from executing tools"""

    success: bool
    message: str
    data: Optional[Dict[str, Any]] = None


# Project data models for AI context
class TrackContext(BaseModel):
    """Simplified track data for AI context"""

    id: str
    name: str
    type: str  # "midi", "audio", "drum"
    instrument: Optional[str] = None
    volume: float
    pan: float
    muted: bool
    position: Dict[str, float]  # {x: 0, y: 0}


class ProjectContext(BaseModel):
    """Project data for AI context"""

    id: str
    name: str
    bpm: float
    time_signature: str  # "4/4" format
    key_signature: str
    tracks: List[TrackContext]


# Generate models
class GenerateRequest(AssistantRequestBase):
    """Request for generating multiple tracks"""

    style: Optional[str] = None


class GenerateResponse(AssistantResponseBase):
    """Response for the generate endpoint"""

    tracks: List[TrackData]


# Edit models
class EditRequest(AssistantRequestBase):
    """Request for editing a specific track"""

    track_id: str
    edit_type: Optional[str] = None  # melody, rhythm, harmony, etc.


class EditResponse(AssistantResponseBase):
    """Response for the edit endpoint"""

    track: TrackData


# Legacy models for backward compatibility
class AssistantRequest(AssistantRequestBase):
    """Request data for the AI assistant (legacy)"""
    track_id: Optional[str] = None


class AssistantResponse(AssistantResponseBase):
    """Response from the AI assistant (legacy)"""

    track_id: Optional[str] = None


class QueueEventData(BaseModel):
    """Base model for queue event data"""

    message: Optional[str] = None
    status: Optional[str] = None
    name: Optional[str] = None
    description: Optional[str] = None
    message_id: Optional[str] = None
    chunk: Optional[str] = None
    chunk_index: Optional[int] = None
    is_complete: Optional[bool] = None
    details: Optional[str] = None
    error: Optional[str] = None
    track_id: Optional[str] = None


class QueueEvent(BaseModel):
    """Model for events sent through the asyncio.Queue"""

    type: Literal[
        "connected",
        "stage",
        "status",
        "response_start",
        "response_chunk",
        "response_end",
        "action",
        "complete",
        "cancelled",
        "error",
    ]
    data: Union[
        QueueEventData,
        AssistantAction,
        AssistantResponse,
        GenerateResponse,
        EditResponse,
    ]
