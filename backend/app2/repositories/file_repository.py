"""
Unified File Repository for database operations using SQLModel
Handles all file types (audio, MIDI, instrument) consistently
"""
from typing import Dict, Any, List, Optional, Union, Type, Generic, TypeVar, cast
from sqlmodel import Session, select
from sqlalchemy.orm import joinedload
import traceback
from datetime import datetime
import uuid

from app2.core.exceptions import DatabaseException, NotFoundException, StorageException
from app2.core.logging import get_repository_logger
from app2.types.file_types import FileType
from app2.models.file_models.instrument_file import InstrumentFile
from app2.infrastructure.storage.supabase_storage import SupabaseStorage

# Generic type for file models
FileModel = InstrumentFile

class FileRepository:
    """Repository for operations on all file types (audio, MIDI, instrument)"""
    
    def __init__(self, session: Session):
        """
        Initialize the repository with database session
        
        Args:
            session: The SQLModel session for database operations
        """
        self.session = session
        self.logger = get_repository_logger("file")
        
        # Map file types to their model classes
        self._file_models = {
            FileType.INSTRUMENT: InstrumentFile
        }
        
        # Map file types to storage buckets
        self._storage_buckets = {
            FileType.AUDIO: "tracks/audio",
            FileType.INSTRUMENT: "instruments"
        }
    
    def _get_model_class(self, file_type: FileType) -> Type:
        """Get the model class for a file type"""
        model_class = self._file_models.get(file_type)
        if not model_class:
            raise ValueError(f"Unsupported file type: {file_type}")
        return model_class
    
    def _get_storage_client(self, file_type: FileType) -> SupabaseStorage:
        """Get the storage client for a file type"""
        bucket = self._storage_buckets.get(file_type)
        if not bucket:
            raise ValueError(f"Unsupported file type for storage: {file_type}")
        return SupabaseStorage(bucket)

    async def get_by_id(self, file_id: uuid.UUID, file_type: FileType) -> Any:
        """
        Get a file by ID and type
        
        Args:
            file_id: The ID of the file
            file_type: The type of file
            
        Returns:
            The file model if found
            
        Raises:
            NotFoundException: If the file is not found
            DatabaseException: If there's a database error
        """
        self.logger.info(f"Getting {file_type.value} file with ID {file_id}")
        try:
            model_class = self._get_model_class(file_type)
            
            statement = select(model_class).where(model_class.id == file_id)
            result = self.session.exec(statement).first()
            
            if result is None:
                self.logger.error(f"{file_type.value.capitalize()} file with ID {file_id} not found")
                raise NotFoundException(f"{file_type.value.capitalize()} file", file_id)
                
            self.logger.info(f"Found {file_type.value} file with ID {file_id}")
            return result
        except Exception as e:
            if isinstance(e, NotFoundException):
                raise
            self.logger.error(f"Error getting {file_type.value} file by ID: {str(e)}")
            self.logger.error(traceback.format_exc())
            raise DatabaseException(f"Failed to get {file_type.value} file: {str(e)}")
    
    async def get_all(self, file_type: FileType, **filters) -> List[Any]:
        """
        Get all files of a specific type with optional filters
        
        Args:
            file_type: The type of file
            **filters: Optional filter criteria (e.g., user_id=uuid, is_public=True)
            
        Returns:
            List of file models matching the criteria
            
        Raises:
            DatabaseException: If there's a database error
        """
        filter_str = ", ".join(f"{k}={v}" for k, v in filters.items())
        self.logger.info(f"Getting all {file_type.value} files with filters: {filter_str}")
        try:
            model_class = self._get_model_class(file_type)
            
            # Build query with filters
            query = select(model_class)
            for key, value in filters.items():
                if hasattr(model_class, key):
                    query = query.where(getattr(model_class, key) == value)
            
            # Execute query
            results = self.session.exec(query).all()
            
            self.logger.info(f"Found {len(results)} {file_type.value} files")
            return results
        except Exception as e:
            self.logger.error(f"Error getting {file_type.value} files: {str(e)}")
            self.logger.error(traceback.format_exc())
            raise DatabaseException(f"Failed to get {file_type.value} files: {str(e)}")
    
    async def get_by_user_id(self, user_id: uuid.UUID, file_type: FileType) -> List[Any]:
        """
        Get all files of a specific type for a user
        
        Args:
            user_id: The ID of the user
            file_type: The type of file
            
        Returns:
            List of file models owned by the user
            
        Raises:
            DatabaseException: If there's a database error
        """
        self.logger.info(f"Getting {file_type.value} files for user {user_id}")
        try:
            model_class = self._get_model_class(file_type)
            
            # Check if model has user_id field
            if not hasattr(model_class, "user_id"):
                self.logger.warning(f"{file_type.value.capitalize()} model doesn't have user_id field")
                return []
            
            return await self.get_all(file_type, user_id=user_id)
        except Exception as e:
            self.logger.error(f"Error getting {file_type.value} files for user: {str(e)}")
            self.logger.error(traceback.format_exc())
            raise DatabaseException(f"Failed to get {file_type.value} files for user: {str(e)}")
    
    async def create(self, file_data: Dict[str, Any], file_type: FileType) -> Any:
        """
        Create a new file
        
        Args:
            file_data: The data for the new file
            file_type: The type of file
            
        Returns:
            The created file model
            
        Raises:
            DatabaseException: If there's a database error
        """
        self.logger.info(f"Creating new {file_type.value} file")
        try:
            model_class = self._get_model_class(file_type)
            
            # Create model instance
            file_instance = model_class(**file_data)
            
            # Add to session
            self.session.add(file_instance)
            self.session.commit()
            self.session.refresh(file_instance)
            
            self.logger.info(f"Created {file_type.value} file with ID {file_instance.id}")
            return file_instance
        except Exception as e:
            self.session.rollback()
            self.logger.error(f"Error creating {file_type.value} file: {str(e)}")
            self.logger.error(traceback.format_exc())
            raise DatabaseException(f"Failed to create {file_type.value} file: {str(e)}")
    
    async def update(self, file_id: uuid.UUID, file_data: Dict[str, Any], file_type: FileType) -> Any:
        """
        Update an existing file
        
        Args:
            file_id: The ID of the file to update
            file_data: The updated data
            file_type: The type of file
            
        Returns:
            The updated file model
            
        Raises:
            NotFoundException: If the file is not found
            DatabaseException: If there's a database error
        """
        self.logger.info(f"Updating {file_type.value} file with ID {file_id}")
        try:
            # First check if file exists
            file_instance = await self.get_by_id(file_id, file_type)
            
            # Update fields
            for key, value in file_data.items():
                if hasattr(file_instance, key):
                    setattr(file_instance, key, value)
            
            # Commit changes
            self.session.add(file_instance)
            self.session.commit()
            self.session.refresh(file_instance)
            
            self.logger.info(f"Updated {file_type.value} file with ID {file_id}")
            return file_instance
        except Exception as e:
            self.session.rollback()
            if isinstance(e, NotFoundException):
                raise
            self.logger.error(f"Error updating {file_type.value} file: {str(e)}")
            self.logger.error(traceback.format_exc())
            raise DatabaseException(f"Failed to update {file_type.value} file: {str(e)}")
    
    async def delete(self, file_id: uuid.UUID, file_type: FileType) -> bool:
        """
        Delete a file
        
        Args:
            file_id: The ID of the file to delete
            file_type: The type of file
            
        Returns:
            True if the file was deleted successfully
            
        Raises:
            NotFoundException: If the file is not found
            DatabaseException: If there's a database error
        """
        self.logger.info(f"Deleting {file_type.value} file with ID {file_id}")
        try:
            # First check if file exists
            file_instance = await self.get_by_id(file_id, file_type)
            
            # Delete from database
            self.session.delete(file_instance)
            self.session.commit()
            
            self.logger.info(f"Deleted {file_type.value} file with ID {file_id}")
            return True
        except Exception as e:
            self.session.rollback()
            if isinstance(e, NotFoundException):
                raise
            self.logger.error(f"Error deleting {file_type.value} file: {str(e)}")
            self.logger.error(traceback.format_exc())
            raise DatabaseException(f"Failed to delete {file_type.value} file: {str(e)}")
    
    async def find_by_name(self, name: str, file_type: FileType) -> Optional[Any]:
        """
        Find a file by name
        
        Args:
            name: The name to search for
            file_type: The type of file
            
        Returns:
            The file model if found, None otherwise
            
        Raises:
            DatabaseException: If there's a database error
        """
        self.logger.info(f"Finding {file_type.value} file with name: {name}")
        try:
            results = await self.get_all(file_type, name=name)
            
            if results:
                self.logger.info(f"Found {file_type.value} file with name: {name}")
                return results[0]
            else:
                self.logger.info(f"No {file_type.value} file found with name: {name}")
                return None
        except Exception as e:
            self.logger.error(f"Error finding {file_type.value} file by name: {str(e)}")
            self.logger.error(traceback.format_exc())
            raise DatabaseException(f"Failed to find {file_type.value} file by name: {str(e)}")
    
    async def create_upload_url(self, file_name: str, file_id: uuid.UUID, user_id: uuid.UUID, file_type: FileType) -> Dict[str, str]:
        """
        Create a signed upload URL for a file
        
        Args:
            file_name: The name of the file
            file_id: The ID of the file record
            user_id: The ID of the user
            file_type: The type of file
            
        Returns:
            Dict containing upload URL and storage path
            
        Raises:
            StorageException: If there's an error creating the upload URL
        """
        self.logger.info(f"Creating upload URL for {file_type.value} file: {file_name}")
        try:
            # Get storage client
            storage = self._get_storage_client(file_type)
            
            # Create storage path
            file_extension = file_name.split('.')[-1] if '.' in file_name else ''
            storage_key = f"{file_type.value}/{user_id}/{file_id}.{file_extension}"
            
            # Create upload URL
            result = storage.create_signed_upload_url(storage_key)
            
            # Add file ID to result
            result["id"] = str(file_id)
            
            self.logger.info(f"Created upload URL for {file_type.value} file: {file_name}")
            return result
        except Exception as e:
            self.logger.error(f"Error creating upload URL: {str(e)}")
            self.logger.error(traceback.format_exc())
            raise StorageException(f"Failed to create upload URL: {str(e)}")