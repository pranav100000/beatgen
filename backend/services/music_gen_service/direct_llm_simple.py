"""
Simplified direct tool calling with Anthropic API.
Uses Anthropic's native tool calling capability instead of MCP.
"""

import os
import logging
from typing import Dict, List, Any, Optional
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

from anthropic import Anthropic
from app.services.instruments import (
    get_all_soundfonts,
    get_soundfonts_by_type,
    find_soundfonts,
    get_instrument_metadata,
    GM_INSTRUMENTS,
    GM_FAMILIES,
)
from app.services.midi import MIDIGenerator

logger = logging.getLogger(__name__)

# Initialize MIDI generator
midi_generator = MIDIGenerator(output_dir="output")

# Define the tools schema with simplified descriptions
AUTOCOMPOSE_TOOLS = [
    {
        "name": "create_music_description",
        "description": "Creates a structured music description from text input, generating title, tempo, key, and instrument specifications.",
        "input_schema": {
            "type": "object",
            "properties": {
                "description": {
                    "type": "string",
                    "description": "Text description of the desired music",
                },
                "tempo": {"type": "integer", "description": "Tempo in BPM"},
                "key": {
                    "type": "string",
                    "description": "Musical key (e.g., 'C major')",
                },
            },
            "required": ["description"],
        },
    },
    {
        "name": "get_available_soundfonts",
        "description": "Retrieves metadata about available soundfonts for instrument selection.",
        "input_schema": {"type": "object", "properties": {}},
    },
    {
        "name": "search_soundfonts",
        "description": "Searches available soundfonts that match a given query.",
        "input_schema": {
            "type": "object",
            "properties": {
                "query": {"type": "string", "description": "Search term for soundfonts"}
            },
            "required": ["query"],
        },
    },
    {
        "name": "get_soundfonts_by_instrument_type",
        "description": "Retrieves soundfonts for a specific instrument type.",
        "input_schema": {
            "type": "object",
            "properties": {
                "instrument_type": {
                    "type": "string",
                    "description": "Type of instrument (e.g., 'piano', 'guitar')",
                }
            },
            "required": ["instrument_type"],
        },
    },
    {
        "name": "get_general_midi_instruments",
        "description": "Retrieves the list of General MIDI instrument program numbers and families.",
        "input_schema": {"type": "object", "properties": {}},
    },
    {
        "name": "generate_midi_from_description",
        "description": "Generates MIDI files from a music description, creating separate tracks for each instrument.",
        "input_schema": {
            "type": "object",
            "properties": {
                "music_description": {
                    "type": "object",
                    "description": "Complete structured description of the music to generate",
                }
            },
            "required": ["music_description"],
        },
    },
]


