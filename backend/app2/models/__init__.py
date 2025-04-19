"""
SQLModel models for the application
"""
# Import models to ensure they're registered with SQLModel
from app2.models.user import User, UserRead, UserCreate, UserUpdate, UserLogin, UserPasswordChange
from app2.models.project import Project, ProjectRead, ProjectCreate, ProjectUpdate, ProjectWithTracks
from app2.models.track import Track, TrackRead, TrackCreate, TrackUpdate
from app2.models.file_models.audio_file import AudioFile
from app2.models.file_models.midi_file import MidiFile
from app2.models.file_models.instrument_file import InstrumentFile, InstrumentFileRead
from app2.models.token import Token, TokenPayload