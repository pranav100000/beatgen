from typing import Dict, Any, List
import traceback

from app2.core.logging import get_logger
from app2.core.exceptions import StorageException
from app2.infrastructure.database.supabase_client import supabase

logger = get_logger("beatgen.infrastructure.storage")


class SupabaseStorage:
    """Client for Supabase Storage operations with consistent error handling"""

    def __init__(self, bucket_name: str):
        """
        Initialize the storage client with a bucket name

        Args:
            bucket_name: The name of the storage bucket to use
        """
        self.bucket_name = bucket_name
        self._storage = supabase.storage()
        self._bucket = self._storage.from_(bucket_name)

    def create_signed_upload_url(
        self, path: str, should_overwrite: bool = True
    ) -> Dict[str, str]:
        """
        Create a signed URL for uploading a file

        Args:
            path: The storage path where the file will be stored
            should_overwrite: Whether to overwrite an existing file with the same path (default True)

        Returns:
            A dictionary containing the signed URL and storage path

        Raises:
            StorageException: If the operation fails
        """
        try:
            logger.info(f"Creating signed upload URL for path: {path}")

            # Check if file exists and delete it first if overwrite is requested
            if should_overwrite:
                try:
                    # Check if the file exists
                    self._bucket.list(path)
                    # File exists, try to delete it first
                    logger.info(
                        f"File exists at path: {path}, deleting before creating new upload URL"
                    )
                    try:
                        self._bucket.remove([path])
                        logger.info(f"Successfully deleted existing file at: {path}")
                    except Exception as delete_err:
                        logger.warning(
                            f"Could not delete existing file: {str(delete_err)}, will try to overwrite anyway"
                        )
                except Exception:
                    # File doesn't exist or can't be accessed, which is fine
                    logger.info(f"No existing file at path: {path} or couldn't check")

            # Now create the signed URL
            response = self._bucket.create_signed_upload_url(path)

            # Extract the signed URL
            if isinstance(response, dict) and "signed_url" in response:
                signed_url = response["signed_url"]
                logger.info("Created signed upload URL")
                return {"upload_url": signed_url, "storage_key": path}
            else:
                logger.error(f"Unexpected response format: {response}")
                raise StorageException("Failed to create signed upload URL")

        except Exception as e:
            logger.error(f"Error creating signed upload URL: {str(e)}")
            logger.error(traceback.format_exc())
            raise StorageException(f"Failed to create signed upload URL: {str(e)}")

    def delete_file(self, path: str) -> bool:
        """
        Delete a file from storage

        Args:
            path: The storage path of the file to delete

        Returns:
            True if the operation was successful

        Raises:
            StorageException: If the operation fails
        """
        try:
            logger.info(f"Deleting file: {path}")

            # Ensure path doesn't have leading slash
            clean_path = path
            if clean_path.startswith("/"):
                clean_path = clean_path[1:]

            # Remove the file
            self._bucket.remove([clean_path])
            logger.info(f"File deleted successfully: {path}")
            return True

        except Exception as e:
            logger.error(f"Error deleting file: {str(e)}")
            logger.error(traceback.format_exc())
            raise StorageException(f"Failed to delete file: {str(e)}")

    def get_public_url(self, path: str) -> str:
        """
        Get the public URL for a file

        Args:
            path: The storage path of the file

        Returns:
            The public URL of the file

        Raises:
            StorageException: If the operation fails
        """
        try:
            logger.info(f"Getting public URL for file: {path}")
            public_url = self._bucket.get_public_url(path)
            logger.info(f"Got public URL for file: {path}")
            return public_url

        except Exception as e:
            logger.error(f"Error getting public URL: {str(e)}")
            logger.error(traceback.format_exc())
            raise StorageException(f"Failed to get public URL: {str(e)}")

    def list_files(self, path: str = "") -> List[Dict[str, Any]]:
        """
        List files in a directory

        Args:
            path: The storage path to list files from

        Returns:
            A list of file objects

        Raises:
            StorageException: If the operation fails
        """
        try:
            logger.info(f"Listing files in path: {path}")
            files = self._bucket.list(path)
            logger.info(f"Found {len(files)} files in path: {path}")
            return files

        except Exception as e:
            logger.error(f"Error listing files: {str(e)}")
            logger.error(traceback.format_exc())
            raise StorageException(f"Failed to list files: {str(e)}")
