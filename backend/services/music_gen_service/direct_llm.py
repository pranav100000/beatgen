"""
Direct tool calling with Anthropic API.
Uses Anthropic's native tool calling capability instead of MCP.
"""
import os
import json
import asyncio
import logging
from typing import Dict, List, Any, Optional, Callable
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

from anthropic import Anthropic
from app.services.instruments import (
    get_all_soundfonts,
    get_available_instrument_types,
    get_soundfonts_by_type,
    find_soundfonts,
    get_instrument_metadata,
    GM_INSTRUMENTS,
    GM_FAMILIES
)
from app.services.midi import MIDIGenerator

logger = logging.getLogger(__name__)

# Initialize MIDI generator
midi_generator = MIDIGenerator(output_dir="output")

# Define the tools schema
AUTOCOMPOSE_TOOLS = [
    {
        "name": "create_music_description",
        "description": """Create a detailed, structured music description from a text prompt.
This tool generates a complete and valid JSON description of a musical piece based on your text description.

The output will include:
- Title for the composition
- Appropriate tempo (or use the specified tempo)
- Key signature
- Time signature
- Detailed instrument specifications with:
  - MIDI program numbers
  - Instrument names
  - Corresponding soundfont names
  - Channel assignments
  - Note patterns with precise timing, pitch, duration, and velocity

IMPORTANT GUIDELINES:

MIDI Technical Info:
- MIDI pitches: Middle C = 60, C4 = 60, C5 = 72, etc. (12 semitones per octave)
- Timing: measured in beats (e.g., 0.0, 1.0, 2.5)
- Durations: in beats (e.g., 0.5 = eighth note in 4/4, 1.0 = quarter note)
- Velocities: 1-127, with 64-100 being typical (127 = loudest)

General MIDI Program Numbers:
- Piano: 0-7 (0 = Acoustic Grand)
- Bass: 32-39 (33 = Electric Bass)
- Guitar: 24-31 (24 = Nylon, 25 = Steel, 30 = Distortion)
- Strings: 40-47 (48-51 for ensembles)
- Brass: 56-63
- Percussion: Use channel 9 with program = "percussion"
  - Percussion notes: 36 = kick, 38 = snare, 42 = closed hi-hat

Composition Tips:
1. Each instrument should work both independently and together with others
2. Each instrument needs its own channel (0-15, except percussion which is always 9)
3. Each instrument needs a soundfont_name appropriate to its type
4. Create musically coherent patterns that follow proper music theory for the key

Common Soundfont Names:
- "Grand Piano", "Electric Piano", "Acoustic Guitar", "Electric Guitar"
- "Electric Bass (finger)", "Electric Bass (pick)", "Acoustic Bass"
- "Violin", "Viola", "Cello", "String Ensemble"
- "Trumpet", "Trombone", "Saxophone", "Brass Ensemble"
- "Flute", "Clarinet", "Oboe"
- "Synth Lead", "Synth Pad", "Synth Bass"
- "Standard Drum Kit", "Jazz Drum Kit", "Rock Drum Kit"
        """,
        "input_schema": {
            "type": "object",
            "properties": {
                "description": {
                    "type": "string",
                    "description": "Text description of the desired music"
                },
                "tempo": {
                    "type": ["integer", "null"],
                    "description": "Optional specific tempo in BPM"
                },
                "key": {
                    "type": ["string", "null"],
                    "description": "Optional specific musical key"
                }
            },
            "required": ["description"]
        }
    },
    {
        "name": "get_available_soundfonts",
        "description": "Get metadata about all available soundfonts.",
        "input_schema": {
            "type": "object",
            "properties": {}
        }
    },
    {
        "name": "search_soundfonts",
        "description": "Search for soundfonts matching a query.",
        "input_schema": {
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": "Search string to match against soundfont names or types"
                }
            },
            "required": ["query"]
        }
    },
    {
        "name": "get_soundfonts_by_instrument_type",
        "description": "Get soundfonts for a specific instrument type.",
        "input_schema": {
            "type": "object",
            "properties": {
                "instrument_type": {
                    "type": "string",
                    "description": "Type of instrument (e.g., 'piano', 'guitar', 'strings')"
                }
            },
            "required": ["instrument_type"]
        }
    },
    {
        "name": "get_general_midi_instruments",
        "description": "Get the General MIDI instrument program mappings.",
        "input_schema": {
            "type": "object",
            "properties": {}
        }
    },
    {
        "name": "generate_midi_from_description",
        "description": """Generate separate MIDI files for each instrument in a music description.

The music description should be a JSON object with a detailed specification of the
music to generate, including instruments, patterns, structure, etc. You have complete
creative freedom to design the music as you see fit.

For each instrument, ensure you include a "soundfont_name" field that specifies the
soundfont that should be used to play that particular instrument's MIDI file.
""",
        "input_schema": {
            "type": "object",
            "properties": {
                "music_description": {
                    "type": "object",
                    "description": "Complete description of the music to generate"
                }
            },
            "required": ["music_description"]
        }
    }
]

