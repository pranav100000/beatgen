#!/usr/bin/env python3
"""
Script to add drum kit samples from a directory to the backend storage and database.

Usage:
    python add_drumkits.py --directory /path/to/my_drum_kit --category "Electronic"
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
import librosa  # Added import
import numpy as np # Added import
from app2.types.genre_types import GenreType
from app2.types.drum_sample_types import DrumSampleType
from app2.infrastructure.database.supabase_client import supabase
from app2.infrastructure.storage.supabase_storage import SupabaseStorage
from app2.core.logging import get_logger
import dotenv

# Configure logger
logger = get_logger("beatgen.scripts.add_drumkits") # Changed logger name back

# Constants
BUCKET_NAME = "assets"
DRUM_SAMPLES_PREFIX = "drum_samples_public"
TABLE_NAME = "drum_samples_public"  # Public drum samples table

# Define valid audio file extensions
VALID_AUDIO_EXTENSIONS = ('.wav', '.mp3', '.ogg', '.flac', '.aiff', '.aif')

# Explicitly load .env from the project root (assuming script is run from project root OR this script's location)
# Calculate path relative to this script file's location
dotenv_path = os.path.join(os.path.dirname(__file__), '..', '..', '.env') 
logger.info(f"Attempting to load .env file from: {dotenv_path}")
loaded = dotenv.load_dotenv(dotenv_path=dotenv_path)
if not loaded:
    # As a fallback, try loading from the current working directory (or standard search path)
    logger.warning(f".env file not found or failed to load from calculated path: {dotenv_path}. Trying default load_dotenv().")
    loaded = dotenv.load_dotenv()
    if not loaded:
        logger.error("Failed to load .env file from calculated path and default location. Supabase client might fail.")
    else:
         logger.info("Successfully loaded .env file using default dotenv search path.")
elif loaded:
    logger.info(f"Successfully loaded .env file from: {dotenv_path}")

async def create_drum_sample_record(
    file_name: str,
    display_name: str,
    kit_name: str,
    # type: str, # Type removed, not determined automatically
    file_format: str,
    file_size: int,
    internal_kit_name: str, # Added internal kit name for path consistency
    category: DrumSampleType = DrumSampleType.KICK,
    genre: GenreType = GenreType.HIP_HOP,
    duration: Optional[float] = None,  # Added duration parameter
    waveform_data: Optional[List[float]] = None, # Added waveform_data parameter
) -> Dict[str, Any]:
    """
    Create a record in the drum_samples_public table for a single sample from a kit.
    Generates the ID and constructs the storage key before insertion.

    Args:
        file_name: The original filename including extension.
        display_name: The display name of the drum sample.
        category: The category/genre of the drum kit (as a DrumSampleType enum member).
        kit_name: The user-provided name of the drum kit (derived from directory).
        # type: The type of drum sample (e.g., Kick, Snare) - currently omitted.
        file_format: The file extension (e.g., wav, mp3).
        file_size: The size of the file in bytes.
        internal_kit_name: Lowercase, underscore-separated kit name for path.
        duration: The duration of the drum sample in seconds.
        waveform_data: The waveform data of the drum sample.

    Returns:
        The created drum sample record including the generated ID and storage_key.
    """
    sample_id = str(uuid.uuid4())
    now = datetime.utcnow().replace(microsecond=0).isoformat()
    
    file_name = file_name.lower().replace(' ', '_').replace('-', '_')

    # Construct storage key using the enum *value* (lowercase string) and internal kit name
    storage_key = f"{category.value}/{sample_id}/{file_name}" # Use category.value for path

    sample_data = {
        "id": sample_id,
        "file_name": file_name,
        "display_name": display_name,
        "category": category.name, # Use the enum member's NAME (e.g., "KICK") for DB insertion
        "genre": genre.name, # Use the enum member's NAME (e.g., "HIP_HOP") for DB insertion
        "kit_name": kit_name, # Store the user-provided kit name (from dir)
        # "type": type, # Type omitted
        "file_format": file_format,
        "file_size": file_size,
        "description": f"{display_name} sample from {kit_name} kit", # Updated description
        "storage_key": storage_key,
        "created_at": now,
        "updated_at": now
    }

    # Add duration and waveform_data if they exist
    if duration is not None:
        sample_data["duration"] = duration
    if waveform_data is not None:
        # Ensure waveform_data is stored as JSON in the DB if the column type is JSON/JSONB
        # If the column type is TEXT, it will be stored as a string representation of the list.
        sample_data["waveform_data"] = waveform_data

    logger.info(f"Attempting to create drum sample record with ID: {sample_id}, storage_key: {storage_key}, category: {category.name}")
    try:
        result = supabase.execute_query(
            TABLE_NAME,
            lambda table: table.insert(sample_data)
        )
    except Exception as db_e:
        logger.error(f"Database insert failed for {file_name}: {db_e}")
        # Optionally re-raise or handle specific db errors like constraint violations
        raise Exception(f"Database operation failed: {db_e}") from db_e

    # Check if the result list is empty (insertion failed or returned no data)
    if not result:
        error_message = f"Failed to create drum sample record for {file_name} (No data returned). Result: {result}"
        logger.error(error_message)
        raise Exception(error_message)

    logger.info(f"Successfully created drum sample record with ID: {sample_id}")
    # Return the first element of the result list (the inserted record)
    return result[0]


async def upload_and_record_sample(
    file_path: str,
    category: DrumSampleType,
    kit_name: str, # Kit name for DB
    internal_kit_name: str # Kit name for storage path
) -> Dict[str, Any]:
    """
    Creates a database record for a drum sample and then uploads the file.

    Args:
        file_path: The path to the drum sample file.
        category: The category/genre of the drum kit (as a DrumSampleType enum member).
        kit_name: The display name of the drum kit.
        internal_kit_name: The internal name of the kit for storage path.

    Returns:
        The created drum sample record.
    """
    if not os.path.isfile(file_path):
        raise FileNotFoundError(f"Sample file not found during processing: {file_path}")

    file_name = os.path.basename(file_path)
    name_part, file_format = os.path.splitext(file_name)
    file_format = file_format.lstrip('.').lower() # Remove leading dot, ensure lowercase
    file_size = os.path.getsize(file_path)

    # Create display name from filename: replace separators, title case
    display_name = name_part.replace('_', ' ').replace('-', ' ').title()

    logger.info(f"Processing sample file: {file_name} for kit: {kit_name} (Category: {category.name})")

    # --- Audio Processing --- Start
    duration: Optional[float] = None
    waveform_preview: Optional[List[float]] = None
    try:
        logger.debug(f"Loading audio file {file_path} with librosa")
        # Load audio file; sr=None preserves original sample rate
        waveform, sampling_rate = librosa.load(file_path, sr=None)
        duration = librosa.get_duration(y=waveform, sr=sampling_rate)

        # Generate waveform preview (e.g., RMS over ~100 points)
        # Adjust n_fft and hop_length as needed for desired detail/size
        n_fft = 2048 # Window size for FFT analysis
        hop_length = max(1, len(waveform) // 100) # Aim for roughly 100 data points
        rms = librosa.feature.rms(y=waveform, frame_length=n_fft, hop_length=hop_length)[0]
        # Normalize RMS values to be between 0 and 1 for consistent visualization
        rms_normalized = (rms - np.min(rms)) / (np.max(rms) - np.min(rms) + 1e-6) # Add epsilon to avoid division by zero
        waveform_preview = [float(val) for val in rms_normalized] # Convert to list of standard floats

        logger.debug(f"Extracted duration: {duration:.2f}s and waveform preview ({len(waveform_preview)} points) for {file_name}")

    except Exception as audio_e:
        logger.error(f"Error processing audio file {file_name} with librosa: {audio_e}")
        # Decide if you want to proceed without duration/waveform or raise an error
        # raise audio_e # Option 1: Stop processing this file
        logger.warning(f"Proceeding without duration and waveform data for {file_name}.") # Option 2: Continue
    # --- Audio Processing --- End

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
            # type is omitted
            file_format=file_format,
            file_size=file_size,
            internal_kit_name=internal_kit_name,
            duration=duration,              # Pass duration
            waveform_data=waveform_preview  # Pass waveform data
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
        content_type = f"audio/{file_format}" if file_format in ['wav', 'mp3', 'ogg', 'aac', 'aiff', 'flac'] else "application/octet-stream"
        response = requests.put(
            signed_upload["upload_url"],
            data=file_data,
            headers={"Content-Type": content_type}
        )

        if response.status_code >= 400:
            logger.error(f"Upload failed for {file_name} with status {response.status_code}: {response.text}")
            # Attempt to delete the orphaned DB record
            try:
                logger.warning(f"Attempting to delete orphaned DB record {db_record['id']} due to upload failure.")
                supabase.execute_query(TABLE_NAME, lambda table: table.delete().eq("id", db_record['id']).execute())
                logger.warning(f"Successfully deleted orphaned DB record: {db_record['id']}")
            except Exception as delete_e:
                logger.error(f"Failed to delete orphaned DB record {db_record['id']}: {delete_e}")
            raise Exception(f"Upload failed for {file_name} with status {response.status_code}: {response.text}")

        logger.info(f"File {file_name} uploaded successfully to {storage_key}")

        return db_record # Return the database record

    except Exception as e:
        # Log error with file and kit context
        logger.error(f"Error processing sample {file_name} for kit {kit_name}: {str(e)}")
        raise # Re-raise the exception to be handled in process_directory


async def process_directory(directory_path: str, category: DrumSampleType) -> List[Dict[str, Any]]:
    """
    Processes all valid sample files in a directory, creating records and uploading them.

    Args:
        directory_path: Path to the directory containing the drum kit samples.
        category: The category/genre to assign to the drum kit (as a DrumSampleType enum member).

    Returns:
        A list of created drum sample records for the successfully processed files.
    """
    results = []
    success_count = 0
    fail_count = 0

    if not os.path.isdir(directory_path):
        logger.error(f"Input directory not found or is not a directory: {directory_path}")
        return results

    # Use the directory's base name as the drum kit name (display and internal)
    dir_base_name = os.path.basename(os.path.normpath(directory_path))
    kit_name = dir_base_name.replace('_', ' ').replace('-', ' ').title()
    internal_kit_name = dir_base_name.lower().replace(' ', '_').replace('-', '_')

    logger.info(f"Processing directory '{directory_path}' as drum kit '{kit_name}' (Internal: '{internal_kit_name}') in category '{category.name}'")

    # List files and process them
    try:
        all_files = os.listdir(directory_path)
    except OSError as e:
        logger.error(f"Could not list directory contents for {directory_path}: {e}")
        return results

    for filename in all_files:
        file_path = os.path.join(directory_path, filename)

        # Process only files with valid audio extensions
        if os.path.isfile(file_path) and filename.lower().endswith(VALID_AUDIO_EXTENSIONS):
            try:
                sample_record = await upload_and_record_sample(
                    file_path=file_path,
                    category=category,
                    kit_name=kit_name,
                    internal_kit_name=internal_kit_name
                )
                results.append(sample_record)
                success_count += 1
                logger.debug(f"Successfully processed and added sample: {filename}") # Use debug for per-file success
            except Exception as e:
                fail_count += 1
                # Error is logged within upload_and_record_sample, just note failure here
                logger.warning(f"Failed to process sample {filename}. See previous error. Continuing...")
        elif os.path.isfile(file_path):
            logger.debug(f"Skipping non-audio file: {filename}")
        # Optionally handle subdirectories or skip them
        elif os.path.isdir(file_path):
            logger.info(f"Skipping subdirectory: {filename}")

    logger.info(f"Directory processing completed for '{kit_name}'. Success: {success_count}, Failed: {fail_count}")
    return results


async def main(args: argparse.Namespace):
    """Main function to handle command line arguments and execute directory processing."""
    try:
        # Validate required arguments
        if not args.directory or not args.category:
             logger.error("Both --directory and --category are required.")
             parser.print_help()
             sys.exit(1)

        if not os.path.isdir(args.directory):
            logger.error(f"Provided path is not a valid directory: {args.directory}")
            sys.exit(1)

        # Validate and convert category argument to enum member
        try:
            # Convert input category string (case-insensitive) to the corresponding enum member
            category_enum_member = DrumSampleType[args.category.upper()]
            logger.info(f"Using category: {category_enum_member.name} (Value: {category_enum_member.value})")
        except KeyError:
            logger.error(f"Invalid category: '{args.category}'. Please choose from: {', '.join([m.name for m in DrumSampleType])}")
            parser.print_help()
            sys.exit(1)

        results = await process_directory(
            directory_path=args.directory,
            category=category_enum_member
        )

        logger.info(f"Script finished. Processed {len(results)} samples successfully from directory: {args.directory}")
        # Output the results as JSON if any were successful
        if results:
            print(json.dumps(results, indent=2, default=str))
        else:
            logger.info("No samples were successfully processed.")

    except Exception as e:
        logger.critical(f"An unexpected error occurred in main: {str(e)}") # Use critical for top-level errors
        sys.exit(1)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Add all drum kit samples from a directory to the backend storage and database.",
        formatter_class=argparse.RawTextHelpFormatter,
        epilog=f"""
Example usage:
  python %(prog)s --directory /path/to/my_kick_kit --category KICK
  python %(prog)s --directory ./kits/808_classics --category EIGHT_O_EIGHT

Available categories (case-insensitive): {', '.join([m.name for m in DrumSampleType])}
"""
    )

    # Define arguments for directory processing
    parser.add_argument("--directory", required=True, help="Path to the directory containing the drum kit sample files.")
    # Validate category against enum member names (case-insensitive)
    parser.add_argument("--category", required=True,
                        help=f"Category to assign to the drum kit (e.g., KICK, SNARE). Choose from: {', '.join([m.name for m in DrumSampleType])}.")

    # Removed --file, --kit-name, --type arguments

    args = parser.parse_args()

    # Run the main async function
    asyncio.run(main(args))