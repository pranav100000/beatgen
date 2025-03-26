from typing import Dict, Any, List, Optional, Callable, TypeVar, Generic
from uuid import UUID
import traceback

from app2.core.logging import get_repository_logger
from app2.core.exceptions import DatabaseException, NotFoundException
from app2.infrastructure.database.supabase_client import supabase

T = TypeVar('T')  # Generic type for entity

class BaseRepository:
    """Base repository with common database operations"""
    
    def __init__(self, table_name: str):
        """
        Initialize the repository with a table name
        
        Args:
            table_name: The name of the database table
        """
        self.table_name = table_name
        self.logger = get_repository_logger(table_name)
        
    async def find_all(self) -> List[Dict[str, Any]]:
        """
        Find all records in the table
        
        Returns:
            A list of records
            
        Raises:
            DatabaseException: If the query fails
        """
        self.logger.info(f"Finding all records in {self.table_name}")
        try:
            result = supabase.execute_query(
                self.table_name,
                lambda table: table.select("*")
            )
            self.logger.info(f"Found {len(result)} records in {self.table_name}")
            return result or []
        except Exception as e:
            self.logger.error(f"Error finding all records: {str(e)}")
            self.logger.error(traceback.format_exc())
            raise DatabaseException(f"Failed to find records in {self.table_name}: {str(e)}")
            
    async def find_by_id(self, id: str) -> Dict[str, Any]:
        """
        Find a record by ID
        
        Args:
            id: The ID of the record to find
            
        Returns:
            The record if found
            
        Raises:
            NotFoundException: If the record is not found
            DatabaseException: If the query fails
        """
        self.logger.info(f"Finding record with ID {id} in {self.table_name}")
        try:
            result = supabase.execute_query(
                self.table_name,
                lambda table: table.select("*").eq("id", str(id)).single()
            )
            
            if not result:
                self.logger.error(f"Record with ID {id} not found in {self.table_name}")
                raise NotFoundException(self.table_name, id)
                
            self.logger.info(f"Found record with ID {id} in {self.table_name}")
            return result
        except Exception as e:
            if isinstance(e, NotFoundException):
                raise
            self.logger.error(f"Error finding record by ID: {str(e)}")
            self.logger.error(traceback.format_exc())
            raise DatabaseException(f"Failed to find record in {self.table_name}: {str(e)}")
            
    async def find_by_user(self, user_id: str) -> List[Dict[str, Any]]:
        """
        Find all records for a user
        
        Args:
            user_id: The ID of the user
            
        Returns:
            A list of records
            
        Raises:
            DatabaseException: If the query fails
        """
        self.logger.info(f"Finding records for user {user_id} in {self.table_name}")
        try:
            result = supabase.execute_query(
                self.table_name,
                lambda table: table.select("*").eq("user_id", str(user_id))
            )
            self.logger.info(f"Found {len(result)} records for user {user_id} in {self.table_name}")
            return result or []
        except Exception as e:
            self.logger.error(f"Error finding records by user: {str(e)}")
            self.logger.error(traceback.format_exc())
            raise DatabaseException(f"Failed to find records for user in {self.table_name}: {str(e)}")
            
    async def create(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Create a new record
        
        Args:
            data: The data for the new record
            
        Returns:
            The created record
            
        Raises:
            DatabaseException: If the operation fails
        """
        self.logger.info(f"Creating new record in {self.table_name}")
        try:
            result = supabase.execute_query(
                self.table_name,
                lambda table: table.insert(data)
            )
            
            if not result or len(result) == 0:
                self.logger.error("No data returned from record creation")
                raise DatabaseException(f"Record created in {self.table_name} but no data was returned")
                
            self.logger.info(f"Created record with ID {result[0].get('id', 'unknown')} in {self.table_name}")
            return result[0]
        except Exception as e:
            self.logger.error(f"Error creating record: {str(e)}")
            self.logger.error(traceback.format_exc())
            raise DatabaseException(f"Failed to create record in {self.table_name}: {str(e)}")
            
    async def update(self, id: str, data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Update a record
        
        Args:
            id: The ID of the record to update
            data: The updated data
            
        Returns:
            The updated record
            
        Raises:
            NotFoundException: If the record is not found
            DatabaseException: If the operation fails
        """
        self.logger.info(f"Updating record with ID {id} in {self.table_name}")
        try:
            # First check if record exists
            await self.find_by_id(id)
            
            result = supabase.execute_query(
                self.table_name,
                lambda table: table.update(data).eq("id", str(id))
            )
            
            if not result or len(result) == 0:
                self.logger.error("No data returned from record update")
                raise DatabaseException(f"Record updated in {self.table_name} but no data was returned")
                
            self.logger.info(f"Updated record with ID {id} in {self.table_name}")
            return result[0]
        except Exception as e:
            if isinstance(e, NotFoundException):
                raise
            self.logger.error(f"Error updating record: {str(e)}")
            self.logger.error(traceback.format_exc())
            raise DatabaseException(f"Failed to update record in {self.table_name}: {str(e)}")
            
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
        self.logger.info(f"Deleting record with ID {id} from {self.table_name}")
        try:
            # First check if record exists
            await self.find_by_id(id)
            
            result = supabase.execute_query(
                self.table_name,
                lambda table: table.delete().eq("id", str(id))
            )
            
            self.logger.info(f"Deleted record with ID {id} from {self.table_name}")
            return True
        except Exception as e:
            if isinstance(e, NotFoundException):
                raise
            self.logger.error(f"Error deleting record: {str(e)}")
            self.logger.error(traceback.format_exc())
            raise DatabaseException(f"Failed to delete record from {self.table_name}: {str(e)}")