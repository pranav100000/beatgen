"""
User repository for database operations using SQLModel
"""

from typing import Dict, Any, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select
import traceback
import uuid

from app2.models.user import User
from app2.core.exceptions import DatabaseException, NotFoundException
from .base_repository import BaseRepository


class UserRepository(BaseRepository[User]):
    """Repository for user operations"""

    def __init__(self, session: AsyncSession):
        """
        Initialize the repository with User model class and session

        Args:
            session: The AsyncSQLModel session for database operations
        """
        super().__init__(User, session)

    async def get_profile(self, user_id: uuid.UUID) -> User:
        """
        Get a user's profile

        Args:
            user_id: The ID of the user

        Returns:
            The user profile as User object

        Raises:
            NotFoundException: If the profile is not found
            DatabaseException: If the operation fails
        """
        self.logger.info(f"Getting profile for user {user_id}")
        try:
            result = await self.find_by_id(str(user_id))
            self.logger.info(f"Found profile for user {user_id}")
            return result
        except Exception as e:
            if isinstance(e, NotFoundException):
                raise
            self.logger.error(f"Error getting user profile: {str(e)}")
            self.logger.error(traceback.format_exc())
            raise DatabaseException(f"Failed to get user profile: {str(e)}")

    async def update_profile(
        self, user_id: uuid.UUID, profile_data: Dict[str, Any]
    ) -> User:
        """
        Update a user's profile

        Args:
            user_id: The ID of the user
            profile_data: The updated profile data

        Returns:
            The updated profile as User object

        Raises:
            NotFoundException: If the profile is not found
            DatabaseException: If the operation fails
        """
        self.logger.info(f"Updating profile for user {user_id}")
        try:
            result = await self.update(str(user_id), profile_data)
            self.logger.info(f"Updated profile for user {user_id}")
            return result
        except Exception as e:
            if isinstance(e, NotFoundException):
                raise
            self.logger.error(f"Error updating user profile: {str(e)}")
            self.logger.error(traceback.format_exc())
            raise DatabaseException(f"Failed to update user profile: {str(e)}")

    async def create_profile(
        self,
        user_id: uuid.UUID,
        email: str,
        username: Optional[str] = None,
        display_name: Optional[str] = None,
    ) -> User:
        """
        Create a new user profile using the Supabase Auth ID as the primary key.
        If a profile with this ID already exists, return it.

        Args:
            user_id: The Supabase Auth ID to use as the primary key.
            email: The user's email.
            username: The user's username (optional).
            display_name: The user's display name (optional).

        Returns:
            The created or existing profile as User object.

        Raises:
            DatabaseException: If the operation fails (e.g., email unique constraint violation).
        """
        self.logger.info(
            f"Attempting to create/ensure profile for User ID (PK) {user_id}"
        )

        # Check if a profile already exists with this ID (as primary key)
        try:
            existing_profile = await self.find_by_id(user_id)
            if existing_profile:
                self.logger.info(
                    f"Profile already exists for User ID (PK) {user_id}. Returning existing profile."
                )
                return existing_profile
            # If find_by_id returns None (should raise NotFoundException based on BaseRepo)
        except NotFoundException:
            # This is expected if the profile doesn't exist yet. Proceed to create.
            self.logger.info(
                f"No profile found for User ID (PK) {user_id}. Proceeding with creation."
            )
            pass
        except Exception as find_err:  # Catch other potential errors during find
            self.logger.error(
                f"Error checking for existing profile {user_id}: {find_err}",
                exc_info=True,
            )
            raise DatabaseException(f"Failed to check for existing profile: {find_err}")

        # No profile with this ID found, proceed with creation logic
        profile_data = {
            "id": user_id,  # Set the primary key to the Supabase Auth ID
            "email": email,
            "username": username,
            "display_name": display_name,
            "avatar_url": None,
        }
        profile_data_cleaned = {k: v for k, v in profile_data.items() if v is not None}
        if "id" not in profile_data_cleaned:
            profile_data_cleaned["id"] = user_id
        if "email" not in profile_data_cleaned:
            profile_data_cleaned["email"] = email

        try:
            # Actual creation attempt
            created_profile = await self.create(profile_data_cleaned)
            self.logger.info(
                f"Successfully created profile with PK {created_profile.id}"
            )
            return created_profile
        except Exception as e:
            # Any error here (including unique email violation) is treated as a failure
            self.logger.error(
                f"Database error creating profile for User ID (PK) {user_id}: {str(e)}",
                exc_info=True,
            )
            raise DatabaseException(f"Failed to create profile record: {str(e)}")

    async def find_by_email(self, email: str) -> Optional[User]:
        """
        Find a user by email

        Args:
            email: The email to search for

        Returns:
            The user if found, None otherwise

        Raises:
            DatabaseException: If the query fails
        """
        self.logger.info(f"Finding user with email {email}")
        try:
            statement = select(self.model_class).where(self.model_class.email == email)
            result_proxy = await self.session.execute(statement)
            result = result_proxy.scalars().first()

            if result:
                self.logger.info(f"Found user with email {email}")
            else:
                self.logger.info(f"No user found with email {email}")

            return result
        except Exception as e:
            self.logger.error(f"Error finding user by email: {str(e)}")
            self.logger.error(traceback.format_exc())
            raise DatabaseException(f"Failed to find user by email: {str(e)}")
