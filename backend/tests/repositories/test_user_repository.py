"""
Tests for the UserRepository class
"""

import pytest
import uuid

from app2.repositories.user_repository import UserRepository
from app2.core.exceptions import NotFoundException


class TestUserRepository:
    """Test suite for UserRepository"""

    @pytest.fixture
    def user_repository(self, db_session):
        """Create a UserRepository instance for testing"""
        return UserRepository(db_session)

    @pytest.mark.asyncio
    async def test_get_profile(self, user_repository, sample_user, db_session):
        """Test get_profile when the profile exists"""
        # Arrange
        db_session.add(sample_user)
        db_session.commit()

        # Act
        result = await user_repository.get_profile(sample_user.id)

        # Assert
        assert result.id == sample_user.id
        assert result.email == sample_user.email
        assert result.name == sample_user.name

    @pytest.mark.asyncio
    async def test_get_profile_not_found(self, user_repository):
        """Test get_profile when the profile does not exist"""
        # Act & Assert
        with pytest.raises(NotFoundException):
            await user_repository.get_profile("non-existent-id")

    @pytest.mark.asyncio
    async def test_update_profile(self, user_repository, sample_user, db_session):
        """Test update_profile"""
        # Arrange
        db_session.add(sample_user)
        db_session.commit()

        profile_data = {
            "name": "Updated User",
            "profile_picture_url": "https://example.com/updated.jpg",
        }

        # Act
        result = await user_repository.update_profile(sample_user.id, profile_data)

        # Assert
        assert result.id == sample_user.id
        assert result.name == "Updated User"
        assert result.profile_picture_url == "https://example.com/updated.jpg"
        assert result.email == sample_user.email  # Unchanged field

    @pytest.mark.asyncio
    async def test_update_profile_not_found(self, user_repository):
        """Test update_profile when the profile does not exist"""
        # Act & Assert
        with pytest.raises(NotFoundException):
            await user_repository.update_profile("non-existent-id", {"name": "Updated"})

    @pytest.mark.asyncio
    async def test_create_profile(self, user_repository):
        """Test create_profile"""
        # Arrange
        user_id = str(uuid.uuid4())
        email = "new@example.com"
        username = "newuser"
        display_name = "New User"

        # Act
        result = await user_repository.create_profile(
            user_id, email, username, display_name
        )

        # Assert
        assert result.id == user_id
        assert result.email == email
        assert result.username == username
        assert result.display_name == display_name

    @pytest.mark.asyncio
    async def test_create_profile_existing(
        self, user_repository, sample_user, db_session
    ):
        """Test create_profile when the profile already exists"""
        # Arrange
        db_session.add(sample_user)
        db_session.commit()

        # Act
        result = await user_repository.create_profile(
            sample_user.id,
            "new@example.com",  # Different from sample_user.email
            "newusername",
            "New Name",
        )

        # Assert - should return existing profile without changes
        assert result.id == sample_user.id
        assert result.email == sample_user.email  # Not updated
        assert result.name == sample_user.name  # Not updated

    @pytest.mark.asyncio
    async def test_find_by_email_found(self, user_repository, sample_user, db_session):
        """Test find_by_email when the user exists"""
        # Arrange
        db_session.add(sample_user)
        db_session.commit()

        # Act
        result = await user_repository.find_by_email(sample_user.email)

        # Assert
        assert result is not None
        assert result.id == sample_user.id
        assert result.email == sample_user.email

    @pytest.mark.asyncio
    async def test_find_by_email_not_found(self, user_repository):
        """Test find_by_email when the user does not exist"""
        # Act
        result = await user_repository.find_by_email("nonexistent@example.com")

        # Assert
        assert result is None
