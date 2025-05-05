"""
Tests for the ProjectRepository class
"""

import pytest

from app2.models.project_track import ProjectTrack
from app2.repositories.project_repository import ProjectRepository
from app2.core.exceptions import DatabaseException, NotFoundException


class TestProjectRepository:
    """Test suite for ProjectRepository"""

    @pytest.fixture
    def project_repository(self, db_session):
        """Create a ProjectRepository instance for testing"""
        return ProjectRepository(db_session)

    @pytest.fixture
    def sample_project_with_tracks(self, sample_project, sample_track, db_session):
        """Create a sample project with tracks in the database"""
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
            position=0,
        )
        db_session.add(project_track)
        db_session.commit()

        # Refresh sample_project to include the relationship
        db_session.refresh(sample_project)

        return sample_project

    @pytest.mark.asyncio
    async def test_get_by_id(self, project_repository, sample_project, db_session):
        """Test get_by_id when the project exists"""
        # Arrange
        db_session.add(sample_project)
        db_session.commit()

        # Act
        result = await project_repository.get_by_id(sample_project.id)

        # Assert
        assert result.id == sample_project.id
        assert result.name == sample_project.name
        assert result.user_id == sample_project.user_id

    @pytest.mark.asyncio
    async def test_get_by_id_not_found(self, project_repository):
        """Test get_by_id when the project does not exist"""
        # Act & Assert
        with pytest.raises(NotFoundException):
            await project_repository.get_by_id("non-existent-id")

    @pytest.mark.asyncio
    async def test_get_with_tracks(
        self, project_repository, sample_project_with_tracks
    ):
        """Test get_with_tracks"""
        # Act
        result = await project_repository.get_with_tracks(sample_project_with_tracks.id)

        # Assert
        assert result.id == sample_project_with_tracks.id
        assert len(result.tracks) == 1
        assert result.tracks[0].id == sample_project_with_tracks.tracks[0].id

    @pytest.mark.asyncio
    async def test_get_all(self, project_repository, sample_project, db_session):
        """Test get_all"""
        # Arrange
        db_session.add(sample_project)
        db_session.commit()

        # Act
        results = await project_repository.get_all()

        # Assert
        assert len(results) == 1
        assert results[0].id == sample_project.id

    @pytest.mark.asyncio
    async def test_get_all_with_filter(
        self, project_repository, sample_project, db_session
    ):
        """Test get_all with filter"""
        # Arrange
        db_session.add(sample_project)
        db_session.commit()

        # Act
        results = await project_repository.get_all(user_id=sample_project.user_id)

        # Assert
        assert len(results) == 1
        assert results[0].id == sample_project.id

        # Test with non-matching filter
        results = await project_repository.get_all(user_id="non-existent-id")
        assert len(results) == 0

    @pytest.mark.asyncio
    async def test_get_by_user_id(self, project_repository, sample_project, db_session):
        """Test get_by_user_id"""
        # Arrange
        db_session.add(sample_project)
        db_session.commit()

        # Act
        results = await project_repository.get_by_user_id(sample_project.user_id)

        # Assert
        assert len(results) == 1
        assert results[0].id == sample_project.id

        # Test with non-matching user_id
        results = await project_repository.get_by_user_id("non-existent-id")
        assert len(results) == 0

    @pytest.mark.asyncio
    async def test_get_by_user_id_with_tracks(
        self, project_repository, sample_project_with_tracks
    ):
        """Test get_by_user_id_with_tracks"""
        # Act
        results = await project_repository.get_by_user_id_with_tracks(
            sample_project_with_tracks.user_id
        )

        # Assert
        assert len(results) == 1
        assert results[0].id == sample_project_with_tracks.id
        assert len(results[0].tracks) == 1
        assert results[0].tracks[0].id == sample_project_with_tracks.tracks[0].id

    @pytest.mark.asyncio
    async def test_create(self, project_repository):
        """Test create method"""
        # Arrange
        project_data = {
            "name": "New Project",
            "description": "A test project",
            "user_id": "user-test-id",
            "bpm": 120,
            "key": "C",
        }

        # Act
        result = await project_repository.create(project_data)

        # Assert
        assert result.name == "New Project"
        assert result.description == "A test project"
        assert result.user_id == "user-test-id"
        assert result.bpm == 120
        assert result.key == "C"

    @pytest.mark.asyncio
    async def test_create_db_error(self, project_repository):
        """Test create method with database error"""
        # Arrange
        project_data = {"invalid_field": "value"}  # This will cause a validation error

        # Act & Assert
        with pytest.raises(DatabaseException):
            await project_repository.create(project_data)

    @pytest.mark.asyncio
    async def test_update(self, project_repository, sample_project, db_session):
        """Test update method"""
        # Arrange
        db_session.add(sample_project)
        db_session.commit()

        update_data = {
            "name": "Updated Project",
            "description": "Updated description",
            "bpm": 140,
        }

        # Act
        result = await project_repository.update(sample_project.id, update_data)

        # Assert
        assert result.id == sample_project.id
        assert result.name == "Updated Project"
        assert result.description == "Updated description"
        assert result.bpm == 140
        assert result.key == sample_project.key  # Unchanged field

    @pytest.mark.asyncio
    async def test_update_not_found(self, project_repository):
        """Test update method with non-existent project"""
        # Act & Assert
        with pytest.raises(NotFoundException):
            await project_repository.update("non-existent-id", {"name": "Updated"})

    @pytest.mark.asyncio
    async def test_delete(self, project_repository, sample_project, db_session):
        """Test delete method"""
        # Arrange
        db_session.add(sample_project)
        db_session.commit()

        # Act
        result = await project_repository.delete(sample_project.id)

        # Assert
        assert result is True

        # Verify the project is deleted
        with pytest.raises(NotFoundException):
            await project_repository.get_by_id(sample_project.id)

    @pytest.mark.asyncio
    async def test_delete_not_found(self, project_repository):
        """Test delete method with non-existent project"""
        # Act & Assert
        with pytest.raises(NotFoundException):
            await project_repository.delete("non-existent-id")
