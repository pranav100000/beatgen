#!/usr/bin/env python3
"""
Script to list all soundfonts in the database.

Usage:
    python list_soundfonts.py
    python list_soundfonts.py --category "Piano"
"""

import argparse
import asyncio
import json
import os
import sys
from typing import Dict, Any, List, Optional

# Add the parent directory to sys.path to import app modules
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app2.infrastructure.database.supabase_client import supabase
from app2.core.logging import get_logger

# Configure logger
logger = get_logger("beatgen.scripts.list_soundfonts")

# Constants
TABLE_NAME = "soundfont_public"


async def list_soundfonts(category: Optional[str] = None) -> List[Dict[str, Any]]:
    """
    List all soundfonts in the database, optionally filtered by category.

    Args:
        category: Optional category to filter by

    Returns:
        A list of soundfont records
    """
    logger.info(f"Listing soundfonts{' in category: ' + category if category else ''}")

    query = lambda table: table.select("*").order("display_name")

    # Apply category filter if provided
    if category:
        query = (
            lambda table: table.select("*")
            .eq("category", category)
            .order("display_name")
        )

    result = supabase.execute_query(TABLE_NAME, query)

    if not result or not hasattr(result, "data"):
        logger.error(f"Failed to list soundfonts: {result}")
        return []

    logger.info(f"Found {len(result.data)} soundfonts")
    return result.data


async def main(args: argparse.Namespace):
    """Main function to handle command line arguments and execute the appropriate action."""
    try:
        soundfonts = await list_soundfonts(args.category)

        if not soundfonts:
            print("No soundfonts found.")
            return

        # Print summary table
        print(f"\nFound {len(soundfonts)} soundfonts:")
        print("-" * 90)
        print(
            f"{'ID':<10} | {'Display Name':<25} | {'Category':<15} | {'Storage Key':<35}"
        )
        print("-" * 90)

        for sf in soundfonts:
            short_id = sf.get("id", "")[:8] + "..."
            storage_key = sf.get("storage_key", "")
            if len(storage_key) > 35:
                storage_key = "..." + storage_key[-32:]

            print(
                f"{short_id:<10} | {sf.get('display_name', '')[:25]:<25} | {sf.get('category', '')[:15]:<15} | {storage_key:<35}"
            )

        print("-" * 90)

        # If requested, print detailed JSON
        if args.json:
            print("\nDetailed JSON:")
            print(json.dumps(soundfonts, indent=2, default=str))

    except Exception as e:
        logger.error(f"Error in main function: {str(e)}")
        raise


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="List soundfont instruments in the backend"
    )
    parser.add_argument("--category", help="Filter soundfonts by category")
    parser.add_argument(
        "--json", action="store_true", help="Print detailed JSON output"
    )

    args = parser.parse_args()

    asyncio.run(main(args))
