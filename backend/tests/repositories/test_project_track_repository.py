"""
Tests for the ProjectTrackRepository class
"""
import pytest
import uuid
from sqlmodel import Session

from app2.models.project_track import ProjectTrack
from app2.repositories.project_track_repository import ProjectTrackRepository
from app2.core.exceptions import DatabaseException, NotFoundException


class TestProjectTrackRepository:
    """Test suite for ProjectTrackRepository"""

    @pytest.fixture
    def project_track_repository(self, db_session):
        """Create a ProjectTrackRepository instance for testing"""
        return ProjectTrackRepository(db_session)

    @pytest.fixture
    def sample_project_track(self, sample_project, sample_track, db_session):
        """Create a sample project-track association in the database"""
        # Add project and track
        db_session.add(sample_project)
        db_session.add(sample_track)
        db_session.commit()
        
        # Create project_track association
        project_track = ProjectTrack(
            project_id=sample_project.id,
            track_id=sample_track.id,
            volume=0.8,
            pan=0,
            position=0
        )
        db_session.add(project_track)
        db_session.commit()
        db_session.refresh(project_track)
        
        return project_track

    @pytest.mark.asyncio
    async def test_get_by_ids(self, project_track_repository, sample_project_track):
        """Test get_by_ids when the association exists"""
        # Act
        result = await project_track_repository.get_by_ids(
            sample_project_track.project_id,
            sample_project_track.track_id
        )
        
        # Assert
        assert result is not None
        assert result.project_id == sample_project_track.project_id
        assert result.track_id == sample_project_track.track_id
        assert result.volume == sample_project_track.volume

    @pytest.mark.asyncio
    async def test_get_by_ids_not_found(self, project_track_repository):
        """Test get_by_ids when the association does not exist"""
        # Act
        result = await project_track_repository.get_by_ids(
            "non-existent-project-id",
            "non-existent-track-id"
        )
        
        # Assert
        assert result is None

    @pytest.mark.asyncio
    async def test_get_by_project_id(self, project_track_repository, sample_project_track):
        """Test get_by_project_id"""
        # Act
        results = await project_track_repository.get_by_project_id(sample_project_track.project_id)
        
        # Assert
        assert len(results) == 1
        assert results[0].project_id == sample_project_track.project_id
        assert results[0].track_id == sample_project_track.track_id
        
        # Test with non-matching project_id
        results = await project_track_repository.get_by_project_id("non-existent-id")
        assert len(results) == 0

    @pytest.mark.asyncio
    async def test_get_by_track_id(self, project_track_repository, sample_project_track):
        """Test get_by_track_id"""
        # Act
        results = await project_track_repository.get_by_track_id(sample_project_track.track_id)
        
        # Assert
        assert len(results) == 1
        assert results[0].project_id == sample_project_track.project_id
        assert results[0].track_id == sample_project_track.track_id
        
        # Test with non-matching track_id
        results = await project_track_repository.get_by_track_id("non-existent-id")
        assert len(results) == 0

    @pytest.mark.asyncio
    async def test_create(self, project_track_repository, sample_project, sample_track, db_session):
        """Test create method"""
        # Arrange
        db_session.add(sample_project)
        db_session.add(sample_track)
        db_session.commit()
        
        project_track_data = {
            "project_id": sample_project.id,
            "track_id": sample_track.id,
            "volume": 0.7,
            "pan": 0.5,
            "position": 100
        }
        
        # Act
        result = await project_track_repository.create(project_track_data)
        
        # Assert
        assert result.project_id == sample_project.id
        assert result.track_id == sample_track.id
        assert result.volume == 0.7
        assert result.pan == 0.5
        assert result.position == 100

    @pytest.mark.asyncio
    async def test_create_missing_required_fields(self, project_track_repository):
        """Test create method with missing required fields"""
        # Arrange
        project_track_data = {
            "volume": 0.7  # Missing required project_id and track_id
        }
        
        # Act & Assert
        with pytest.raises(DatabaseException):
            await project_track_repository.create(project_track_data)

    @pytest.mark.asyncio
    async def test_update(self, project_track_repository, sample_project_track):
        """Test update method"""
        # Arrange
        update_data = {
            "volume": 0.5,
            "pan": -0.3,
            "position": 200
        }
        
        # Act
        result = await project_track_repository.update(
            sample_project_track.project_id,
            sample_project_track.track_id,
            update_data
        )
        
        # Assert
        assert result.project_id == sample_project_track.project_id  # Unchanged
        assert result.track_id == sample_project_track.track_id  # Unchanged
        assert result.volume == 0.5  # Updated
        assert result.pan == -0.3  # Updated
        assert result.position == 200  # Updated

    @pytest.mark.asyncio
    async def test_update_not_found(self, project_track_repository):
        """Test update method with non-existent association"""
        # Act & Assert
        with pytest.raises(NotFoundException):
            await project_track_repository.update(
                "non-existent-project-id",
                "non-existent-track-id",
                {"volume": 0.5}
            )

    @pytest.mark.asyncio
    async def test_delete(self, project_track_repository, sample_project_track):
        """Test delete method"""
        # Act
        result = await project_track_repository.delete(
            sample_project_track.project_id,
            sample_project_track.track_id
        )
        
        # Assert
        assert result is True
        
        # Verify the association is deleted
        result = await project_track_repository.get_by_ids(
            sample_project_track.project_id,
            sample_project_track.track_id
        )
        assert result is None

    @pytest.mark.asyncio
    async def test_delete_not_found(self, project_track_repository):
        """Test delete method with non-existent association"""
        # Act
        result = await project_track_repository.delete(
            "non-existent-project-id",
            "non-existent-track-id"
        )
        
        # Assert
        assert result is False

    @pytest.mark.asyncio
    async def test_delete_by_project_id(self, project_track_repository, sample_project_track):
        """Test delete_by_project_id"""
        # Act
        count = await project_track_repository.delete_by_project_id(sample_project_track.project_id)
        
        # Assert
        assert count == 1
        
        # Verify the associations are deleted
        results = await project_track_repository.get_by_project_id(sample_project_track.project_id)
        assert len(results) == 0

    @pytest.mark.asyncio
    async def test_delete_by_track_id(self, project_track_repository, sample_project_track):
        """Test delete_by_track_id"""
        # Act
        count = await project_track_repository.delete_by_track_id(sample_project_track.track_id)
        
        # Assert
        assert count == 1
        
        # Verify the associations are deleted
        results = await project_track_repository.get_by_track_id(sample_project_track.track_id)
        assert len(results) == 0