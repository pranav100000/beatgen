from enum import Enum


class FileType(str, Enum):
    AUDIO = "audio"
    MIDI = "midi"
    INSTRUMENT = "instrument"