class DirectLLMSimple:
    """Service for interacting with LLMs using direct tool calling with simplified descriptions."""

    def __init__(
        self, api_key: Optional[str] = None, model: str = "claude-3-sonnet-20240229"
    ):
        """
        Initialize the LLM service with direct tool calling.

        Args:
            api_key: Anthropic API key (or None to use environment variable)
            model: Model ID to use
        """
        self.api_key = api_key or os.environ.get("ANTHROPIC_API_KEY")
        if not self.api_key:
            logger.warning(
                "No API key provided for LLM service. Set ANTHROPIC_API_KEY in environment."
            )

        self.model = model
        self.client = Anthropic(api_key=self.api_key) if self.api_key else None

        # Define tool handlers
        self.tool_handlers = {
            "create_music_description": self._handle_create_music_description,
            "get_available_soundfonts": self._handle_get_available_soundfonts,
            "search_soundfonts": self._handle_search_soundfonts,
            "get_soundfonts_by_instrument_type": self._handle_get_soundfonts_by_instrument_type,
            "get_general_midi_instruments": self._handle_get_general_midi_instruments,
            "generate_midi_from_description": self._handle_generate_midi_from_description,
        }

    async def run_music_session(
        self, description: str, tempo: Optional[int] = None, key: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Run a complete music generation session using Anthropic's tool calling.

        Args:
            description: Text description of the desired music
            tempo: Optional tempo in BPM
            key: Optional musical key

        Returns:
            Dictionary with results including the music description and generated MIDI
        """
        if not self.client:
            logger.error("Cannot run music session: No Anthropic API key available")
            return {
                "status": "error",
                "error": "No Anthropic API key available",
                "music_description": {
                    "title": f"Error generating music from: {description[:30]}",
                    "tempo": tempo or 120,
                    "instruments": [],
                },
            }

        logger.info(f"Starting music generation for: {description[:100]}...")

        # Create a more detailed prompt with constraints
        full_description = description
        constraints = []

        if tempo:
            constraints.append(f"Tempo: {tempo} BPM")
        if key:
            constraints.append(f"Key: {key}")

        if constraints:
            full_description += "\n\nAdditional constraints:\n" + "\n".join(constraints)

        # Simplified system prompt
        system_prompt = """You are a music composer that uses the available tools to create MIDI compositions based on text descriptions.
First use create_music_description to design the song structure, then use generate_midi_from_description to produce MIDI files.
Always use the tools rather than describing what you would do."""

        try:
            user_message = f"""Create a musical composition based on this description: {full_description}
Use the create_music_description tool to create a detailed music specification first."""

            # Make the initial API call to get a music description
            response = self.client.messages.create(
                model=self.model,
                max_tokens=4000,
                temperature=0.7,
                system=system_prompt,
                messages=[{"role": "user", "content": user_message}],
                tools=AUTOCOMPOSE_TOOLS,
            )

            # Extract music description from content blocks
            music_description = None
            midi_result = None

            # Process tool use blocks from the content array
            for content_block in response.content:
                # Check if it's a tool use block
                if hasattr(content_block, "type") and content_block.type == "tool_use":
                    tool_name = content_block.name
                    args = content_block.input

                    logger.debug(f"Processing tool use block: {tool_name}")

                    # Handle the tool call
                    if tool_name == "create_music_description":
                        music_description = await self._handle_create_music_description(
                            args
                        )

                # If we got a music description, generate MIDI files
                if music_description:
                    # Create a follow-up message to generate MIDI
                    messages = [
                        {"role": "user", "content": user_message},
                        {
                            "role": "assistant",
                            "content": (
                                response.content[0].text if response.content else ""
                            ),
                        },
                        {
                            "role": "user",
                            "content": "Now use the generate_midi_from_description tool to create MIDI files based on the music description.",
                        },
                    ]

                    # Make the second API call to generate MIDI
                    midi_response = self.client.messages.create(
                        model=self.model,
                        max_tokens=4000,
                        temperature=0.7,
                        system=system_prompt,
                        messages=messages,
                        tools=AUTOCOMPOSE_TOOLS,
                    )

                    # Process MIDI tool use blocks
                    for content_block in midi_response.content:
                        if (
                            hasattr(content_block, "type")
                            and content_block.type == "tool_use"
                        ):
                            if content_block.name == "generate_midi_from_description":
                                midi_result = (
                                    await self._handle_generate_midi_from_description(
                                        {"music_description": music_description}
                                    )
                                )

            # Return the final result
            if midi_result and music_description:
                return {
                    "status": "success",
                    "music_description": music_description,
                    "midi_result": midi_result,
                }
            elif music_description:
                return {
                    "status": "partial",
                    "music_description": music_description,
                    "error": "MIDI generation failed",
                }
            else:
                return {
                    "status": "error",
                    "error": "Failed to generate music description",
                    "music_description": {
                        "title": f"Error generating music from: {description[:30]}",
                        "tempo": tempo or 120,
                        "instruments": [],
                    },
                }

        except Exception as e:
            logger.error(f"Error in music generation session: {str(e)}")
            return {
                "status": "error",
                "error": str(e),
                "music_description": {
                    "title": f"Error generating music from: {description[:30]}",
                    "tempo": tempo or 120,
                    "instruments": [],
                },
            }

    # Tool handler functions (simplified implementations)
    async def _handle_create_music_description(
        self, args: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Handle create_music_description tool."""
        description = args.get("description", "")
        tempo = args.get("tempo", 120)
        key = args.get("key", "C major")

        logger.debug(f"Creating music description for: {description[:50]}...")

        # Return a sample music description
        # In a real implementation, this would come from the model
        return {
            "title": f"Music inspired by: {description[:30]}",
            "tempo": tempo,
            "key": key,
            "time_signature": [4, 4],
            "instruments": [
                {
                    "name": "Piano",
                    "soundfont_name": "Grand Piano",
                    "program": 0,
                    "channel": 0,
                    "patterns": [
                        {
                            "type": "melody",
                            "notes": [
                                {
                                    "pitch": 60,
                                    "start": 0.0,
                                    "duration": 1.0,
                                    "velocity": 80,
                                },
                                {
                                    "pitch": 62,
                                    "start": 1.0,
                                    "duration": 1.0,
                                    "velocity": 80,
                                },
                                {
                                    "pitch": 64,
                                    "start": 2.0,
                                    "duration": 1.0,
                                    "velocity": 80,
                                },
                                {
                                    "pitch": 65,
                                    "start": 3.0,
                                    "duration": 1.0,
                                    "velocity": 80,
                                },
                            ],
                        }
                    ],
                }
            ],
        }

    async def _handle_get_available_soundfonts(
        self, args: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Handle get_available_soundfonts tool."""
        metadata = get_instrument_metadata()
        soundfonts = get_all_soundfonts()
        metadata["sample_soundfonts"] = (
            soundfonts[:20] if len(soundfonts) > 20 else soundfonts
        )
        return metadata

    async def _handle_search_soundfonts(
        self, args: Dict[str, Any]
    ) -> List[Dict[str, Any]]:
        """Handle search_soundfonts tool."""
        query = args.get("query", "")
        return find_soundfonts(query)

    async def _handle_get_soundfonts_by_instrument_type(
        self, args: Dict[str, Any]
    ) -> List[Dict[str, Any]]:
        """Handle get_soundfonts_by_instrument_type tool."""
        instrument_type = args.get("instrument_type", "")
        return get_soundfonts_by_type(instrument_type)

    async def _handle_get_general_midi_instruments(
        self, args: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Handle get_general_midi_instruments tool."""
        return {
            "instruments": GM_INSTRUMENTS,
            "families": {k: list(v) for k, v in GM_FAMILIES.items()},
        }

    async def _handle_generate_midi_from_description(
        self, args: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Handle generate_midi_from_description tool."""
        music_description = args.get("music_description", {})
        logger.debug(
            f"Generating MIDI for: {music_description.get('title', 'Untitled')}"
        )

        # Generate separate MIDI files
        results = await midi_generator.generate_midi_separate(music_description)

        # Get the directory path from the first result
        dir_path = os.path.dirname(results[0]["file_path"]) if results else ""

        # Create a structured response with all track information
        tracks = []
        composition_dir = os.path.basename(dir_path)
        for result in results:
            tracks.append(
                {
                    "instrument_name": result["instrument_name"],
                    "soundfont_name": result["soundfont_name"],
                    "file_path": result["file_path"],
                    "track_count": result["track_count"],
                    "midi_data": result["midi_data"],
                    "download_url": f"/download/{composition_dir}/{os.path.basename(result['file_path'])}",
                }
            )

        return {
            "title": music_description["title"],
            "directory": dir_path,
            "tracks": tracks,
        }


# Create a singleton instance
direct_llm_simple = DirectLLMSimple()

# Export function for easier access
run_music_session_simple = direct_llm_simple.run_music_session
