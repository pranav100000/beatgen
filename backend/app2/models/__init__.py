"""
SQLModel models for the application
"""

# Import models to ensure they're registered with SQLModel
from app2.models.user import (
    User,
    UserRead,
    UserCreate,
    UserUpdate,
    UserLogin,
    UserPasswordChange,
)
from app2.models.project import (
    Project,
    ProjectRead,
    ProjectCreate,
    ProjectUpdate,
    ProjectWithTracks,
)
from app2.models.track_models.audio_track import (
    AudioTrack,
    AudioTrackRead,
    AudioTrackCreate,
    AudioTrackUpdate,
)
from app2.models.track_models.midi_track import (
    MidiTrack,
    MidiTrackRead,
    MidiTrackCreate,
    MidiTrackUpdate,
)
from app2.models.track_models.sampler_track import (
    SamplerTrack,
    SamplerTrackRead,
    SamplerTrackCreate,
    SamplerTrackUpdate,
)
from app2.models.track_models.drum_track import (
    DrumTrack,
    DrumTrackRead,
    DrumTrackCreate,
    DrumTrackUpdate,
)
from app2.models.public_models.instrument_file import InstrumentFile, InstrumentFileRead
from app2.models.token import Token, TokenPayload
from app2.models.public_models.drum_samples import (
    DrumSamplePublic,
    DrumSamplePublicCreate,
    DrumSamplePublicRead,
    DrumSamplePublicUpdate,
    DrumSamplePublicDelete,
)
