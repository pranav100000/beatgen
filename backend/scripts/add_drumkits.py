#!/usr/bin/env python3
"""
Script to add a single drum sample file to the backend storage and database.

Usage:
    python add_drumkits.py --file /path/to/kick.wav --kit-name "My Kit" --category "Electronic" --type "Kick"
"""

import argparse
import asyncio
import json
import os
import sys
import uuid
import requests
from datetime import datetime
from typing import Dict, Any, Optional

# Add the parent directory to sys.path to import app modules
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app2.infrastructure.database.supabase_client import supabase
from app2.infrastructure.storage.supabase_storage import SupabaseStorage
from app2.core.logging import get_logger

# Configure logger
logger = get_logger("beatgen.scripts.add_drum_sample") # Updated logger name

# Constants
BUCKET_NAME = "assets"
DRUM_SAMPLES_PREFIX = "drum_samples_public"
TABLE_NAME = "drum_samples_public"  # Public drum samples table


async def create_drum_sample_record(
    file_name: str,
    display_name: str,
    category: str,
    kit_name: str,
    type: str,
    file_format: str,
    file_size: int,
    internal_kit_name: str # Added internal kit name for path consistency
) -> Dict[str, Any]:
    """
    Create a record in the drum_samples_public table for a single sample.
    Generates the ID and constructs the storage key before insertion.

    Args:
        file_name: The original filename including extension.
        display_name: The display name of the drum sample.
        category: The category/genre of the drum kit.
        kit_name: The user-provided name of the drum kit.
        type: The type of drum sample (e.g., Kick, Snare).
        file_format: The file extension (e.g., wav, mp3).
        file_size: The size of the file in bytes.
        internal_kit_name: Lowercase, underscore-separated kit name for path.

    Returns:
        The created drum sample record including the generated ID and storage_key.
    """
    sample_id = str(uuid.uuid4())
    now = datetime.utcnow().replace(microsecond=0).isoformat()

    # Construct storage key using the generated ID and internal kit name
    storage_key = f"{category.lower()}/{internal_kit_name}/{sample_id}/{file_name}"

    sample_data = {
        "id": sample_id,
        "file_name": file_name,
        "display_name": display_name,
        "category": category,
        "kit_name": kit_name, # Store the user-provided kit name
        "type": type,
        "file_format": file_format,
        "file_size": file_size,
        "description": f"{display_name} ({type}) from {kit_name}",
        "storage_key": storage_key,
        "created_at": now
    }

    logger.info(f"Attempting to create drum sample record with ID: {sample_id} and storage_key: {storage_key}")
    result = supabase.execute_query(
        TABLE_NAME,
        lambda table: table.insert(sample_data).execute()
    )

    if not result or not result.data:
        error_message = f"Failed to create drum sample record for {file_name}. Result: {result}"
        logger.error(error_message)
        raise Exception(error_message)

    logger.info(f"Successfully created drum sample record with ID: {sample_id}")
    return result.data[0]


