from enum import Enum

class GenreType(str, Enum):
    POP = "pop"
    ROCK = "rock"
    JAZZ = "jazz"
    BLUES = "blues"
    COUNTRY = "country"
    HIP_HOP = "hip_hop"
    RAP = "rap"
    ELECTRONIC = "electronic"