"""
Base repository with common database operations using SQLModel
"""

from typing import Generic, TypeVar, Type, List, Dict, Any
from sqlmodel import SQLModel, Session, select
import traceback

from app2.core.logging import get_repository_logger
from app2.core.exceptions import DatabaseException, NotFoundException

# Generic type for entity
T = TypeVar("T", bound=SQLModel)


class BaseRepository(Generic[T]):
    """Base repository with common database operations"""

    def __init__(self, model_class: Type[T], session: Session):
        """
        Initialize the repository with a model class and database session

        Args:
            model_class: The SQLModel class this repository works with
            session: The SQLModel session for database operations
        """
        self.model_class = model_class
        self.session = session
        self.logger = get_repository_logger(model_class.__name__)

    async def find_all(self) -> List[T]:
        """
        Find all records of this model

        Returns:
            A list of model instances

        Raises:
            DatabaseException: If the query fails
        """
        self.logger.info(f"Finding all {self.model_class.__name__} records")
        try:
            statement = select(self.model_class)
            results = self.session.exec(statement).all()
            self.logger.info(
                f"Found {len(results)} {self.model_class.__name__} records"
            )
            return results
        except Exception as e:
            self.logger.error(f"Error finding all records: {str(e)}")
            self.logger.error(traceback.format_exc())
            raise DatabaseException(f"Failed to find records: {str(e)}")

    async def find_by_id(self, id: str) -> T:
        """
        Find a record by ID

        Args:
            id: The ID of the record to find

        Returns:
            The model instance if found

        Raises:
            NotFoundException: If the record is not found
            DatabaseException: If the query fails
        """
        self.logger.info(f"Finding {self.model_class.__name__} with ID {id}")
        try:
            statement = select(self.model_class).where(self.model_class.id == id)
            result = self.session.exec(statement).first()

            if result is None:
                self.logger.error(f"{self.model_class.__name__} with ID {id} not found")
                raise NotFoundException(self.model_class.__name__, id)

            self.logger.info(f"Found {self.model_class.__name__} with ID {id}")
            return result
        except Exception as e:
            if isinstance(e, NotFoundException):
                raise
            self.logger.error(f"Error finding record by ID: {str(e)}")
            self.logger.error(traceback.format_exc())
            raise DatabaseException(f"Failed to find record: {str(e)}")

    async def find_by_user(self, user_id: str) -> List[T]:
        """
        Find all records for a user

        Args:
            user_id: The ID of the user

        Returns:
            A list of model instances

        Raises:
            DatabaseException: If the query fails
        """
        self.logger.info(
            f"Finding {self.model_class.__name__} records for user {user_id}"
        )
        try:
            statement = select(self.model_class).where(
                self.model_class.user_id == user_id
            )
            results = self.session.exec(statement).all()
            self.logger.info(
                f"Found {len(results)} {self.model_class.__name__} records for user {user_id}"
            )
            return results
        except Exception as e:
            self.logger.error(f"Error finding records by user: {str(e)}")
            self.logger.error(traceback.format_exc())
            raise DatabaseException(f"Failed to find records for user: {str(e)}")

    async def create(self, data: Dict[str, Any]) -> T:
        """
        Create a new record

        Args:
            data: The data for the new record

        Returns:
            The created model instance

        Raises:
            DatabaseException: If the operation fails
        """
        self.logger.info(f"Creating new {self.model_class.__name__}")
        try:
            # Create model instance from data
            model_instance = self.model_class(**data)

            # Add to session
            self.session.add(model_instance)
            self.session.commit()
            self.session.refresh(model_instance)

            self.logger.info(
                f"Created {self.model_class.__name__} with ID {model_instance.id}"
            )
            return model_instance
        except Exception as e:
            self.session.rollback()
            self.logger.error(f"Error creating record: {str(e)}")
            self.logger.error(traceback.format_exc())
            raise DatabaseException(f"Failed to create record: {str(e)}")

    async def update(self, id: str, data: Dict[str, Any]) -> T:
        """
        Update a record

        Args:
            id: The ID of the record to update
            data: The updated data

        Returns:
            The updated model instance

        Raises:
            NotFoundException: If the record is not found
            DatabaseException: If the operation fails
        """
        self.logger.info(f"Updating {self.model_class.__name__} with ID {id}")
        try:
            # First get the existing record
            model_instance = await self.find_by_id(id)

            # Update fields
            for key, value in data.items():
                if hasattr(model_instance, key):
                    setattr(model_instance, key, value)

            # Commit changes
            self.session.add(model_instance)
            self.session.commit()
            self.session.refresh(model_instance)

            self.logger.info(f"Updated {self.model_class.__name__} with ID {id}")
            return model_instance
        except Exception as e:
            self.session.rollback()
            if isinstance(e, NotFoundException):
                raise
            self.logger.error(f"Error updating record: {str(e)}")
            self.logger.error(traceback.format_exc())
            raise DatabaseException(f"Failed to update record: {str(e)}")

    async def delete(self, id: str) -> bool:
        """
        Delete a record

        Args:
            id: The ID of the record to delete

        Returns:
            True if the operation was successful

        Raises:
            NotFoundException: If the record is not found
            DatabaseException: If the operation fails
        """
        self.logger.info(f"Deleting {self.model_class.__name__} with ID {id}")
        try:
            # First get the existing record
            model_instance = await self.find_by_id(id)

            # Delete the record
            self.session.delete(model_instance)
            self.session.commit()

            self.logger.info(f"Deleted {self.model_class.__name__} with ID {id}")
            return True
        except Exception as e:
            self.session.rollback()
            if isinstance(e, NotFoundException):
                raise
            self.logger.error(f"Error deleting record: {str(e)}")
            self.logger.error(traceback.format_exc())
            raise DatabaseException(f"Failed to delete record: {str(e)}")