async def process_single_sample(
    file_path: str,
    kit_name: str,
    category: str,
    type: str
) -> Dict[str, Any]:
    """
    Processes a single drum sample file: creates a DB record and uploads the file.

    Args:
        file_path: The path to the drum sample file.
        kit_name: The name of the drum kit.
        category: The category/genre of the drum kit.
        type: The type of drum sample (e.g., Kick, Snare).

    Returns:
        The created drum sample record.
    """
    if not os.path.isfile(file_path):
        raise FileNotFoundError(f"Sample file not found: {file_path}")

    file_name = os.path.basename(file_path)
    name_part, file_format = os.path.splitext(file_name)
    file_format = file_format.lstrip('.') # Remove leading dot
    file_size = os.path.getsize(file_path)

    # Create display name: replace separators, title case
    display_name = name_part.replace('_', ' ').replace('-', ' ').title()
    
    # Create internal kit name for storage path consistency (lowercase, underscore)
    internal_kit_name = kit_name.lower().replace(' ', '_').replace('-', '_')

    logger.info(f"Processing sample: {file_name} for kit: {kit_name}, category: {category}, type: {type}")

    # Create storage client
    storage = SupabaseStorage(BUCKET_NAME)

    try:
        # 1. Create the database record first to get ID and final storage_key
        logger.info(f"Creating database record for {file_name}")
        db_record = await create_drum_sample_record(
            file_name=file_name,
            display_name=display_name,
            category=category,
            kit_name=kit_name,
            type=type,
            file_format=file_format,
            file_size=file_size,
            internal_kit_name=internal_kit_name
        )

        storage_key = db_record['storage_key'] # Get the final storage key
        full_storage_path = f"{DRUM_SAMPLES_PREFIX}/{storage_key}"

        # 2. Read the file data
        logger.info(f"Reading file {file_path}")
        with open(file_path, "rb") as f:
            file_data = f.read()

        # 3. Get a signed upload URL
        logger.info(f"Getting signed upload URL for {full_storage_path}")
        signed_upload = storage.create_signed_upload_url(full_storage_path)

        # 4. Upload using the signed URL
        logger.info(f"Uploading file {file_name} to {storage_key}")
        # Determine content type (optional but good practice)
        content_type = f"audio/{file_format}" if file_format in ['wav', 'mp3', 'ogg', 'aac'] else "application/octet-stream"
        response = requests.put(
            signed_upload["upload_url"],
            data=file_data,
            headers={"Content-Type": content_type}
        )

        if response.status_code >= 400:
            logger.error(f"Upload failed for {file_name} with status {response.status_code}: {response.text}")
            # Consider deleting the created DB record on upload failure
            try:
                logger.warning(f"Attempting to delete orphaned DB record {db_record['id']} due to upload failure.")
                supabase.execute_query(TABLE_NAME, lambda table: table.delete().eq("id", db_record['id']).execute())
                logger.warning(f"Successfully deleted orphaned DB record: {db_record['id']}")
            except Exception as delete_e:
                logger.error(f"Failed to delete orphaned DB record {db_record['id']}: {delete_e}")
            raise Exception(f"Upload failed with status {response.status_code}: {response.text}")

        logger.info(f"File {file_name} uploaded successfully to {storage_key}")

        return db_record # Return the database record

    except Exception as e:
        logger.error(f"Error processing sample {file_name}: {str(e)}")
        raise # Re-raise the exception

# Remove the old process_directory function as it's no longer used
# async def process_directory(...): ...

async def main(args: argparse.Namespace):
    """Main function to handle command line arguments and execute sample processing."""
    try:
        # Validate required arguments (though argparse handles 'required=True')
        if not all([args.file, args.kit_name, args.category, args.type]):
             logger.error("Missing one or more required arguments: --file, --kit-name, --category, --type")
             parser.print_help() # Show usage
             sys.exit(1)
        
        result = await process_single_sample(
            file_path=args.file,
            kit_name=args.kit_name,
            category=args.category,
            type=args.type
        )

        logger.info(f"Successfully processed and added sample: {result['file_name']} (ID: {result['id']})")
        # Output the result as JSON
        print(json.dumps(result, indent=2, default=str))

    except FileNotFoundError as e:
        logger.error(str(e))
        sys.exit(1)
    except Exception as e:
        logger.error(f"An error occurred during the process: {str(e)}")
        sys.exit(1)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Add a single drum sample file to the backend storage and database.",
        formatter_class=argparse.RawTextHelpFormatter,
        epilog="""
Example usage:
  python %(prog)s --file ./samples/kick_drum_1.wav --kit-name "Acoustic Kit 1" --category "Acoustic" --type "Kick"
  python %(prog)s --file ../808_samples/snare_sharp.mp3 --kit-name "808 Classics" --category "Electronic" --type "Snare"
"""
    )

    # Define arguments for single file processing
    parser.add_argument("--file", required=True, help="Path to the drum sample file (e.g., .wav, .mp3).")
    parser.add_argument("--kit-name", required=True, help="Name of the drum kit this sample belongs to.")
    parser.add_argument("--category", required=True, help="Category/genre of the drum kit (e.g., Acoustic, Electronic, HipHop).")
    parser.add_argument("--type", required=True, help="Type of the drum sound (e.g., Kick, Snare, HiHat, Cymbal).")

    # Remove old directory argument if present
    # parser.add_argument("--directory", ...)

    args = parser.parse_args()

    # Run the main async function
    asyncio.run(main(args))