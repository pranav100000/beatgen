"""
Unified File Repository for database operations using SQLModel
Handles all file types (audio, MIDI, instrument) consistently
"""

from typing import Dict, Any, List, Optional, Type
from sqlmodel import Session, select
import traceback
import uuid

from app2.core.exceptions import DatabaseException, NotFoundException, StorageException
from app2.core.logging import get_repository_logger
from app2.infrastructure.storage.supabase_storage import SupabaseStorage
from app2.models.public_models.drum_samples import DrumSamplePublic


class DrumSamplePublicRepository:
    """Repository for operations on DrumSamplePublic model"""

    def __init__(self, session: Session):
        """
        Initialize the repository with database session

        Args:
            session: The SQLModel session for database operations
        """
        self.session = session
        self.logger = get_repository_logger("drum_sample_public")

        self.bucket = "assets"
        self.folder = "drum_samples_public"

        # Hardcode the model class
        self._file_model: Type[DrumSamplePublic] = DrumSamplePublic

    def _get_storage_client(self) -> SupabaseStorage:
        """Get the storage client for drum samples"""
        # Bucket is fixed for this repository
        return SupabaseStorage(self.bucket)

    async def get_by_id(self, file_id: uuid.UUID) -> DrumSamplePublic:
        """
        Get a drum sample by ID

        Args:
            file_id: The ID of the drum sample

        Returns:
            The DrumSamplePublic model if found

        Raises:
            NotFoundException: If the drum sample is not found
            DatabaseException: If there's a database error
        """
        self.logger.info(f"Getting Drum Sample with ID {file_id}")
        try:
            # Use the hardcoded model class directly
            statement = select(self._file_model).where(self._file_model.id == file_id)
            result = self.session.exec(statement).first()

            if result is None:
                self.logger.error(f"Drum Sample with ID {file_id} not found")
                raise NotFoundException("Drum Sample", file_id)

            self.logger.info(f"Found Drum Sample with ID {file_id}")
            return result
        except Exception as e:
            if isinstance(e, NotFoundException):
                raise
            self.logger.error(f"Error getting Drum Sample by ID: {str(e)}")
            self.logger.error(traceback.format_exc())
            raise DatabaseException(f"Failed to get Drum Sample: {str(e)}")

    async def get_all(self, **filters) -> List[DrumSamplePublic]:
        """
        Get all drum samples with optional filters

        Args:
            **filters: Optional filter criteria (e.g., is_public=True)

        Returns:
            List of DrumSamplePublic models matching the criteria

        Raises:
            DatabaseException: If there's a database error
        """
        filter_str = ", ".join(f"{k}={v}" for k, v in filters.items())
        self.logger.info(f"Getting all Drum Samples with filters: {filter_str}")
        try:
            # Use the hardcoded model class directly
            model_class = self._file_model

            # Build query with filters
            query = select(model_class)
            for key, value in filters.items():
                if hasattr(model_class, key):
                    query = query.where(getattr(model_class, key) == value)

            # Execute query
            results = self.session.exec(query).all()

            self.logger.info(f"Found {len(results)} Drum Samples")
            return results
        except Exception as e:
            self.logger.error(f"Error getting Drum Samples: {str(e)}")
            self.logger.error(traceback.format_exc())
            raise DatabaseException(f"Failed to get Drum Samples: {str(e)}")

    async def create(self, file_data: Dict[str, Any]) -> DrumSamplePublic:
        """
        Create a new drum sample record

        Args:
            file_data: The data for the new drum sample

        Returns:
            The created DrumSamplePublic model

        Raises:
            DatabaseException: If there's a database error
        """
        self.logger.info("Creating new Drum Sample")
        try:
            # Use the hardcoded model class directly
            model_class = self._file_model

            # Create model instance
            file_instance = model_class(**file_data)

            # Add to session
            self.session.add(file_instance)
            self.session.commit()
            self.session.refresh(file_instance)

            self.logger.info(f"Created Drum Sample with ID {file_instance.id}")
            return file_instance
        except Exception as e:
            self.session.rollback()
            self.logger.error(f"Error creating Drum Sample: {str(e)}")
            self.logger.error(traceback.format_exc())
            raise DatabaseException(f"Failed to create Drum Sample: {str(e)}")

    async def update(
        self, file_id: uuid.UUID, file_data: Dict[str, Any]
    ) -> DrumSamplePublic:
        """
        Update an existing drum sample record

        Args:
            file_id: The ID of the drum sample to update
            file_data: The updated data

        Returns:
            The updated DrumSamplePublic model

        Raises:
            NotFoundException: If the drum sample is not found
            DatabaseException: If there's a database error
        """
        self.logger.info(f"Updating Drum Sample with ID {file_id}")
        try:
            # First check if file exists - call the simplified get_by_id
            file_instance = await self.get_by_id(file_id)

            # Update fields
            for key, value in file_data.items():
                if hasattr(file_instance, key):
                    setattr(file_instance, key, value)

            # Commit changes
            self.session.add(file_instance)
            self.session.commit()
            self.session.refresh(file_instance)

            self.logger.info(f"Updated Drum Sample with ID {file_id}")
            return file_instance
        except Exception as e:
            self.session.rollback()
            if isinstance(e, NotFoundException):
                raise
            self.logger.error(f"Error updating Drum Sample: {str(e)}")
            self.logger.error(traceback.format_exc())
            raise DatabaseException(f"Failed to update Drum Sample: {str(e)}")

    async def delete(self, file_id: uuid.UUID) -> bool:
        """
        Delete a drum sample record

        Args:
            file_id: The ID of the drum sample to delete

        Returns:
            True if the drum sample was deleted successfully

        Raises:
            NotFoundException: If the drum sample is not found
            DatabaseException: If there's a database error
        """
        self.logger.info(f"Deleting Drum Sample with ID {file_id}")
        try:
            # First check if file exists - call the simplified get_by_id
            file_instance = await self.get_by_id(file_id)

            # Delete from database
            self.session.delete(file_instance)
            self.session.commit()

            self.logger.info(f"Deleted Drum Sample with ID {file_id}")
            return True
        except Exception as e:
            self.session.rollback()
            if isinstance(e, NotFoundException):
                raise
            self.logger.error(f"Error deleting Drum Sample: {str(e)}")
            self.logger.error(traceback.format_exc())
            raise DatabaseException(f"Failed to delete Drum Sample: {str(e)}")

    async def find_by_name(self, name: str) -> Optional[DrumSamplePublic]:
        """
        Find a drum sample by name

        Args:
            name: The name to search for

        Returns:
            The DrumSamplePublic model if found, None otherwise

        Raises:
            DatabaseException: If there's a database error
        """
        self.logger.info(f"Finding Drum Sample with name: {name}")
        try:
            # Call the simplified get_all
            results = await self.get_all(name=name)

            if results:
                self.logger.info(f"Found Drum Sample with name: {name}")
                return results[0]
            else:
                self.logger.info(f"No Drum Sample found with name: {name}")
                return None
        except Exception as e:
            self.logger.error(f"Error finding Drum Sample by name: {str(e)}")
            self.logger.error(traceback.format_exc())
            raise DatabaseException(f"Failed to find Drum Sample by name: {str(e)}")

    async def create_upload_url(
        self, file_name: str, file_id: uuid.UUID
    ) -> Dict[str, str]:
        """
        Create a signed upload URL for a drum sample file

        Args:
            file_name: The name of the file
            file_id: The ID of the file record

        Returns:
            Dict containing upload URL and storage path

        Raises:
            StorageException: If there's an error creating the upload URL
        """
        self.logger.info(f"Creating upload URL for Drum Sample: {file_name}")
        try:
            # Get storage client - simplified call
            storage = self._get_storage_client()

            # Create storage path using self.folder
            file_extension = file_name.split(".")[-1] if "." in file_name else ""
            # Path structure: assets/drum_samples_public/<file_id>.<ext>
            storage_key = f"{self.folder}/{file_id}.{file_extension}"

            # Create upload URL
            result = storage.create_signed_upload_url(storage_key)

            # Add file ID to result
            result["id"] = str(file_id)

            self.logger.info(
                f"Created upload URL for Drum Sample: {file_name} at path {storage_key}"
            )
            return result
        except Exception as e:
            self.logger.error(f"Error creating upload URL: {str(e)}")
            self.logger.error(traceback.format_exc())
            raise StorageException(f"Failed to create upload URL: {str(e)}")
