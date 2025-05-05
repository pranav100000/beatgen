import pytest
import pytest_asyncio
import uuid
from sqlalchemy.pool import StaticPool
from sqlmodel import SQLModel, Session, create_engine
from typing import AsyncGenerator, Generator
from unittest.mock import MagicMock
from unittest.mock import patch

# Monkey patch BaseRepository methods to handle UUID properly for testing
from app2.repositories.base_repository import BaseRepository

# Store original methods
original_find_by_id = BaseRepository.find_by_id
original_find_by_user = BaseRepository.find_by_user
original_update = BaseRepository.update
original_delete = BaseRepository.delete


@pytest.fixture(scope="session", autouse=True)
def patch_base_repository():
    """Monkeypatch BaseRepository to handle both string and UUID IDs"""

    # Patched find_by_id
    async def patched_find_by_id(self, id):
        # Convert UUID to string if needed
        if isinstance(id, uuid.UUID):
            id = str(id)
        return await original_find_by_id(self, id)

    # Patched find_by_user
    async def patched_find_by_user(self, user_id):
        # Convert UUID to string if needed
        if isinstance(user_id, uuid.UUID):
            user_id = str(user_id)
        return await original_find_by_user(self, user_id)

    # Patched update
    async def patched_update(self, id, data):
        # Convert UUID to string if needed
        if isinstance(id, uuid.UUID):
            id = str(id)
        return await original_update(self, id, data)

    # Patched delete
    async def patched_delete(self, id):
        # Convert UUID to string if needed
        if isinstance(id, uuid.UUID):
            id = str(id)
        return await original_delete(self, id)

    # Apply all patches
    with (
        patch.object(BaseRepository, "find_by_id", patched_find_by_id),
        patch.object(BaseRepository, "find_by_user", patched_find_by_user),
        patch.object(BaseRepository, "update", patched_update),
        patch.object(BaseRepository, "delete", patched_delete),
    ):
        yield


# Import models to ensure they're registered with SQLModel for table creation
from app2.models.user import User
from app2.models.project import Project
from app2.models.track import Track
from app2.models.project_track import ProjectTrack
from app2.models.file_models.audio_file import AudioFile
from app2.models.file_models.midi_file import MidiFile
from app2.models.public_models.instrument_file import InstrumentFile


# In-memory SQLite engine for testing
@pytest.fixture(scope="session")
def engine():
    # Connect with SQLite in-memory database
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )

    # Create all tables in the engine
    SQLModel.metadata.create_all(engine)

    yield engine


@pytest.fixture
def db_session(engine) -> Generator[Session, None, None]:
    """
    Creates a fresh SQLAlchemy session for each test.
    """
    with Session(engine) as session:
        yield session


@pytest_asyncio.fixture
async def async_db_session(db_session) -> AsyncGenerator[Session, None]:
    """
    Async version of the db_session fixture for async tests.
    """
    yield db_session


# Mock Supabase client
@pytest.fixture
def mock_supabase_client():
    return MagicMock()


# Test model fixtures
@pytest.fixture
def sample_user():
    return User(
        id=uuid.uuid4(),
        email="test@example.com",
        name="Test User",
        profile_picture_url="https://example.com/picture.jpg",
    )


@pytest.fixture
def sample_project():
    return Project(
        id=uuid.uuid4(),
        name="Test Project",
        description="A test project",
        user_id=uuid.uuid4(),
        bpm=120,
        key="C",
    )


@pytest.fixture
def sample_track():
    return Track(id=uuid.uuid4(), name="Test Track", type="midi", user_id=uuid.uuid4())


@pytest.fixture
def sample_project_track(sample_project, sample_track):
    return ProjectTrack(
        id=uuid.uuid4(),
        project_id=sample_project.id,
        track_id=sample_track.id,
        volume=0.8,
        pan=0,
        position=0,
    )


@pytest.fixture
def sample_midi_file():
    return MidiFile(
        id=uuid.uuid4(),
        name="Test MIDI File",
        file_path="path/to/midi_file.mid",
        user_id=uuid.uuid4(),
    )


@pytest.fixture
def sample_audio_file():
    return AudioFile(
        id=uuid.uuid4(),
        name="Test Audio File",
        file_path="path/to/audio_file.wav",
        user_id=uuid.uuid4(),
    )


@pytest.fixture
def sample_instrument_file():
    return InstrumentFile(
        id=uuid.uuid4(),
        name="Test Instrument File",
        file_path="path/to/instrument.sf2",
        user_id=uuid.uuid4(),
    )
