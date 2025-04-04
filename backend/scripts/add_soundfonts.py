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
TABLE_NAME = "soundfont_public"  # Public soundfonts table


async def create_soundfont_record(
    name: str, 
    display_name: str,
    storage_key: str, 
    category: str, 
    description: Optional[str] = None
) -> Dict[str, Any]:
    """
    Create a record in the soundfont_public table.

    Args:
        name: The internal name of the soundfont
        display_name: The display name of the soundfont
        storage_key: The storage key where the soundfont file is stored
        category: The category of the soundfont
        description: An optional description of the soundfont

    Returns:
        The created soundfont record
    """
    soundfont_id = str(uuid.uuid4())
    now = datetime.utcnow().replace(microsecond=0).isoformat()
    
    soundfont_data = {
        "id": soundfont_id,
        "name": name,
        "display_name": display_name,
        "category": category,
        "description": description or f"{display_name} soundfont",
        "storage_key": storage_key,
        "created_at": now
    }
    
    logger.info(f"Creating soundfont record with ID: {soundfont_id}")
    result = supabase.execute_query(
        TABLE_NAME,
        lambda table: table.insert(soundfont_data).execute()
    )
    
    if not result or not result.data:
        raise Exception(f"Failed to create soundfont record: {result}")
    
    logger.info(f"Created soundfont record with ID: {soundfont_id}")
    return result.data[0]


async def upload_soundfont(file_path: str, name: str, category: str, description: Optional[str] = None) -> Dict[str, Any]:
    """
    Upload a soundfont file to storage and create a database record.

    Args:
        file_path: The path to the soundfont file
        name: The name of the soundfont
        category: The category of the soundfont
        description: An optional description of the soundfont

    Returns:
        The created soundfont record
    """
    file_name = os.path.basename(file_path)
    soundfont_id = str(uuid.uuid4())
    file_extension = file_name.split('.')[-1] if '.' in file_name else 'sf2'
    
    # Create internal name (lowercase, underscore format)
    internal_name = name.lower().replace(' ', '_')
    
    # Create storage path (in Supabase)
    storage_path = f"{category.lower()}/{soundfont_id}/{file_name}"
    
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
            headers={"Content-Type": "application/octet-stream"}
        )
        
        if response.status_code >= 400:
            raise Exception(f"Upload failed with status {response.status_code}: {response.text}")
        
        logger.info(f"File uploaded successfully to {storage_key}")
        
        # Create database record
        soundfont = await create_soundfont_record(
            name=internal_name,
            display_name=name,
            storage_key=storage_key,
            category=category,
            description=description
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
        if filename.lower().endswith('.sf2'):
            file_path = os.path.join(directory_path, filename)
            # Use the filename without extension as the soundfont name
            name = os.path.splitext(filename)[0].replace('_', ' ').title()
            
            try:
                soundfont = await upload_soundfont(
                    file_path=file_path,
                    name=name,
                    category=category
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
                name = os.path.splitext(os.path.basename(args.file))[0].replace('_', ' ').title()
            
            soundfont = await upload_soundfont(
                file_path=args.file,
                name=name,
                category=args.category,
                description=args.description
            )
            
            logger.info(f"Successfully added soundfont: {soundfont['display_name']} (ID: {soundfont['id']})")
            print(json.dumps(soundfont, indent=2, default=str))
        
        elif args.directory:
            # Directory mode
            if not args.category:
                logger.error("Category is required when adding multiple soundfonts from a directory")
                return
            
            results = await process_directory(args.directory, args.category)
            
            logger.info(f"Successfully added {len(results)} soundfonts from directory: {args.directory}")
            print(json.dumps(results, indent=2, default=str))
        
        else:
            logger.error("Either --file or --directory must be provided")
    
    except Exception as e:
        logger.error(f"Error in main function: {str(e)}")
        raise


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Add soundfont instruments to the backend")
    
    # Create a mutually exclusive group for file or directory
    input_group = parser.add_mutually_exclusive_group(required=True)
    input_group.add_argument("--file", help="Path to a single soundfont file")
    input_group.add_argument("--directory", help="Path to a directory containing soundfont files")
    
    # Other arguments
    parser.add_argument("--name", help="Name of the soundfont (only used with --file)")
    parser.add_argument("--category", required=True, help="Category of the soundfont (e.g., Piano, Strings)")
    parser.add_argument("--description", help="Description of the soundfont")
    
    args = parser.parse_args()
    
    asyncio.run(main(args))