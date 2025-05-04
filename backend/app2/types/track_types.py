from enum import Enum

class TrackType(str, Enum):
    """Enum for track types"""
    MIDI = "midi"
    AUDIO = "audio"
    SAMPLER = "sampler"
    DRUM = "drum"