"""
Functions for serializing project data for AI context
"""

from typing import Dict, Any, List, Optional
from app.schemas.project import Project, Track
from app.schemas.assistant import ProjectContext, TrackContext


def serialize_track(track: Track) -> TrackContext:
    """Convert a track to simplified format for AI context"""
    return TrackContext(
        id=track.id,
        name=track.name,
        type=track.type,
        instrument=track.instrument_name,
        volume=track.volume * 100,  # Convert to 0-100 scale
        pan=track.pan * 100,        # Convert to -100 to 100 scale
        muted=track.mute,
        position={
            "x": track.x_position,
            "y": track.y_position
        }
    )


def serialize_project(project: Project) -> ProjectContext:
    """Convert a project to simplified format for AI context"""
    # Format time signature
    time_signature = f"{project.time_signature_numerator}/{project.time_signature_denominator}"
    
    # Create track contexts
    track_contexts = [serialize_track(track) for track in project.tracks]
    
    return ProjectContext(
        id=str(project.id),
        name=project.name,
        bpm=project.bpm,
        time_signature=time_signature,
        key_signature=project.key_signature,
        tracks=track_contexts
    )


def find_track_by_description(
    description: str, 
    tracks: List[Track]
) -> Optional[Dict[str, Any]]:
    """Find a track based on a natural language description"""
    # First, try exact name match
    for track in tracks:
        if track.name.lower() == description.lower():
            return {
                "track_id": track.id,
                "name": track.name,
                "confidence": 1.0,
                "type": track.type,
                "instrument": track.instrument_name
            }
    
    # Try partial name match
    partial_matches = []
    for track in tracks:
        if description.lower() in track.name.lower() or track.name.lower() in description.lower():
            partial_matches.append({
                "track_id": track.id,
                "name": track.name,
                "confidence": 0.8,
                "type": track.type,
                "instrument": track.instrument_name
            })
    
    if partial_matches:
        return partial_matches[0]  # Return highest confidence match
    
    # Try instrument match
    for track in tracks:
        if track.instrument_name and description.lower() in track.instrument_name.lower():
            return {
                "track_id": track.id,
                "name": track.name,
                "confidence": 0.7,
                "type": track.type,
                "instrument": track.instrument_name
            }
    
    # Try type match
    type_keywords = {
        "drum": ["drum", "drums", "beat", "percussion", "rhythm"],
        "midi": ["midi", "melody", "harmony", "chords", "piano", "keyboard"],
        "audio": ["audio", "recording", "vocal", "vocals", "voice", "sample"]
    }
    
    for track in tracks:
        for type_key, keywords in type_keywords.items():
            if track.type == type_key and any(keyword in description.lower() for keyword in keywords):
                return {
                    "track_id": track.id,
                    "name": track.name,
                    "confidence": 0.6,
                    "type": track.type,
                    "instrument": track.instrument_name
                }
    
    # If no matches found, return None
    return None