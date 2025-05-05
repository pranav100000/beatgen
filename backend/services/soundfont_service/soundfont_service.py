from typing import List, Dict, Any, Optional

from app2.infrastructure.database.supabase_client import supabase
from app2.core.logging import get_api_logger

# Configure logger
logger = get_api_logger("soundfont_service")


class SoundfontService:
    """Service for managing soundfonts"""

    @staticmethod
    async def get_public_soundfonts(
        category: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """
        Get all public soundfonts, optionally filtered by category
        """
        logger.info(f"Getting public soundfonts, category filter: {category}")

        try:
            # Build the query
            query = supabase.table("soundfont_public").select("*")

            # Apply category filter if provided
            if category:
                query = query.eq("category", category)

            # Execute query
            response = query.execute()

            if hasattr(response, "error") and response.error:
                logger.error(f"Error retrieving soundfonts: {response.error}")
                return []

            soundfonts = response.data or []
            logger.info(f"Found {len(soundfonts)} public soundfonts")

            # Generate download URLs for each soundfont
            for soundfont in soundfonts:
                try:
                    # Get public URL for the soundfont file
                    file_url = supabase.storage.from_("soundfonts").get_public_url(
                        soundfont["storage_key"]
                    )
                    soundfont["download_url"] = file_url
                    logger.debug(
                        f"Generated download URL for soundfont: {soundfont['name']}"
                    )
                except Exception as url_err:
                    logger.error(
                        f"Error generating URL for soundfont {soundfont['id']}: {str(url_err)}"
                    )
                    soundfont["download_url"] = None

            return soundfonts

        except Exception as e:
            logger.error(f"Unexpected error in get_public_soundfonts: {str(e)}")
            return []

    @staticmethod
    async def get_public_soundfont(soundfont_id: str) -> Optional[Dict[str, Any]]:
        """
        Get a specific public soundfont by ID
        """
        logger.info(f"Getting public soundfont with ID: {soundfont_id}")

        try:
            response = (
                supabase.table("soundfont_public")
                .select("*")
                .eq("id", soundfont_id)
                .execute()
            )

            if hasattr(response, "error") and response.error:
                logger.error(f"Error retrieving soundfont: {response.error}")
                return None

            if not response.data or len(response.data) == 0:
                logger.error(f"No soundfont found with ID: {soundfont_id}")
                return None

            soundfont = response.data[0]

            # Generate download URL
            try:
                file_url = supabase.storage.from_("soundfonts").get_public_url(
                    soundfont["storage_key"]
                )
                soundfont["download_url"] = file_url
                logger.debug(
                    f"Generated download URL for soundfont: {soundfont['name']}"
                )
            except Exception as url_err:
                logger.error(
                    f"Error generating URL for soundfont {soundfont['id']}: {str(url_err)}"
                )
                soundfont["download_url"] = None

            return soundfont

        except Exception as e:
            logger.error(f"Unexpected error in get_public_soundfont: {str(e)}")
            return None


# Create a singleton instance
soundfont_service = SoundfontService()