class DirectLLMService:
    """Service for interacting with LLMs using direct tool calling."""
    
    def __init__(self, api_key: Optional[str] = None, model: str = "claude-3-sonnet-20240229"):
        """
        Initialize the LLM service with direct tool calling.
        
        Args:
            api_key: Anthropic API key (or None to use environment variable)
            model: Model ID to use
        """
        self.api_key = api_key or os.environ.get("ANTHROPIC_API_KEY")
        if not self.api_key:
            logger.warning("No API key provided for LLM service. Set ANTHROPIC_API_KEY in environment.")
        
        self.model = model
        self.client = Anthropic(api_key=self.api_key) if self.api_key else None
        
        # Define tool handlers
        self.tool_handlers = {
            "create_music_description": self._handle_create_music_description,
            "get_available_soundfonts": self._handle_get_available_soundfonts,
            "search_soundfonts": self._handle_search_soundfonts,
            "get_soundfonts_by_instrument_type": self._handle_get_soundfonts_by_instrument_type,
            "get_general_midi_instruments": self._handle_get_general_midi_instruments,
            "generate_midi_from_description": self._handle_generate_midi_from_description
        }
    
    async def run_music_session(self, description: str, tempo: Optional[int] = None, key: Optional[str] = None) -> Dict[str, Any]:
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
                    "instruments": []
                }
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
        
        # Add information about available instruments and soundfonts
        instrument_info = get_instrument_metadata()
        soundfonts_sample = get_all_soundfonts()[:10]  # Limit to avoid context overload
        
        system_prompt = f"""You are AutoCompose, an AI music composer.
Create MIDI music based on text descriptions.
Use your knowledge of music theory to create high-quality compositions.

You have access to tools to help you create music:
1. create_music_description - Create a structured music description
2. get_available_soundfonts - Get information about available soundfonts
3. search_soundfonts - Search for specific soundfonts
4. get_soundfonts_by_instrument_type - Get soundfonts for a specific instrument
5. get_general_midi_instruments - Get GM instrument program mappings
6. generate_midi_from_description - Generate MIDI files from a description

To compose music:
1. First, gather information about available instruments
2. Then create a detailed music description using create_music_description
3. Finally, generate MIDI files using generate_midi_from_description
"""
        
        try:
            messages = [{
                "role": "user",
                "content": f"""Please create a musical composition based on this description:

{full_description}

I want a complete composition with multiple instruments that fit the description.
Create a detailed music description first, then generate the MIDI files."""
            }]
            
            # Run the tool calling session
            completed = False
            max_iterations = 5
            iterations = 0
            
            music_description = None
            midi_result = None
            
            while not completed and iterations < max_iterations:
                iterations += 1
                logger.debug(f"Tool call iteration {iterations}")
                
                try:
                    # Make the API call with updated SDK format (v0.49.0+)
                    response = self.client.messages.create(
                        model=self.model,
                        max_tokens=4000,
                        temperature=0.7,
                        system=system_prompt,
                        messages=messages,
                        tools=AUTOCOMPOSE_TOOLS,
                        tool_choice={"type": "auto"}  # Correct format is a dictionary
                    )
                    
                    # Add model's response to the conversation
                    assistant_message = {
                        "role": "assistant",
                        "content": response.content[0].text if response.content else ""
                    }
                    
                    # Handle tool calls if present
                    if hasattr(response, 'tool_calls') and response.tool_calls:
                        tool_calls_data = []
                        for tc in response.tool_calls:
                            tool_calls_data.append({
                                "id": tc.id,
                                "name": tc.name,
                                "input": tc.input
                            })
                        assistant_message["tool_calls"] = tool_calls_data
                    
                    messages.append(assistant_message)
                    
                    # Process the tool calls
                    if hasattr(response, 'tool_calls') and response.tool_calls:
                        tool_responses = []
                        
                        for tool_call in response.tool_calls:
                            try:
                                tool_name = tool_call.name
                                args = tool_call.input
                                
                                logger.debug(f"Processing tool call: {tool_name}")
                                
                                # Call the appropriate handler function for this tool
                                if tool_name in self.tool_handlers:
                                    result = await self.tool_handlers[tool_name](args)
                                    
                                    # Save specific results for later
                                    if tool_name == "create_music_description":
                                        music_description = result
                                    elif tool_name == "generate_midi_from_description":
                                        midi_result = result
                                        completed = True  # Consider session complete once MIDI is generated
                                    
                                    tool_responses.append({
                                        "role": "tool",
                                        "tool_call_id": tool_call.id,
                                        "name": tool_name,
                                        "content": json.dumps(result)
                                    })
                                else:
                                    logger.error(f"Unknown tool: {tool_name}")
                                    tool_responses.append({
                                        "role": "tool",
                                        "tool_call_id": tool_call.id,
                                        "name": tool_name,
                                        "content": json.dumps({"error": f"Unknown tool: {tool_name}"})
                                    })
                            except Exception as e:
                                logger.error(f"Error executing tool {tool_call.name}: {str(e)}")
                                tool_responses.append({
                                    "role": "tool",
                                    "tool_call_id": tool_call.id,
                                    "name": tool_call.name,
                                    "content": json.dumps({"error": str(e)})
                                })
                        
                        # Add tool responses to the conversation
                        messages.extend(tool_responses)
                    else:
                        # If no tool calls were made in this iteration, we're done
                        logger.debug("No tool calls made in this iteration")
                        break
                except Exception as e:
                    logger.error(f"Error in API call: {str(e)}")
                    raise
            
            # Return the final result
            if midi_result and music_description:
                return {
                    "status": "success",
                    "music_description": music_description,
                    "midi_result": midi_result
                }
            elif music_description:
                return {
                    "status": "partial",
                    "music_description": music_description,
                    "error": "MIDI generation failed"
                }
            else:
                return {
                    "status": "error",
                    "error": "Failed to generate music description",
                    "music_description": {
                        "title": f"Error generating music from: {description[:30]}",
                        "tempo": tempo or 120,
                        "instruments": []
                    }
                }
                
        except Exception as e:
            logger.error(f"Error in music generation session: {str(e)}")
            return {
                "status": "error",
                "error": str(e),
                "music_description": {
                    "title": f"Error generating music from: {description[:30]}",
                    "tempo": tempo or 120,
                    "instruments": []
                }
            }
    
    # Tool handler functions
    async def _handle_create_music_description(self, args: Dict[str, Any]) -> Dict[str, Any]:
        """Handle create_music_description tool."""
        # Extract arguments
        description = args.get("description", "")
        tempo = args.get("tempo")
        key = args.get("key")
        
        logger.debug(f"Creating music description for: {description[:50]}...")
        
        # For now, we'll just return the arguments since the real implementation
        # would be handled by the model's tool output
        return {
            "title": f"Music inspired by: {description[:30]}",
            "tempo": tempo or 120,
            "key": key or "C major",
            "time_signature": [4, 4],
            "instruments": []
        }
    
    async def _handle_get_available_soundfonts(self, args: Dict[str, Any]) -> Dict[str, Any]:
        """Handle get_available_soundfonts tool."""
        logger.debug("Getting available soundfonts...")
        
        # Get metadata from the instrument service
        metadata = get_instrument_metadata()
        
        # Add a sample of available soundfonts (limiting to avoid overloading context)
        soundfonts = get_all_soundfonts()
        metadata["sample_soundfonts"] = soundfonts[:20] if len(soundfonts) > 20 else soundfonts
        
        return metadata
    
    async def _handle_search_soundfonts(self, args: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Handle search_soundfonts tool."""
        query = args.get("query", "")
        logger.debug(f"Searching soundfonts for: {query}")
        
        return find_soundfonts(query)
    
    async def _handle_get_soundfonts_by_instrument_type(self, args: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Handle get_soundfonts_by_instrument_type tool."""
        instrument_type = args.get("instrument_type", "")
        logger.debug(f"Getting soundfonts for instrument type: {instrument_type}")
        
        return get_soundfonts_by_type(instrument_type)
    
    async def _handle_get_general_midi_instruments(self, args: Dict[str, Any]) -> Dict[str, Any]:
        """Handle get_general_midi_instruments tool."""
        logger.debug("Getting GM instrument mappings")
        
        return {
            "instruments": GM_INSTRUMENTS,
            "families": {k: list(v) for k, v in GM_FAMILIES.items()}
        }
    
    async def _handle_generate_midi_from_description(self, args: Dict[str, Any]) -> Dict[str, Any]:
        """Handle generate_midi_from_description tool."""
        music_description = args.get("music_description", {})
        logger.debug(f"Generating MIDI for music description: {music_description.get('title', 'Untitled')}")
        
        # Validate the music description
        required_fields = ["title", "tempo", "instruments"]
        for field in required_fields:
            if field not in music_description:
                raise ValueError(f"Missing required field in music description: {field}")
        
        # Check that each instrument has a soundfont_name
        for i, instrument in enumerate(music_description.get("instruments", [])):
            if "soundfont_name" not in instrument:
                # Default to instrument name if not specified
                instrument["soundfont_name"] = instrument.get("name", f"Instrument_{i}")
        
        # Generate separate MIDI files using the MIDI generator service
        results = await midi_generator.generate_midi_separate(music_description)
        
        # Get the directory path from the first result
        dir_path = os.path.dirname(results[0]["file_path"]) if results else ""
        
        # Create a structured response with all track information
        tracks = []
        composition_dir = os.path.basename(dir_path)
        for result in results:
            tracks.append({
                "instrument_name": result["instrument_name"],
                "soundfont_name": result["soundfont_name"],
                "file_path": result["file_path"],
                "track_count": result["track_count"],
                "midi_data": result["midi_data"],
                "download_url": f"/download/{composition_dir}/{os.path.basename(result['file_path'])}"
            })
        
        return {
            "title": music_description["title"],
            "directory": dir_path,
            "tracks": tracks
        }

# Create a singleton instance
direct_llm_service = DirectLLMService()

# Export function for easier access
run_music_session = direct_llm_service.run_music_session