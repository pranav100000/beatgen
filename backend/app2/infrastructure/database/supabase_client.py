from supabase import create_client, Client
from typing import Dict, Any, Callable
import traceback

from app2.core.config import settings
from app2.core.logging import get_logger
from app2.core.exceptions import DatabaseException

logger = get_logger("beatgen.infrastructure.supabase")


class SupabaseClient:
    """Client for Supabase interactions with consistent error handling"""

    _instance = None
    _client = None

    def __new__(cls):
        """Singleton pattern to ensure only one instance exists"""
        if cls._instance is None:
            cls._instance = super(SupabaseClient, cls).__new__(cls)
            cls._initialize_client()
        return cls._instance

    @classmethod
    def _initialize_client(cls):
        """Initialize the Supabase client"""
        try:
            if not settings.supabase.URL or not settings.supabase.KEY:
                logger.critical(
                    "Supabase URL or key is missing. Please check your .env file"
                )
                logger.critical(
                    f"SUPABASE_URL: {'SET' if settings.supabase.URL else 'MISSING'}"
                )
                logger.critical(
                    f"SUPABASE_KEY: {'SET' if settings.supabase.KEY else 'MISSING'}"
                )
                # Don't crash immediately to allow for better error reporting
                # Create a dummy client that will raise appropriate errors when used
                from unittest.mock import MagicMock

                cls._client = MagicMock()
                cls._client.table.side_effect = Exception(
                    "Supabase client failed to initialize"
                )
                return

            logger.info(
                f"Initializing Supabase client with URL: {settings.supabase.URL[:20]}..."
            )
            cls._client: Client = create_client(
                settings.supabase.URL, settings.supabase.KEY
            )
            logger.info("Supabase client initialized successfully")
        except Exception as e:
            logger.critical(f"Failed to initialize Supabase client: {str(e)}")
            logger.critical(traceback.format_exc())
            # Create a dummy client that will raise appropriate errors when used
            from unittest.mock import MagicMock

            cls._client = MagicMock()
            cls._client.table.side_effect = Exception(
                "Supabase client failed to initialize"
            )

    @property
    def client(self) -> Client:
        """Get the Supabase client instance"""
        return self._client

    def table(self, table_name: str):
        """Get a table reference"""
        return self._client.table(table_name)

    def auth(self):
        """Get the auth client"""
        return self._client.auth

    def storage(self):
        """Get the storage client"""
        return self._client.storage

    def verify_token(self, token: str) -> Dict[str, Any]:
        """Verify a Supabase JWT token and return the user info"""
        try:
            logger.info(f"Verifying token: {token[:10]}...")
            user_response = self._client.auth.get_user(token)

            if user_response.user is None:
                logger.error("No user found for provided token")
                raise DatabaseException("Invalid authentication token")

            # Log successful authentication
            logger.info(f"Successfully authenticated user: {user_response.user.id}")

            # Return user ID from Supabase
            return {"id": user_response.user.id}
        except Exception as e:
            logger.error(f"Authentication error: {str(e)}")
            logger.error(f"Token: {token[:10]}...")
            logger.error(traceback.format_exc())
            raise DatabaseException(f"Authentication error: {str(e)}")

    def execute_query(self, table_name: str, query_builder: Callable):
        """
        Execute a query using a function that builds upon a table reference

        Args:
            table_name: The name of the table
            query_builder: A function that takes a table reference and returns a query

        Returns:
            The query result data

        Raises:
            DatabaseException: If the query fails
        """
        try:
            table_ref = self.table(table_name)
            query = query_builder(table_ref)
            response = query.execute()

            if hasattr(response, "error") and response.error:
                error_message = (
                    response.error.message
                    if hasattr(response.error, "message")
                    else str(response.error)
                )
                logger.error(f"Database query error: {error_message}")
                raise DatabaseException(f"Database query failed: {error_message}")

            return response.data
        except Exception as e:
            if isinstance(e, DatabaseException):
                raise
            logger.error(f"Database error: {str(e)}")
            logger.error(traceback.format_exc())
            raise DatabaseException(f"Database operation failed: {str(e)}")


# Create a global instance
supabase = SupabaseClient()
