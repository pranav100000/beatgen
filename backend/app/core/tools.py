"""
Tool definitions for the AI assistant to use with Claude API
"""

from typing import List, Dict, Any

# Track tools
def get_adjust_volume_tool() -> Dict[str, Any]:
    """Tool for adjusting track volume"""
    return {
        "name": "adjust_volume",
        "description": "Change the volume of a track. Volume ranges from 0 (silent) to 100 (full volume).",
        "input_schema": {
            "type": "object",
            "properties": {
                "track_id": {
                    "type": "string",
                    "description": "The ID of the track to adjust"
                },
                "value": {
                    "type": "number",
                    "description": "Volume value from 0-100"
                }
            },
            "required": ["track_id", "value"]
        }
    }

def get_adjust_pan_tool() -> Dict[str, Any]:
    """Tool for adjusting track pan position"""
    return {
        "name": "adjust_pan",
        "description": "Change the stereo panning of a track. Pan ranges from -100 (full left) to 100 (full right), with 0 being center.",
        "input_schema": {
            "type": "object",
            "properties": {
                "track_id": {
                    "type": "string",
                    "description": "The ID of the track to adjust"
                },
                "value": {
                    "type": "number",
                    "description": "Pan value from -100 to 100"
                }
            },
            "required": ["track_id", "value"]
        }
    }

def get_toggle_mute_tool() -> Dict[str, Any]:
    """Tool for muting/unmuting a track"""
    return {
        "name": "toggle_mute",
        "description": "Mute or unmute a track. When muted, the track won't be heard during playback.",
        "input_schema": {
            "type": "object",
            "properties": {
                "track_id": {
                    "type": "string",
                    "description": "The ID of the track to mute/unmute"
                },
                "muted": {
                    "type": "boolean",
                    "description": "Whether the track should be muted (true) or unmuted (false)"
                }
            },
            "required": ["track_id", "muted"]
        }
    }

def get_toggle_solo_tool() -> Dict[str, Any]:
    """Tool for soloing/unsoloing a track"""
    return {
        "name": "toggle_solo",
        "description": "Solo or unsolo a track. When soloed, only this track and other soloed tracks will be heard during playback.",
        "input_schema": {
            "type": "object",
            "properties": {
                "track_id": {
                    "type": "string",
                    "description": "The ID of the track to solo/unsolo"
                },
                "soloed": {
                    "type": "boolean",
                    "description": "Whether the track should be soloed (true) or unsoloed (false)"
                }
            },
            "required": ["track_id", "soloed"]
        }
    }

def get_rename_track_tool() -> Dict[str, Any]:
    """Tool for renaming a track"""
    return {
        "name": "rename_track",
        "description": "Change the name of a track.",
        "input_schema": {
            "type": "object",
            "properties": {
                "track_id": {
                    "type": "string",
                    "description": "The ID of the track to rename"
                },
                "name": {
                    "type": "string",
                    "description": "The new name for the track"
                }
            },
            "required": ["track_id", "name"]
        }
    }

def get_move_track_tool() -> Dict[str, Any]:
    """Tool for moving a track on the timeline"""
    return {
        "name": "move_track",
        "description": "Move a track to a different position on the timeline and/or vertically in the track list.",
        "input_schema": {
            "type": "object",
            "properties": {
                "track_id": {
                    "type": "string",
                    "description": "The ID of the track to move"
                },
                "position": {
                    "type": "object",
                    "properties": {
                        "x": {
                            "type": "number",
                            "description": "Horizontal position in pixels (timeline position)"
                        },
                        "y": {
                            "type": "number",
                            "description": "Vertical position in pixels (track order)"
                        }
                    },
                    "required": ["x", "y"]
                }
            },
            "required": ["track_id", "position"]
        }
    }

def get_change_instrument_tool() -> Dict[str, Any]:
    """Tool for changing a track's instrument"""
    return {
        "name": "change_instrument",
        "description": "Change the instrument for a MIDI or drum track.",
        "input_schema": {
            "type": "object",
            "properties": {
                "track_id": {
                    "type": "string",
                    "description": "The ID of the track to change"
                },
                "instrument_id": {
                    "type": "string",
                    "description": "The ID of the instrument to use"
                },
                "instrument_name": {
                    "type": "string",
                    "description": "The name of the instrument (for display purposes)"
                }
            },
            "required": ["track_id", "instrument_id", "instrument_name"]
        }
    }

# Project tools
def get_change_bpm_tool() -> Dict[str, Any]:
    """Tool for changing project tempo"""
    return {
        "name": "change_bpm",
        "description": "Change the tempo (beats per minute) of the project.",
        "input_schema": {
            "type": "object",
            "properties": {
                "value": {
                    "type": "number",
                    "description": "The new BPM value (typically between 60-180)"
                }
            },
            "required": ["value"]
        }
    }

def get_change_time_signature_tool() -> Dict[str, Any]:
    """Tool for changing project time signature"""
    return {
        "name": "change_time_signature",
        "description": "Change the time signature of the project (e.g., 4/4, 3/4, 6/8).",
        "input_schema": {
            "type": "object",
            "properties": {
                "numerator": {
                    "type": "integer",
                    "description": "The top number of the time signature (beats per measure)"
                },
                "denominator": {
                    "type": "integer",
                    "description": "The bottom number of the time signature (note value that gets one beat)"
                }
            },
            "required": ["numerator", "denominator"]
        }
    }

def get_change_key_signature_tool() -> Dict[str, Any]:
    """Tool for changing project key signature"""
    return {
        "name": "change_key_signature",
        "description": "Change the key signature of the project (e.g., C major, A minor).",
        "input_schema": {
            "type": "object",
            "properties": {
                "key": {
                    "type": "string",
                    "description": "The new key signature"
                }
            },
            "required": ["key"]
        }
    }

# Utility tools
def get_identify_track_tool() -> Dict[str, Any]:
    """Tool for identifying a track by description"""
    return {
        "name": "identify_track",
        "description": "Find a track based on a description when the track ID is unknown.",
        "input_schema": {
            "type": "object",
            "properties": {
                "description": {
                    "type": "string",
                    "description": "Description of the track to find (name, type, instrument, etc.)"
                }
            },
            "required": ["description"]
        }
    }

# Get all tools
def get_all_tools() -> List[Dict[str, Any]]:
    """Get all available tools for the AI assistant"""
    return [
        # Track tools
        get_adjust_volume_tool(),
        get_adjust_pan_tool(),
        get_toggle_mute_tool(),
        get_toggle_solo_tool(),
        get_rename_track_tool(),
        get_move_track_tool(),
        get_change_instrument_tool(),
        
        # Project tools
        get_change_bpm_tool(),
        get_change_time_signature_tool(),
        get_change_key_signature_tool(),
        
        # Utility tools
        get_identify_track_tool()
    ]