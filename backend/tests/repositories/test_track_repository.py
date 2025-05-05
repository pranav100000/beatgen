"""
Tests for the TrackRepository class
"""

import pytest

from app2.models.track import Track
from app2.repositories.track_repository import TrackRepository
from app2.core.exceptions import DatabaseException, NotFoundException
from app2.types.track_types import TrackType
from app2.types.file_types import FileType


class TestTrackRepository:
    """Test suite for TrackRepository"""

    @pytest.fixture
    def track_repository(self, db_session):
        """Create a TrackRepository instance for testing"""
        return TrackRepository(db_session)

    @pytest.fixture
    def audio_track(self, sample_user, sample_audio_file, db_session):
        """Create a sample audio track in the database"""
        # Add user and audio file
        db_session.add(sample_user)
        db_session.add(sample_audio_file)
        db_session.commit()

        # Create track
        track = Track(
            id="audio-track-test-id",
            name="Test Audio Track",
            type=TrackType.AUDIO,
            user_id=sample_user.id,
            audio_file_id=sample_audio_file.id,
        )
        db_session.add(track)
        db_session.commit()
        db_session.refresh(track)

        return track

    @pytest.fixture
    def midi_track(
        self, sample_user, sample_midi_file, sample_instrument_file, db_session
    ):
        """Create a sample MIDI track in the database"""
        # Add user, MIDI file, and instrument file
        db_session.add(sample_user)
        db_session.add(sample_midi_file)
        db_session.add(sample_instrument_file)
        db_session.commit()

        # Create track
        track = Track(
            id="midi-track-test-id",
            name="Test MIDI Track",
            type=TrackType.MIDI,
            user_id=sample_user.id,
            midi_file_id=sample_midi_file.id,
            instrument_id=sample_instrument_file.id,
        )
        db_session.add(track)
        db_session.commit()
        db_session.refresh(track)

        return track

    @pytest.mark.asyncio
    async def test_get_by_id(self, track_repository, audio_track):
        """Test get_by_id when the track exists"""
        # Act
        result = await track_repository.get_by_id(audio_track.id)

        # Assert
        assert result.id == audio_track.id
        assert result.name == audio_track.name
        assert result.type == audio_track.type
        assert result.user_id == audio_track.user_id
        assert result.audio_file_id == audio_track.audio_file_id

    @pytest.mark.asyncio
    async def test_get_by_id_not_found(self, track_repository):
        """Test get_by_id when the track does not exist"""
        # Act & Assert
        with pytest.raises(NotFoundException):
            await track_repository.get_by_id("non-existent-id")

    @pytest.mark.asyncio
    async def test_get_with_files(self, track_repository, audio_track):
        """Test get_with_files"""
        # Act
        result = await track_repository.get_with_files(audio_track.id)

        # Assert
        assert result.id == audio_track.id
        assert result.audio_file_id == audio_track.audio_file_id
        assert result.audio_file is not None  # Audio file relationship should be loaded

    @pytest.mark.asyncio
    async def test_get_all(self, track_repository, audio_track, midi_track):
        """Test get_all"""
        # Act
        results = await track_repository.get_all()

        # Assert
        assert len(results) == 2
        # Check that both tracks are in the results
        track_ids = [track.id for track in results]
        assert audio_track.id in track_ids
        assert midi_track.id in track_ids

    @pytest.mark.asyncio
    async def test_get_all_with_filter(self, track_repository, audio_track, midi_track):
        """Test get_all with filter"""
        # Act
        # Filter by track type
        results = await track_repository.get_all(type=TrackType.AUDIO)

        # Assert
        assert len(results) == 1
        assert results[0].id == audio_track.id
        assert results[0].type == TrackType.AUDIO

        # Test with non-matching filter
        results = await track_repository.get_all(type="non-existent-type")
        assert len(results) == 0

    @pytest.mark.asyncio
    async def test_get_by_user_id(self, track_repository, audio_track, midi_track):
        """Test get_by_user_id"""
        # Act
        results = await track_repository.get_by_user_id(audio_track.user_id)

        # Assert
        assert len(results) == 2  # Both tracks have the same user_id

        # Test with non-matching user_id
        results = await track_repository.get_by_user_id("non-existent-id")
        assert len(results) == 0

    @pytest.mark.asyncio
    async def test_get_by_file_id(self, track_repository, audio_track, midi_track):
        """Test get_by_file_id"""
        # Act
        # Get tracks for audio file
        results = await track_repository.get_by_file_id(
            audio_track.audio_file_id, FileType.AUDIO
        )

        # Assert
        assert len(results) == 1
        assert results[0].id == audio_track.id

        # Test with non-matching file ID
        results = await track_repository.get_by_file_id(
            "non-existent-id", FileType.AUDIO
        )
        assert len(results) == 0

        # Test with invalid file type
        with pytest.raises(ValueError):
            await track_repository.get_by_file_id(
                audio_track.audio_file_id, "invalid-type"
            )

    @pytest.mark.asyncio
    async def test_create(
        self, track_repository, sample_user, sample_audio_file, db_session
    ):
        """Test create method"""
        # Arrange
        db_session.add(sample_user)
        db_session.add(sample_audio_file)
        db_session.commit()

        track_data = {
            "name": "New Audio Track",
            "user_id": sample_user.id,
            "audio_file_id": sample_audio_file.id,
        }

        # Act
        result = await track_repository.create(track_data, FileType.AUDIO)

        # Assert
        assert result.name == "New Audio Track"
        assert result.user_id == sample_user.id
        assert result.audio_file_id == sample_audio_file.id
        assert result.type == TrackType.AUDIO

    @pytest.mark.asyncio
    async def test_create_db_error(self, track_repository):
        """Test create method with database error"""
        # Arrange
        track_data = {"invalid_field": "value"}  # This will cause a validation error

        # Act & Assert
        with pytest.raises(DatabaseException):
            await track_repository.create(track_data, FileType.AUDIO)

    @pytest.mark.asyncio
    async def test_update(self, track_repository, audio_track):
        """Test update method"""
        # Arrange
        update_data = {"name": "Updated Audio Track"}

        # Act
        result = await track_repository.update(audio_track.id, update_data)

        # Assert
        assert result.id == audio_track.id
        assert result.name == "Updated Audio Track"
        assert result.type == audio_track.type  # Unchanged field
        assert result.audio_file_id == audio_track.audio_file_id  # Unchanged field

    @pytest.mark.asyncio
    async def test_update_not_found(self, track_repository):
        """Test update method with non-existent track"""
        # Act & Assert
        with pytest.raises(NotFoundException):
            await track_repository.update("non-existent-id", {"name": "Updated"})

    @pytest.mark.asyncio
    async def test_delete(self, track_repository, audio_track):
        """Test delete method"""
        # Act
        result = await track_repository.delete(audio_track.id)

        # Assert
        assert result is True

        # Verify the track is deleted
        with pytest.raises(NotFoundException):
            await track_repository.get_by_id(audio_track.id)

    @pytest.mark.asyncio
    async def test_delete_not_found(self, track_repository):
        """Test delete method with non-existent track"""
        # Act & Assert
        with pytest.raises(NotFoundException):
            await track_repository.delete("non-existent-id")
