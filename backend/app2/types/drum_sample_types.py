from enum import Enum


class DrumSampleType(str, Enum):
    KICK = "kick"
    SNARE = "snare"
    CLOSED_HH = "closed_hh"
    OPEN_HH = "open_hh"
    CRASH = "crash"
    RIDE = "ride"
    TOM = "tom"
    RIM = "rim"
    CLAP = "clap"
    CYMBAL = "cymbal"
    EIGHT_O_EIGHT = "eight_o_eight"
    PERC = "perc"
    HIT = "hit"
    FX = "fx"
