"""
Tests for the BaseRepository class
"""
import pytest
import asyncio
import uuid
from typing import Dict, Any
from unittest.mock import MagicMock, patch
from sqlmodel import Session, select

from app2.models.user import User
from app2.repositories.base_repository import BaseRepository
from app2.core.exceptions import DatabaseException, NotFoundException


class TestBaseRepository:
    """Test suite for BaseRepository"""

    @pytest.fixture
    def base_repository(self, db_session):
        """Create a BaseRepository instance for testing"""
        return BaseRepository(User, db_session)

    @pytest.mark.asyncio
    async def test_find_all_empty(self, base_repository):
        """Test find_all when no records exist"""
        # Act
        results = await base_repository.find_all()
        
        # Assert
        assert isinstance(results, list)
        assert len(results) == 0

    @pytest.mark.asyncio
    async def test_find_all_with_records(self, base_repository, sample_user, db_session):
        """Test find_all when records exist"""
        # Arrange
        db_session.add(sample_user)
        db_session.commit()
        
        # Act
        results = await base_repository.find_all()
        
        # Assert
        assert isinstance(results, list)
        assert len(results) == 1
        assert results[0].id == sample_user.id
        assert results[0].email == sample_user.email

    @pytest.mark.asyncio
    async def test_find_by_id_found(self, base_repository, sample_user, db_session):
        """Test find_by_id when the record exists"""
        # Arrange
        db_session.add(sample_user)
        db_session.commit()
        
        # Act - pass UUID directly
        result = await base_repository.find_by_id(sample_user.id)
        
        # Assert
        assert result.id == sample_user.id
        assert result.email == sample_user.email

    @pytest.mark.asyncio
    async def test_find_by_id_not_found(self, base_repository):
        """Test find_by_id when the record does not exist"""
        # Act & Assert - pass UUID directly
        with pytest.raises(NotFoundException):
            await base_repository.find_by_id(uuid.uuid4())

    @pytest.mark.asyncio
    async def test_find_by_user(self, base_repository, sample_user, db_session):
        """Test find_by_user"""
        # Arrange
        db_session.add(sample_user)
        db_session.commit()
        
        # Act - pass UUID directly
        results = await base_repository.find_by_user(sample_user.id)
        
        # Assert - should be empty since User model doesn't have a user_id field
        assert isinstance(results, list)
        assert len(results) == 0

    @pytest.mark.asyncio
    async def test_create(self, base_repository):
        """Test create method"""
        # Arrange
        test_id = uuid.uuid4()
        user_data = {
            "id": test_id,
            "email": "new@example.com",
            "name": "New User"
        }
        
        # Act
        result = await base_repository.create(user_data)
        
        # Assert
        assert result.id == test_id
        assert result.email == "new@example.com"
        assert result.name == "New User"

    @pytest.mark.asyncio
    async def test_create_db_error(self, base_repository, db_session):
        """Test create method with database error"""
        # Arrange
        user_data = {
            "invalid_field": "value"  # This will cause a validation error
        }
        
        # Act & Assert
        with pytest.raises(DatabaseException):
            await base_repository.create(user_data)

    @pytest.mark.asyncio
    async def test_update(self, base_repository, sample_user, db_session):
        """Test update method"""
        # Arrange
        db_session.add(sample_user)
        db_session.commit()
        
        update_data = {
            "name": "Updated Name",
            "email": "updated@example.com"
        }
        
        # Act - pass UUID directly
        result = await base_repository.update(sample_user.id, update_data)
        
        # Assert
        assert result.id == sample_user.id
        assert result.name == "Updated Name"
        assert result.email == "updated@example.com"

    @pytest.mark.asyncio
    async def test_update_not_found(self, base_repository):
        """Test update method with non-existent record"""
        # Arrange
        update_data = {
            "name": "Updated Name"
        }
        
        # Act & Assert - pass UUID directly
        with pytest.raises(NotFoundException):
            await base_repository.update(uuid.uuid4(), update_data)

    @pytest.mark.asyncio
    async def test_delete(self, base_repository, sample_user, db_session):
        """Test delete method"""
        # Arrange
        db_session.add(sample_user)
        db_session.commit()
        
        # Act - pass UUID directly
        result = await base_repository.delete(sample_user.id)
        
        # Assert
        assert result is True
        
        # Verify the record is deleted
        with pytest.raises(NotFoundException):
            await base_repository.find_by_id(sample_user.id)

    @pytest.mark.asyncio
    async def test_delete_not_found(self, base_repository):
        """Test delete method with non-existent record"""
        # Act & Assert - pass UUID directly
        with pytest.raises(NotFoundException):
            await base_repository.delete(uuid.uuid4())