#!/usr/bin/env python3
"""
Script to add soundfont instruments to the backend storage and database.

Usage:
    python add_soundfonts.py --file /path/to/soundfont.sf2 --name "Piano" --category "Piano" [--description "Description"]
    python add_soundfonts.py --directory /path/to/soundfonts --category "Piano"
"""

import argparse
import asyncio
import json
import os
import sys
import uuid
import requests
from datetime import datetime
from typing import Dict, Any, List, Optional

# Add the parent directory to sys.path to import app modules
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app2.infrastructure.database.supabase_client import supabase
from app2.infrastructure.storage.supabase_storage import SupabaseStorage
from app2.core.logging import get_logger

# Configure logger
logger = get_logger("beatgen.scripts.add_soundfonts")

# Constants
BUCKET_NAME = "assets"
SOUNDFONT_PREFIX = "soundfonts_public"
TABLE_NAME = "instrument_files"  # Public soundfonts table


async def create_soundfont_record(
    id: str,
    display_name: str,
    storage_key: str,
    category: str,
    file_name: str,
    file_format: str,
    file_size: int,
    is_public: bool,
    description: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Create a record in the instrument_files table.

    Args:
        id: The unique identifier for the soundfont record
        display_name: The display name of the soundfont
        storage_key: The storage key where the soundfont file is stored
        category: The category of the soundfont
        file_name: The original name of the soundfont file
        file_format: The file format/extension (e.g., "sf2")
        file_size: The size of the file in bytes
        is_public: Whether the soundfont is publicly accessible
        description: An optional description of the soundfont

    Returns:
        The created soundfont record
    """
    now = datetime.utcnow().replace(microsecond=0).isoformat()

    soundfont_data = {
        "id": id,
        "display_name": display_name,
        "file_name": file_name,
        "file_format": file_format,
        "file_size": file_size,
        "category": category,
        "description": description or f"{display_name} soundfont",
        "storage_key": storage_key,
        "is_public": is_public,
        "created_at": now,
        "updated_at": now,
    }

    logger.info(f"Creating soundfont record with ID: {id}")
    result = supabase.execute_query(
        TABLE_NAME, lambda table: table.insert(soundfont_data)
    )

    if not result:
        raise Exception(f"Failed to create soundfont record or no data returned: {result}")

    logger.info(f"Created soundfont record with ID: {id}")
    return result[0]


async def upload_soundfont(
    file_path: str, name: str, category: str, description: Optional[str] = None
) -> Dict[str, Any]:
    """
    Upload a soundfont file to storage and create a database record.

    Args:
        file_path: The path to the soundfont file
        name: The display name of the soundfont
        category: The category of the soundfont
        description: An optional description of the soundfont

    Returns:
        The created soundfont record
    """
    actual_file_name = os.path.basename(file_path)
    soundfont_id = str(uuid.uuid4()) # This ID is used for storage path, DB record ID is generated in create_soundfont_record
    
    file_format = actual_file_name.split(".")[-1].lower() if "." in actual_file_name else "sf2"
    file_size = os.path.getsize(file_path)
    is_public_flag = True


    # Create storage path (in Supabase) - use the UUID from create_soundfont_record for consistency if possible,
    # or ensure this UUID matches the one used in storage_key if create_soundfont_record generates its own.
    # For now, using a new UUID here for path, and create_soundfont_record generates the actual record ID.
    # The storage_key will use the ID generated in create_soundfont_record.
    # To make storage path use the same ID as the record, we'd need to generate ID before create_soundfont_record or get it back.
    # Let's stick to the current flow: soundfont_id for storage path is fine, record_id will be new.
    # The storage_key in DB should use the DB record's ID.
    # Re-evaluating: The soundfont_id here is used to create the storage_path, and this *same* id should be the record's id.
    # So, create_soundfont_record should accept this id.

    # Let's adjust: generate ID here, pass to create_soundfont_record.
    record_id = str(uuid.uuid4())


    # Create storage path (in Supabase)
    storage_path = f"{category.lower()}/{record_id}/{actual_file_name}"


    # The key to store in the database (without the prefix)
    storage_key = storage_path

    # Create storage client
    storage = SupabaseStorage(BUCKET_NAME)

    # Upload file directly (no signed URL in script)
    logger.info(f"Uploading file {file_path} to {storage_key}")

    try:
        with open(file_path, "rb") as f:
            file_data = f.read()

        # Get a signed upload URL - use full path with prefix in storage
        full_storage_path = f"{SOUNDFONT_PREFIX}/{storage_path}"
        signed_upload = storage.create_signed_upload_url(full_storage_path)
        logger.info(f"Got signed upload URL for {full_storage_path}")

        # Upload using the signed URL with requests
        response = requests.put(
            signed_upload["upload_url"],
            data=file_data,
            headers={"Content-Type": "application/octet-stream"},
        )

        if response.status_code >= 400:
            raise Exception(
                f"Upload failed with status {response.status_code}: {response.text}"
            )

        logger.info(f"File uploaded successfully to {storage_key}")

        # Create database record
        soundfont = await create_soundfont_record(
            id=record_id,
            display_name=name,
            storage_key=storage_key,
            category=category,
            file_name=actual_file_name,
            file_format=file_format,
            file_size=file_size,
            is_public=is_public_flag,
            description=description,
        )

        return soundfont

    except Exception as e:
        logger.error(f"Error uploading soundfont: {str(e)}")
        raise


async def process_directory(directory_path: str, category: str) -> List[Dict[str, Any]]:
    """
    Process all soundfont files in a directory.

    Args:
        directory_path: The path to the directory containing soundfont files
        category: The category to assign to all soundfonts in this directory

    Returns:
        A list of created soundfont records
    """
    results = []

    if not os.path.isdir(directory_path):
        logger.error(f"Directory not found: {directory_path}")
        return results

    for filename in os.listdir(directory_path):
        if filename.lower().endswith(".sf2"):
            file_path = os.path.join(directory_path, filename)
            # Use the filename without extension as the soundfont name
            name = os.path.splitext(filename)[0].replace("_", " ").title()

            try:
                soundfont = await upload_soundfont(
                    file_path=file_path, name=name, category=category
                )
                results.append(soundfont)
                logger.info(f"Successfully added soundfont: {name}")
            except Exception as e:
                logger.error(f"Failed to add soundfont {filename}: {str(e)}")

    return results


async def main(args: argparse.Namespace):
    """Main function to handle command line arguments and execute the appropriate action."""
    try:
        if args.file:
            # Single file mode
            if not os.path.isfile(args.file):
                logger.error(f"File not found: {args.file}")
                return

            # Default name to filename if not provided
            name = args.name
            if not name:
                name = (
                    os.path.splitext(os.path.basename(args.file))[0]
                    .replace("_", " ")
                    .title()
                )

            soundfont = await upload_soundfont(
                file_path=args.file,
                name=name,
                category=args.category,
                description=args.description,
            )

            logger.info(
                f"Successfully added soundfont: {soundfont['display_name']} (ID: {soundfont['id']})"
            )
            print(json.dumps(soundfont, indent=2, default=str))

        elif args.directory:
            # Directory mode
            if not args.category:
                logger.error(
                    "Category is required when adding multiple soundfonts from a directory"
                )
                return

            results = await process_directory(args.directory, args.category)

            logger.info(
                f"Successfully added {len(results)} soundfonts from directory: {args.directory}"
            )
            print(json.dumps(results, indent=2, default=str))

        else:
            logger.error("Either --file or --directory must be provided")

    except Exception as e:
        logger.error(f"Error in main function: {str(e)}")
        raise


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Add soundfont instruments to the backend"
    )

    # Create a mutually exclusive group for file or directory
    input_group = parser.add_mutually_exclusive_group(required=True)
    input_group.add_argument("--file", help="Path to a single soundfont file")
    input_group.add_argument(
        "--directory", help="Path to a directory containing soundfont files"
    )

    # Other arguments
    parser.add_argument("--name", help="Name of the soundfont (only used with --file)")
    parser.add_argument(
        "--category",
        required=True,
        help="Category of the soundfont (e.g., Piano, Strings)",
    )
    parser.add_argument("--description", help="Description of the soundfont")

    args = parser.parse_args()

    asyncio.run(main(args))
