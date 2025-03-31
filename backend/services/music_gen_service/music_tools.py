"""
Specialized music generation tools for AutoCompose.
Provides focused tools for creating different musical components.
"""
import os
import json
import asyncio
import logging
from typing import Dict, List, Any, Optional, Callable, Tuple
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

from anthropic import Anthropic
from app.services.instruments import (
    get_all_soundfonts,
    get_soundfonts_by_type,
    find_soundfonts,
    get_instrument_metadata
)
from app.services.midi import MIDIGenerator

logger = logging.getLogger(__name__)

# Initialize MIDI generator
midi_generator = MIDIGenerator(output_dir="output")

# Define specialized music tools
MUSIC_TOOLS = [
    {
        "name": "determine_musical_parameters",
        "description": "Determines appropriate musical parameters (key, tempo) for a given music description.",
        "input_schema": {
            "type": "object",
            "properties": {
                "description": {
                    "type": "string",
                    "description": "Description of the music to be composed"
                }
            },
            "required": ["description"]
        }
    },
    {
        "name": "create_melody",
        "description": "Creates a melodic pattern for a specified instrument. YOU MUST specify note_names and note_durations.",
        "input_schema": {
            "type": "object",
            "properties": {
                "instrument_name": {
                    "type": "string",
                    "description": "Name of the instrument (e.g., 'Piano', 'Violin')"
                },
                "description": {
                    "type": "string",
                    "description": "Description of the melody character (e.g., 'cheerful', 'melancholic')"
                },
                "duration_beats": {
                    "type": "integer", 
                    "description": "Length of the melody in beats"
                },
                "program": {
                    "type": "integer",
                    "description": "MIDI program number (0-127) for the instrument"
                },
                "note_names": {
                    "type": "array",
                    "description": "REQUIRED: Array of note names like ['G3', 'Bb3', 'D4', 'G4', 'F4', etc.]",
                    "items": {
                        "type": "string"
                    }
                },
                "note_durations": {
                    "type": "array",
                    "description": "REQUIRED: Array of note durations like ['quarter', 'eighth', 'half', etc.] or numeric values in beats",
                    "items": {
                        "type": "string"
                    }
                },
                "note_velocities": {
                    "type": "array",
                    "description": "Optional: Array of note velocities (1-127, with 64-100 being typical). Default is 80 if not provided.",
                    "items": {
                        "type": "integer"
                    }
                }
            },
            "required": ["instrument_name", "description", "duration_beats", "note_names", "note_durations"]
        }
    },
    {
        "name": "create_chords",
        "description": "Creates a chord progression for a harmony instrument. YOU MUST specify chord_names and chord_durations.",
        "input_schema": {
            "type": "object",
            "properties": {
                "instrument_name": {
                    "type": "string",
                    "description": "Name of the instrument (e.g., 'Piano', 'Guitar')"
                },
                "description": {
                    "type": "string",
                    "description": "Description of the chord progression (e.g., 'simple', 'jazz')"
                },
                "duration_beats": {
                    "type": "integer",
                    "description": "Length of the chord progression in beats"
                },
                "program": {
                    "type": "integer",
                    "description": "MIDI program number (0-127) for the instrument"
                },
                "chord_names": {
                    "type": "array",
                    "description": "REQUIRED: Array of chord names like ['Gmin', 'Bb', 'D7', 'Gmin', etc.]",
                    "items": {
                        "type": "string"
                    }
                },
                "chord_durations": {
                    "type": "array",
                    "description": "REQUIRED: Array of chord durations like ['whole', 'half', 'quarter', etc.] or numeric values in beats",
                    "items": {
                        "type": "string"
                    }
                },
                "velocities": {
                    "type": "array",
                    "description": "Optional: Array of chord velocities (1-127). Default is 70 if not provided.",
                    "items": {
                        "type": "integer"
                    }
                }
            },
            "required": ["instrument_name", "description", "duration_beats", "chord_names", "chord_durations"]
        }
    },
    {
        "name": "create_drums",
        "description": "Creates a drum pattern for percussion. YOU MUST specify drum_notes and drum_durations.",
        "input_schema": {
            "type": "object",
            "properties": {
                "description": {
                    "type": "string",
                    "description": "Description of the drum pattern (e.g., 'basic beat', 'complex rhythm')"
                },
                "duration_beats": {
                    "type": "integer",
                    "description": "Length of the drum pattern in beats"
                },
                "intensity": {
                    "type": "string",
                    "enum": ["light", "medium", "heavy"],
                    "description": "Intensity level of the drum pattern"
                },
                "drum_names": {
                    "type": "array",
                    "description": "REQUIRED: Array of drum names like ['kick', 'snare', 'closed hi-hat', 'open hi-hat', etc.]",
                    "items": {
                        "type": "string"
                    }
                },
                "drum_durations": {
                    "type": "array",
                    "description": "REQUIRED: Array of note durations like ['quarter', 'eighth', 'half', etc.] or numeric values in beats",
                    "items": {
                        "type": "string"
                    }
                },
                "drum_velocities": {
                    "type": "array",
                    "description": "Optional: Array of note velocities (1-127, with 64-100 being typical). Default is 90 if not provided.",
                    "items": {
                        "type": "integer"
                    }
                }
            },
            "required": ["description", "duration_beats", "drum_names", "drum_durations"]
        }
    },
    {
        "name": "create_counter_melody",
        "description": "Creates a counter-melody that complements the main melody. YOU MUST specify note_names and note_durations.",
        "input_schema": {
            "type": "object",
            "properties": {
                "instrument_name": {
                    "type": "string",
                    "description": "Name of the instrument (e.g., 'Flute', 'Violin')"
                },
                "description": {
                    "type": "string",
                    "description": "Description of the counter-melody's character"
                },
                "duration_beats": {
                    "type": "integer",
                    "description": "Length of the counter-melody in beats"
                },
                "program": {
                    "type": "integer",
                    "description": "MIDI program number (0-127) for the instrument"
                },
                "note_names": {
                    "type": "array",
                    "description": "REQUIRED: Array of note names like ['G3', 'Bb3', 'D4', 'G4', 'F4', etc.]",
                    "items": {
                        "type": "string"
                    }
                },
                "note_durations": {
                    "type": "array",
                    "description": "REQUIRED: Array of note durations like ['quarter', 'eighth', 'half', etc.] or numeric values in beats",
                    "items": {
                        "type": "string"
                    }
                },
                "note_velocities": {
                    "type": "array",
                    "description": "Optional: Array of note velocities (1-127, with 64-100 being typical). Default is 75 if not provided.",
                    "items": {
                        "type": "integer"
                    }
                }
            },
            "required": ["instrument_name", "description", "duration_beats", "note_names", "note_durations"]
        }
    },
    {
        "name": "combine_parts",
        "description": "Combines all musical parts into a complete composition.",
        "input_schema": {
            "type": "object",
            "properties": {
                "title": {
                    "type": "string",
                    "description": "Title for the composition"
                },
                "melody": {
                    "type": "object",
                    "description": "The melody part created with create_melody"
                },
                "chords": {
                    "type": "object",
                    "description": "The chord part created with create_chords"
                },
                "drums": {
                    "type": "object",
                    "description": "The drum part created with create_drums"
                },
                "counter_melody": {
                    "type": "object",
                    "description": "The counter-melody part created with create_counter_melody"
                }
            },
            "required": ["title", "melody"]
        }
    },
    {
        "name": "search_soundfonts",
        "description": "Searches available soundfonts that match a given query.",
        "input_schema": {
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": "Search term for soundfonts"
                }
            },
            "required": ["query"]
        }
    }
]

class MusicToolsService:
    """Service for creating music using specialized component tools."""
    
    # Define key mappings (root note and scale type)
    KEY_MAP = {
        # Major keys
        "C major": {"root": 60, "scale": [0, 2, 4, 5, 7, 9, 11]},
        "C# major": {"root": 61, "scale": [0, 2, 4, 5, 7, 9, 11]},
        "D major": {"root": 62, "scale": [0, 2, 4, 5, 7, 9, 11]},
        "D# major": {"root": 63, "scale": [0, 2, 4, 5, 7, 9, 11]},
        "E major": {"root": 64, "scale": [0, 2, 4, 5, 7, 9, 11]},
        "F major": {"root": 65, "scale": [0, 2, 4, 5, 7, 9, 11]},
        "F# major": {"root": 66, "scale": [0, 2, 4, 5, 7, 9, 11]},
        "G major": {"root": 67, "scale": [0, 2, 4, 5, 7, 9, 11]},
        "G# major": {"root": 68, "scale": [0, 2, 4, 5, 7, 9, 11]},
        "A major": {"root": 69, "scale": [0, 2, 4, 5, 7, 9, 11]},
        "A# major": {"root": 70, "scale": [0, 2, 4, 5, 7, 9, 11]},
        "B major": {"root": 71, "scale": [0, 2, 4, 5, 7, 9, 11]},
        
        # Minor keys
        "C minor": {"root": 60, "scale": [0, 2, 3, 5, 7, 8, 10]},
        "C# minor": {"root": 61, "scale": [0, 2, 3, 5, 7, 8, 10]},
        "D minor": {"root": 62, "scale": [0, 2, 3, 5, 7, 8, 10]},
        "D# minor": {"root": 63, "scale": [0, 2, 3, 5, 7, 8, 10]},
        "E minor": {"root": 64, "scale": [0, 2, 3, 5, 7, 8, 10]},
        "F minor": {"root": 65, "scale": [0, 2, 3, 5, 7, 8, 10]},
        "F# minor": {"root": 66, "scale": [0, 2, 3, 5, 7, 8, 10]},
        "G minor": {"root": 67, "scale": [0, 2, 3, 5, 7, 8, 10]},
        "G# minor": {"root": 68, "scale": [0, 2, 3, 5, 7, 8, 10]},
        "A minor": {"root": 69, "scale": [0, 2, 3, 5, 7, 8, 10]},
        "A# minor": {"root": 70, "scale": [0, 2, 3, 5, 7, 8, 10]},
        "B minor": {"root": 71, "scale": [0, 2, 3, 5, 7, 8, 10]},
    }
    
    # Define common chord types within a scale (as scale degree indices)
    CHORD_TYPES = {
        "major": {"major": [0, 2, 4], "minor": [0, 2, 4]},  # I, IV, V for major key
        "minor": {"minor": [0, 2, 4], "major": [0, 2, 4]}   # i, iv, V for minor key
    }
    
    def __init__(self, api_key: Optional[str] = None, model: str = "claude-3-sonnet-20240229"):
        """
        Initialize the music tools service.
        
        Args:
            api_key: Anthropic API key (or None to use environment variable)
            model: Model ID to use
        """
        self.api_key = api_key or os.environ.get("ANTHROPIC_API_KEY")
        if not self.api_key:
            logger.warning("No API key provided for LLM service. Set ANTHROPIC_API_KEY in environment.")
        
        self.model = model
        self.client = Anthropic(api_key=self.api_key) if self.api_key else None
        
        # Fixed values for key musical parameters
        self.default_key = "C major"
        self.default_tempo = 120
        self.default_time_signature = [4, 4]
        
        # Define tool handlers
        self.tool_handlers = {
            "determine_musical_parameters": self._handle_determine_musical_parameters,
            "create_melody": self._handle_create_melody,
            "create_chords": self._handle_create_chords,
            "create_drums": self._handle_create_drums,
            "create_counter_melody": self._handle_create_counter_melody,
            "combine_parts": self._handle_combine_parts,
            "search_soundfonts": self._handle_search_soundfonts
        }
    
    async def compose_music(self, description: str, tempo: Optional[int] = None, key: Optional[str] = None) -> Dict[str, Any]:
        """
        Compose music by generating different components and combining them.
        
        Args:
            description: Text description of the desired music
            tempo: Optional tempo in BPM (overrides default)
            key: Optional musical key (overrides default)
            
        Returns:
            Dictionary with results including the music description and generated MIDI
        """
        if not self.client:
            logger.error("Cannot compose music: No Anthropic API key available")
            return {
                "status": "error",
                "error": "No Anthropic API key available",
                "music_description": {
                    "title": f"Error generating music from: {description[:30]}",
                    "tempo": tempo or self.default_tempo,
                    "instruments": []
                }
            }
        
        logger.info(f"Starting music composition for: {description[:100]}...")
        
        # Initialize storage for musical parts
        melody_part = None
        chords_part = None
        drums_part = None
        counter_melody_part = None
        combined_parts = None
        parameters_part = None
        
        # Start with initial values
        use_tempo = tempo or self.default_tempo
        use_key = key or self.default_key
        
        # Extract key information from user's description if provided
        # Look for key mentions in the description like "in D minor" or "in Bb major"
        key_match = None
        for key_name in self.KEY_MAP.keys():
            if key_name.lower() in description.lower():
                key_match = key_name
                break
        
        # Use extracted key if found from description
        if key_match:
            logger.info(f"Key extracted from description: {key_match}")
            use_key = key_match
        
        # If tempo or key not explicitly provided, we'll let Claude determine them later
        let_claude_determine = (tempo is None or key is None or key == self.default_key) and not key_match
        
        logger.info(f"Initial parameters: tempo={use_tempo} BPM, key={use_key}")
        if let_claude_determine:
            logger.info("Claude will determine musical parameters based on description")
        
        # System prompt focused on using the specialized tools
        initial_parameters_message = ""
        if let_claude_determine:
            initial_parameters_message = """IMPORTANT: Before creating any musical parts, FIRST use the determine_musical_parameters tool 
to select the most appropriate key and tempo based on the music description.
For example, a sad piece might be in a minor key at a slower tempo, while an energetic dance track
would use a higher tempo."""
        else:
            initial_parameters_message = f"You will create music in {use_key} at {use_tempo} BPM."
            
        system_prompt = f"""You are a music composer creating a piece based on a text description.
{initial_parameters_message}

Use the specialized music tools to create a complete composition:
1. First create the main melody - YOU MUST SPECIFY EXACT NOTES as note_names (like ["G3", "Bb3", "D4"]) and note_durations (like ["quarter", "eighth", "half"])
2. Then create chord progressions - YOU MUST SPECIFY EXACT CHORDS as chord_names (like ["Gmin", "Bb", "D7"]) and chord_durations (like ["whole", "half"])
3. Add drums if appropriate - YOU MUST SPECIFY EXACT DRUMS as drum_names (like ["kick", "snare", "hi-hat", "kick", "snare"]) and drum_durations (like ["quarter", "quarter", "eighth", "quarter", "quarter"])
4. Consider adding a counter-melody if it enhances the piece - also specify exact notes
5. Finally combine all parts

Create melodies, chords, and drum patterns that truly match the musical style described, being careful to use appropriate notes for the specified key ({use_key})."""
        
        try:
            # Start with initial user message
            messages = [{
                "role": "user",
                "content": f"""Please compose music based on this description: {description}

Start by creating a melody, then add chords and other elements as appropriate.
Use the tools to create each part of the composition."""
            }]
            
            # Track conversation to build up the composition in stages
            completed = False
            max_iterations = 10
            iterations = 0
            
            while not completed and iterations < max_iterations:
                iterations += 1
                logger.debug(f"Composition iteration {iterations}")
                
                # Make API call
                response = self.client.messages.create(
                    model=self.model,
                    max_tokens=4000,
                    temperature=0.7,
                    system=system_prompt,
                    messages=messages,
                    tools=MUSIC_TOOLS
                )
                
                # Add model's response to conversation
                content_text = ""
                for content_block in response.content:
                    if hasattr(content_block, 'type') and content_block.type == 'text':
                        content_text = content_block.text
                        break
                
                # Throw error if no content - we want to fail loudly when things go wrong
                if not content_text:
                    raise ValueError("Received empty content from Claude API. Failing to ensure we fix the underlying issue.")
                
                assistant_message = {
                    "role": "assistant",
                    "content": content_text
                }
                
                messages.append(assistant_message)
                
                # Process tool use blocks
                tool_responses = []
                has_tool_use = False
                
                for content_block in response.content:
                    if hasattr(content_block, 'type') and content_block.type == 'tool_use':
                        has_tool_use = True
                        tool_name = content_block.name
                        tool_args = content_block.input
                        tool_id = content_block.id
                        
                        logger.debug(f"Processing tool use: {tool_name}")
                        
                        try:
                            # Call appropriate handler
                            if tool_name in self.tool_handlers:
                                result = await self.tool_handlers[tool_name](tool_args, use_tempo, use_key)
                                
                                # Store part based on tool type
                                if tool_name == "determine_musical_parameters":
                                    parameters_part = result
                                    # Update key and tempo if they were determined by Claude
                                    if "key" in result and result["key"] in self.KEY_MAP:
                                        use_key = result["key"]
                                        logger.info(f"Using Claude-determined key: {use_key}")
                                    if "tempo" in result and isinstance(result["tempo"], int):
                                        use_tempo = result["tempo"]
                                        logger.info(f"Using Claude-determined tempo: {use_tempo} BPM")
                                    
                                    # Update the system prompt with the new parameters
                                    system_prompt = f"""You are a music composer creating a piece in {use_key} at {use_tempo} BPM.
Use the specialized music tools to create a complete composition:
1. First create the main melody - YOU MUST SPECIFY EXACT NOTES as note_names (like ["G3", "Bb3", "D4"]) and note_durations (like ["quarter", "eighth", "half"])
2. Then create chord progressions - YOU MUST SPECIFY EXACT CHORDS as chord_names (like ["Gmin", "Bb", "D7"]) and chord_durations (like ["whole", "half"])
3. Add drums if appropriate - YOU MUST SPECIFY EXACT DRUMS as drum_names (like ["kick", "snare", "hi-hat", "kick", "snare"]) and drum_durations (like ["quarter", "quarter", "eighth", "quarter", "quarter"])
4. Consider adding a counter-melody if it enhances the piece - also specify exact notes
5. Finally combine all parts

Create melodies, chords, and drum patterns that truly match the musical style described, being careful to use appropriate notes for the specified key ({use_key})."""
                                    
                                elif tool_name == "create_melody":
                                    melody_part = result
                                elif tool_name == "create_chords":
                                    chords_part = result 
                                elif tool_name == "create_drums":
                                    drums_part = result
                                elif tool_name == "create_counter_melody":
                                    counter_melody_part = result
                                elif tool_name == "combine_parts":
                                    combined_parts = result
                                    completed = True  # Mark complete when parts are combined
                                
                                # Add tool response
                                tool_responses.append({
                                    "role": "tool",
                                    "tool_call_id": tool_id,
                                    "name": tool_name,
                                    "content": json.dumps(result)
                                })
                            else:
                                logger.warning(f"Unknown tool: {tool_name}")
                                tool_responses.append({
                                    "role": "tool",
                                    "tool_call_id": tool_id,
                                    "name": tool_name,
                                    "content": json.dumps({"error": f"Unknown tool: {tool_name}"})
                                })
                        except Exception as e:
                            logger.error(f"Error handling tool {tool_name}: {str(e)}")
                            tool_responses.append({
                                "role": "tool",
                                "tool_call_id": tool_id,
                                "name": tool_name,
                                "content": json.dumps({"error": str(e)})
                            })
                
                # For Anthropic API, we cannot use "tool" role messages
                # Instead, add the tool responses as part of the next user message
                if tool_responses:
                    # Format the tool responses as text for the next user message
                    tool_results = ""
                    for resp in tool_responses:
                        tool_results += f"\nResult from {resp['name']}:\n"
                        content = json.loads(resp['content'])
                        tool_results += json.dumps(content, indent=2) + "\n"
                    
                    # Add a new user message with the results
                    messages.append({
                        "role": "user", 
                        "content": f"Here are the results from the tools you used:{tool_results}\n\nPlease continue with the composition using these results."
                    })
                
                # Exit if no tool use or reached completion
                if not has_tool_use or completed:
                    break
            
            # Once all parts are complete, generate the final music description
            music_description = self._create_final_description(
                description=description,
                tempo=use_tempo,
                key=use_key,
                melody=melody_part,
                chords=chords_part,
                drums=drums_part,
                counter_melody=counter_melody_part,
                combined=combined_parts
            )
            
            # Generate MIDI files
            midi_result = await self._generate_midi(music_description)
            
            # Create a comprehensive output JSON with all data
            output_json = {
                "status": "success",
                "title": music_description["title"],
                "description": description,
                "key": music_description.get("key", "unknown"),
                "tempo": music_description.get("tempo", 120),
                "time_signature": music_description.get("time_signature", [4, 4]),
                "tracks": midi_result["tracks"],
                "instruments": music_description.get("instruments", []),
                "music_description": music_description,
                "midi_result": midi_result,
                "claude_parameters": parameters_part,
                "directory": midi_result.get("directory", ""),
                "parts": {
                    "melody": melody_part,
                    "chords": chords_part,
                    "drums": drums_part,
                    "counter_melody": counter_melody_part,
                    "combined": combined_parts
                }
            }
            
            # Create a more concise version without base64 data for easier reading
            readable_output = json.loads(json.dumps(output_json))
            for track in readable_output.get("tracks", []):
                if "midi_data" in track:
                    track["midi_data"] = "[base64 data removed for readability]"
            
            # Log the readable output for debugging
            logger.debug(f"Generated comprehensive JSON output with {len(music_description.get('instruments', []))} instruments")
            
            return output_json
                
        except Exception as e:
            logger.error(f"Error in music composition: {str(e)}")
            error_description = {
                "title": f"Error generating music from: {description[:30]}",
                "tempo": use_tempo,
                "key": use_key,
                "time_signature": self.default_time_signature,
                "instruments": []
            }
            
            return {
                "status": "error",
                "error": str(e),
                "title": error_description["title"],
                "description": description,
                "key": use_key,
                "tempo": use_tempo,
                "time_signature": self.default_time_signature,
                "tracks": [],
                "instruments": [],
                "music_description": error_description,
                "midi_result": None,
                "claude_parameters": parameters_part,
                "directory": "",
                "parts": {
                    "melody": melody_part,
                    "chords": chords_part,
                    "drums": drums_part,
                    "counter_melody": counter_melody_part,
                    "combined": combined_parts
                }
            }
    
    def _create_final_description(self, 
                                description: str, 
                                tempo: int, 
                                key: str,
                                melody: Optional[Dict[str, Any]] = None,
                                chords: Optional[Dict[str, Any]] = None,
                                drums: Optional[Dict[str, Any]] = None,
                                counter_melody: Optional[Dict[str, Any]] = None,
                                combined: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Create the final music description from all parts."""
        # Use combined parts if available, otherwise build from components
        if combined and "title" in combined:
            title = combined["title"]
        else:
            # Generate a title based on description
            words = description.split()
            if len(words) > 3:
                title = " ".join(words[:3]) + "..."
            else:
                title = description
                
            # Make sure key information is in the title if it's not already
            if key.lower() not in title.lower():
                title += f" in {key}"
        
        # Build instruments array from available parts
        instruments = []
        
        # Add melody
        if melody and "instrument" in melody:
            instruments.append(melody["instrument"])
        
        # Add chords
        if chords and "instrument" in chords:
            instruments.append(chords["instrument"])
        
        # Add drums
        if drums and "instrument" in drums:
            instruments.append(drums["instrument"])
        
        # Add counter melody
        if counter_melody and "instrument" in counter_melody:
            instruments.append(counter_melody["instrument"])
        
        
        # Build the final description
        return {
            "title": title,
            "tempo": tempo,
            "key": key,
            "time_signature": self.default_time_signature,
            "instruments": instruments
        }
    
    async def _generate_midi(self, music_description: Dict[str, Any]) -> Dict[str, Any]:
        """Generate MIDI files from the music description and return a detailed JSON."""
        logger.debug(f"Generating MIDI for: {music_description.get('title', 'Untitled')}")
        
        # Generate separate MIDI files
        results = await midi_generator.generate_midi_separate(music_description)
        
        # Get the directory path from the first result
        dir_path = os.path.dirname(results[0]["file_path"]) if results else ""
        
        # Create a structured response with all track information
        tracks = []
        composition_dir = os.path.basename(dir_path)
        
        # Create a comprehensive JSON with all track and note data
        for result in results:
            # Get the instrument patterns from the original description
            instrument_patterns = []
            for instrument in music_description.get("instruments", []):
                if instrument["name"] == result["instrument_name"]:
                    instrument_patterns = instrument.get("patterns", [])
                    break
            
            # Extract note data from the patterns
            notes_data = []
            for pattern in instrument_patterns:
                pattern_type = pattern.get("type", "unknown")
                pattern_notes = pattern.get("notes", [])
                
                for note in pattern_notes:
                    note_data = {
                        "pitch": note.get("pitch"),
                        "start": note.get("start"),
                        "duration": note.get("duration"),
                        "velocity": note.get("velocity")
                    }
                    
                    # Add any additional data specific to this note type
                    if "drum_name" in note:
                        note_data["drum_name"] = note["drum_name"]
                    
                    notes_data.append(note_data)
            
            track_data = {
                "instrument_name": result["instrument_name"],
                "soundfont_name": result["soundfont_name"],
                "file_path": result["file_path"],
                "track_count": result["track_count"],
                "midi_data": result["midi_data"],
                "download_url": f"/download/{composition_dir}/{os.path.basename(result['file_path'])}",
                "channel": next((instr.get("channel", 0) for instr in music_description.get("instruments", []) 
                                if instr["name"] == result["instrument_name"]), 0),
                "program": next((instr.get("program", 0) for instr in music_description.get("instruments", []) 
                               if instr["name"] == result["instrument_name"]), 0),
                "pattern_types": [pattern.get("type", "unknown") for pattern in instrument_patterns],
                "notes": notes_data
            }
            
            tracks.append(track_data)
        
        return {
            "title": music_description["title"],
            "key": music_description.get("key", "unknown"),
            "tempo": music_description.get("tempo", 120),
            "time_signature": music_description.get("time_signature", [4, 4]),
            "directory": dir_path,
            "tracks": tracks,
            "detailed_json": {
                "title": music_description["title"],
                "key": music_description.get("key", "unknown"),
                "tempo": music_description.get("tempo", 120),
                "time_signature": music_description.get("time_signature", [4, 4]),
                "instruments": music_description.get("instruments", [])
            }
        }
    
    def _get_key_info(self, key: str) -> Dict[str, Any]:
        """Get information about a musical key."""
        # Normalize key name
        normalized_key = key.strip()
        
        # Use the specified key or fall back to default
        if normalized_key not in self.KEY_MAP:
            logger.warning(f"Unknown key: {normalized_key}, falling back to {self.default_key}")
            normalized_key = self.default_key
            
        return self.KEY_MAP[normalized_key]
    
    def _get_scale_note(self, key: str, scale_degree: int, octave: int = 0) -> int:
        """Get a note from the scale at the given scale degree and octave offset."""
        key_info = self._get_key_info(key)
        root = key_info["root"]
        scale = key_info["scale"]
        
        # Calculate which octave and scale degree to use
        octave_offset = (scale_degree // len(scale)) + octave
        scale_index = scale_degree % len(scale)
        
        # Calculate the MIDI note number
        note = root + scale[scale_index] + (octave_offset * 12)
        
        return note
    
    def _get_chord(self, key: str, scale_degree: int, octave: int = 0) -> List[int]:
        """Get a chord from the scale at the given scale degree."""
        key_info = self._get_key_info(key)
        scale = key_info["scale"]
        
        # Determine if we're in a major or minor key
        key_type = "major" if "major" in key.lower() else "minor"
        
        # Get chord type based on scale degree
        # In real implementation, this would be more sophisticated
        chord_type = "major" if scale_degree % 7 in [0, 4, 5] else "minor"
        
        # Get chord intervals
        intervals = self.CHORD_TYPES[key_type][chord_type]
        
        # Generate the chord notes
        chord_notes = []
        for interval in intervals:
            chord_notes.append(self._get_scale_note(key, scale_degree + interval, octave))
            
        return chord_notes
        
    def _check_notes_in_key(self, notes: List[Dict[str, Any]], key: str) -> Tuple[bool, List[Dict[str, Any]]]:
        """
        Check if notes are in the specified key.
        
        Args:
            notes: List of note dictionaries with pitch and other properties
            key: Key name like "C major" or "D minor"
            
        Returns:
            Tuple of (is_valid, problem_notes)
        """
        # Get key information
        key_info = self._get_key_info(key)
        key_root = key_info["root"] % 12  # Normalize to 0-11 range
        key_scale = key_info["scale"]
        
        # Calculate permitted note values (all octaves of the scale)
        permitted_pitches = set()
        for octave in range(-1, 10):  # Reasonable MIDI range
            for scale_offset in key_scale:
                pitch = key_root + scale_offset + (octave * 12)
                if 0 <= pitch <= 127:  # Valid MIDI pitch range
                    permitted_pitches.add(pitch)
        
        # Check each note against permitted pitches
        all_in_key = True
        problem_notes = []
        
        for note in notes:
            pitch = note.get("pitch")
            if pitch is not None and pitch not in permitted_pitches:
                all_in_key = False
                problem_notes.append(note)
        
        return all_in_key, problem_notes
    
    def _parse_note_name(self, note_name: str) -> int:
        """
        Parse a note name like "C4" or "F#3" into a MIDI pitch value.
        
        Args:
            note_name: Note name in format like "C4", "F#3", "Bb5"
            
        Returns:
            MIDI pitch value (0-127)
        """
        # Define base values for C in each octave
        c_values = {-1: 0, 0: 12, 1: 24, 2: 36, 3: 48, 4: 60, 5: 72, 6: 84, 7: 96, 8: 108, 9: 120}
        
        # Parse note name and octave
        if len(note_name) < 2:
            raise ValueError(f"Invalid note name: {note_name}")
            
        # Handle sharps and flats
        if len(note_name) >= 3 and (note_name[1] == '#' or note_name[1] == 'b'):
            note = note_name[0:2]
            octave = int(note_name[2:])
        else:
            note = note_name[0]
            octave = int(note_name[1:])
            
        # Get base value for C in this octave
        try:
            c_value = c_values[octave]
        except KeyError:
            raise ValueError(f"Octave out of range: {octave}")
            
        # Calculate offset from C
        note_offsets = {
            'C': 0, 'C#': 1, 'Db': 1, 
            'D': 2, 'D#': 3, 'Eb': 3,
            'E': 4, 'E#': 5, 'Fb': 4,
            'F': 5, 'F#': 6, 'Gb': 6,
            'G': 7, 'G#': 8, 'Ab': 8,
            'A': 9, 'A#': 10, 'Bb': 10,
            'B': 11, 'B#': 0, 'Cb': 11
        }
        
        try:
            offset = note_offsets[note]
        except KeyError:
            raise ValueError(f"Invalid note name: {note}")
            
        # Calculate MIDI pitch
        pitch = c_value + offset
        
        # Validate pitch is in MIDI range
        if pitch < 0 or pitch > 127:
            raise ValueError(f"Pitch out of MIDI range (0-127): {pitch}")
            
        return pitch
    
    def _convert_duration_to_beats(self, duration_str, time_signature: List[int] = [4, 4]) -> float:
        """
        Convert a duration string or number ("quarter", "half", 1.0, 2.0, etc.) to beats.
        
        Args:
            duration_str: Duration as string (whole, half, quarter, eighth, etc.) or numeric value in beats
            time_signature: Time signature as [numerator, denominator]
            
        Returns:
            Duration in beats
        """
        # If duration_str is already a number, return it directly
        if isinstance(duration_str, (int, float)):
            return float(duration_str)
            
        # Standard durations in beats (assuming 4/4 time)
        duration_map = {
            "whole": 4.0,
            "half": 2.0,
            "quarter": 1.0,
            "eighth": 0.5,
            "sixteenth": 0.25,
            "thirtysecond": 0.125,
            "sixtyfourth": 0.0625,
            
            # Allow numerical fractions too
            "1": 4.0,
            "2": 2.0,
            "4": 1.0,
            "8": 0.5,
            "16": 0.25,
            "32": 0.125,
            "64": 0.0625,
            
            # Dotted durations
            "dotted whole": 6.0,
            "dotted half": 3.0,
            "dotted quarter": 1.5,
            "dotted eighth": 0.75,
            "dotted sixteenth": 0.375,
            
            # Triplets
            "half triplet": 4/3,
            "quarter triplet": 2/3,
            "eighth triplet": 1/3,
            "sixteenth triplet": 1/6
        }
        
        # Try to get the duration from the map
        duration = duration_map.get(str(duration_str).lower())
        
        # Handle dotted notes specified with a dot
        if not duration and isinstance(duration_str, str) and duration_str.endswith("."):
            base_dur = duration_map.get(duration_str[:-1].lower())
            if base_dur:
                duration = base_dur * 1.5
        
        # If not found, try to parse as a float
        if not duration:
            try:
                duration = float(duration_str)
            except (ValueError, TypeError):
                raise ValueError(f"Unknown duration: {duration_str}")
        
        # Adjust for time signature if not 4/4
        if time_signature != [4, 4]:
            # Convert to standard beats
            beat_value = 4.0 / time_signature[1]
            duration = duration * beat_value
        
        return duration
    
    # Tool handlers
    async def _handle_create_melody(self, args: Dict[str, Any], tempo: int, key: str) -> Dict[str, Any]:
        """Handle create_melody tool."""
        instrument_name = args.get("instrument_name", "Piano")
        description = args.get("description", "")
        duration_beats = args.get("duration_beats", 16)
        program = args.get("program", 0)  # Default to acoustic piano
        
        # Log the exact input from Claude for debugging
        logger.info(f"RAW MELODY INPUT: {json.dumps(args)}")
        
        # Required parameters for direct note input
        note_names = args.get("note_names", [])  # ["C4", "D4", "E4", ...]
        note_durations = args.get("note_durations", [])  # ["quarter", "eighth", ...]
        note_velocities = args.get("note_velocities", [])  # [80, 90, 70, ...]
        time_signature = args.get("time_signature", [4, 4])
        
        notes = []  # No default notes - Claude must provide them
        
        logger.debug(f"Creating melody for {instrument_name}: {description[:30]}...")
        logger.info(f"Claude provided: {len(note_names)} notes, {len(note_durations)} durations, {len(note_velocities)} velocities")
        
        if note_names:
            logger.info(f"Sample notes: {note_names[:5]}")
        if note_durations:
            logger.info(f"Sample durations: {note_durations[:5]}")
        
        # Verify Claude provided the required note specifications
        if not note_names or not note_durations or len(note_names) != len(note_durations):
            logger.error("Melody creation requires note_names and note_durations of equal length")
            raise ValueError(
                "Melody creation requires specific notes. Please provide 'note_names' (e.g., ['C4', 'D4', 'E4']) "
                "and 'note_durations' (e.g., ['quarter', 'eighth', 'quarter']) of equal length."
            )
        
        # Convert the provided note specifications to MIDI notes
        try:
            current_time = 0.0
            
            # Use provided velocities or default to 80
            velocities = note_velocities if len(note_velocities) == len(note_names) else [80] * len(note_names)
            
            for i, (name, duration_str, velocity) in enumerate(zip(note_names, note_durations, velocities)):
                # Parse note name to MIDI pitch
                pitch = self._parse_note_name(name)
                
                # Convert duration string to beats
                duration = self._convert_duration_to_beats(duration_str, time_signature)
                
                # Create note
                notes.append({
                    "pitch": pitch,
                    "start": current_time,
                    "duration": duration,
                    "velocity": velocity
                })
                
                # Update current time
                current_time += duration
            
            logger.info(f"Converted {len(notes)} notes from text notation")
        except Exception as e:
            logger.error(f"Error converting notes from text: {str(e)}")
            raise ValueError(f"Failed to convert note specifications: {str(e)}")
        
        # Verify notes are in the specified key
        is_valid, problem_notes = self._check_notes_in_key(notes, key)
        if not is_valid:
            problem_details = [f"{note['pitch']} (MIDI note {note.get('pitch')})" for note in problem_notes[:5]]
            logger.warning(f"Found {len(problem_notes)} notes not in key {key}: {', '.join(problem_details)}")
        
        # Create the instrument with the melody
        instrument = {
            "name": instrument_name,
            "soundfont_name": instrument_name,
            "program": program,
            "channel": 0,
            "patterns": [
                {
                    "type": "melody",
                    "notes": notes
                }
            ]
        }
        
        return {
            "part_type": "melody",
            "instrument_name": instrument_name,
            "description": description,
            "duration_beats": duration_beats,
            "instrument": instrument
        }
    
    def _parse_chord_name(self, chord_name: str, key: str, octave: int = 3) -> List[int]:
        """
        Parse a chord name (like "Cmaj", "G7", "Am") and return the MIDI notes.
        Supports major, minor, dominant 7th, major 7th, minor 7th, diminished, and augmented chords.
        
        Args:
            chord_name: Chord name (e.g., "Cmaj", "G7", "Am")
            key: The current key (for context)
            octave: Base octave for the chord
            
        Returns:
            List of MIDI pitch values for the chord notes
        """
        # Root note is always the first character
        root_note = chord_name[0].upper()
        
        # Check for sharp or flat
        if len(chord_name) > 1 and (chord_name[1] == '#' or chord_name[1] == 'b'):
            root_note += chord_name[1]
            quality_start = 2
        else:
            quality_start = 1
            
        # Get the quality/type of the chord
        quality = chord_name[quality_start:].lower()
        
        # Map root note to MIDI note number
        note_to_number = {
            'C': 0, 'C#': 1, 'Db': 1, 
            'D': 2, 'D#': 3, 'Eb': 3,
            'E': 4, 'E#': 5, 'Fb': 4,
            'F': 5, 'F#': 6, 'Gb': 6,
            'G': 7, 'G#': 8, 'Ab': 8,
            'A': 9, 'A#': 10, 'Bb': 10,
            'B': 11, 'B#': 0, 'Cb': 11
        }
        
        try:
            root_number = note_to_number[root_note]
        except KeyError:
            raise ValueError(f"Invalid root note: {root_note}")
            
        # Calculate the MIDI note for the root in the specified octave
        root_midi = (octave + 1) * 12 + root_number
        
        # Determine intervals based on chord quality
        if quality == "" or quality == "maj" or quality == "major":
            # Major triad: root, major 3rd, perfect 5th
            intervals = [0, 4, 7]
        elif quality == "m" or quality == "min" or quality == "minor":
            # Minor triad: root, minor 3rd, perfect 5th
            intervals = [0, 3, 7]
        elif quality == "7" or quality == "dom7":
            # Dominant 7th: root, major 3rd, perfect 5th, minor 7th
            intervals = [0, 4, 7, 10]
        elif quality == "maj7" or quality == "M7":
            # Major 7th: root, major 3rd, perfect 5th, major 7th
            intervals = [0, 4, 7, 11]
        elif quality == "m7" or quality == "min7":
            # Minor 7th: root, minor 3rd, perfect 5th, minor 7th
            intervals = [0, 3, 7, 10]
        elif quality == "dim" or quality == "°":
            # Diminished: root, minor 3rd, diminished 5th
            intervals = [0, 3, 6]
        elif quality == "dim7" or quality == "°7":
            # Diminished 7th: root, minor 3rd, diminished 5th, diminished 7th
            intervals = [0, 3, 6, 9]
        elif quality == "aug" or quality == "+":
            # Augmented: root, major 3rd, augmented 5th
            intervals = [0, 4, 8]
        elif quality == "sus4":
            # Suspended 4th: root, perfect 4th, perfect 5th
            intervals = [0, 5, 7]
        elif quality == "sus2":
            # Suspended 2nd: root, major 2nd, perfect 5th
            intervals = [0, 2, 7]
        else:
            # Default to major triad if unknown quality
            logger.warning(f"Unknown chord quality: {quality}, defaulting to major triad")
            intervals = [0, 4, 7]
            
        # Generate the MIDI notes for the chord
        return [root_midi + interval for interval in intervals]
        
    async def _handle_create_chords(self, args: Dict[str, Any], tempo: int, key: str) -> Dict[str, Any]:
        """Handle create_chords tool."""
        instrument_name = args.get("instrument_name", "Piano")
        description = args.get("description", "")
        duration_beats = args.get("duration_beats", 16)
        program = args.get("program", 0)  # Default to acoustic piano
        
        # Log the exact input from Claude for debugging
        logger.info(f"RAW CHORD INPUT: {json.dumps(args)}")
        
        # Required chord specifications from Claude
        chord_names = args.get("chord_names", [])  # ["Cmaj", "G7", "Am", etc.]
        chord_durations = args.get("chord_durations", [])  # ["whole", "whole", etc.]
        velocities = args.get("velocities", [])  # Optional velocity per chord
        
        logger.debug(f"Creating chords for {instrument_name}: {description[:30]}...")
        logger.info(f"Claude provided: {len(chord_names)} chords, {len(chord_durations)} durations, {len(velocities)} velocities")
        
        if chord_names:
            logger.info(f"Sample chords: {chord_names[:5]}")
        if chord_durations:
            logger.info(f"Sample durations: {chord_durations[:5]}")
        
        # Verify Claude provided the required chord specifications
        if not chord_names or not chord_durations or len(chord_names) != len(chord_durations):
            logger.error("Chord creation requires chord_names and chord_durations of equal length")
            raise ValueError(
                "Chord progression creation requires specific chords. Please provide 'chord_names' "
                "(e.g., ['Amin', 'Fmaj', 'G7']) and 'chord_durations' (e.g., ['whole', 'whole', 'whole']) "
                "of equal length."
            )
        
        # Process chord specifications
        notes = []
        try:
            current_time = 0.0
            
            # Use provided velocities or default to 70
            if not velocities or len(velocities) != len(chord_names):
                velocities = [70] * len(chord_names)
                
            # Process each chord
            for i, (chord_name, duration_str, velocity) in enumerate(zip(chord_names, chord_durations, velocities)):
                # Parse chord name to get MIDI notes
                # Use octave 3 for lower registers (C3, E3, etc.) which sound better for chords
                chord_notes = self._parse_chord_name(chord_name, key, octave=3)
                
                # Convert duration string to beats
                duration = self._convert_duration_to_beats(duration_str)
                
                # Add each note of the chord
                for pitch in chord_notes:
                    notes.append({
                        "pitch": pitch,
                        "start": current_time,
                        "duration": duration,
                        "velocity": velocity
                    })
                
                # Move to the next chord
                current_time += duration
            
            logger.info(f"Processed {len(chord_names)} chords into {len(notes)} notes")
        except Exception as e:
            logger.error(f"Error processing chords: {str(e)}")
            raise ValueError(f"Failed to process chord specifications: {str(e)}")
        
        # Create the instrument with the chords
        instrument = {
            "name": instrument_name,
            "soundfont_name": instrument_name,
            "program": program,
            "channel": 1,  # Use channel 1 for chords
            "patterns": [
                {
                    "type": "chords",
                    "notes": notes
                }
            ]
        }
        
        return {
            "part_type": "chords",
            "instrument_name": instrument_name,
            "description": description,
            "duration_beats": duration_beats,
            "instrument": instrument
        }
    
    async def _handle_create_drums(self, args: Dict[str, Any], tempo: int, key: str) -> Dict[str, Any]:
        """Handle create_drums tool."""
        description = args.get("description", "")
        duration_beats = args.get("duration_beats", 16)
        intensity = args.get("intensity", "medium")
        
        # Log the exact input from Claude for debugging
        logger.info(f"RAW DRUM INPUT: {json.dumps(args)}")
        
        # Required parameters for direct drum note input
        drum_names = args.get("drum_names", [])  # ["kick", "snare", "closed hi-hat", ...]
        drum_durations = args.get("drum_durations", [])  # ["quarter", "eighth", ...]
        drum_velocities = args.get("drum_velocities", [])  # [90, 100, 80, ...]
        
        logger.debug(f"Creating drums: {description[:30]}...")
        logger.info(f"Claude provided: {len(drum_names)} drum names, {len(drum_durations)} durations")
        
        # Verify Claude provided the required drum specifications
        if not drum_names or not drum_durations or len(drum_names) != len(drum_durations):
            logger.error("Drum creation requires drum_names and drum_durations of equal length")
            raise ValueError(
                "Drum pattern creation requires specific drums. Please provide 'drum_names' "
                "(e.g., ['kick', 'snare', 'closed hi-hat', 'open hi-hat']) and "
                "'drum_durations' (e.g., ['quarter', 'eighth', 'quarter']) of equal length."
            )
        
        # Process the drum pattern from Claude's input
        notes = []
        try:
            current_time = 0.0
            
            # Use provided velocities or default to 90
            velocities = drum_velocities if len(drum_velocities) == len(drum_names) else [90] * len(drum_names)
            
            for i, (drum_name, duration_str, velocity) in enumerate(zip(drum_names, drum_durations, velocities)):
                # Convert duration string to beats
                duration = self._convert_duration_to_beats(duration_str)
                
                # Create note - use a simple index for pitch to distinguish different drums
                # This way each drum gets a unique "pitch" value
                pitch = i % 127  # Ensure it stays in MIDI pitch range
                
                # Create note
                notes.append({
                    "pitch": pitch,
                    "start": current_time,
                    "duration": duration,
                    "velocity": velocity,
                    "drum_name": drum_name  # Store the original drum name
                })
                
                # Update current time
                current_time += duration
            
            logger.info(f"Converted {len(notes)} drum notes from Claude's specifications")
        except Exception as e:
            logger.error(f"Error converting drum notes: {str(e)}")
            raise ValueError(f"Failed to convert drum specifications: {str(e)}")
        
        # Create the instrument with the drum pattern
        instrument = {
            "name": "Drums",
            "soundfont_name": "Standard Drum Kit",
            "program": "percussion",
            "channel": 9,  # Channel 10 (zero-indexed as 9) for percussion
            "patterns": [
                {
                    "type": "drums",
                    "notes": notes
                }
            ]
        }
        
        return {
            "part_type": "drums",
            "description": description,
            "duration_beats": duration_beats,
            "intensity": intensity,
            "instrument": instrument
        }
    
    async def _handle_create_counter_melody(self, args: Dict[str, Any], tempo: int, key: str) -> Dict[str, Any]:
        """Handle create_counter_melody tool."""
        instrument_name = args.get("instrument_name", "Flute")
        description = args.get("description", "")
        duration_beats = args.get("duration_beats", 16)
        program = args.get("program", 73)  # Default to flute
        
        # Log the exact input from Claude for debugging
        logger.info(f"RAW COUNTER-MELODY INPUT: {json.dumps(args)}")
        
        # Required parameters for direct note input
        note_names = args.get("note_names", [])  # ["C5", "D5", "E5", ...]
        note_durations = args.get("note_durations", [])  # ["quarter", "eighth", ...]
        note_velocities = args.get("note_velocities", [])  # [80, 90, 70, ...]
        time_signature = args.get("time_signature", [4, 4])
        
        logger.debug(f"Creating counter-melody for {instrument_name}: {description[:30]}...")
        logger.info(f"Claude provided: {len(note_names)} notes, {len(note_durations)} durations, {len(note_velocities)} velocities")
        
        if note_names:
            logger.info(f"Sample notes: {note_names[:5]}")
        if note_durations:
            logger.info(f"Sample durations: {note_durations[:5]}")
        
        # Verify Claude provided the required note specifications
        if not note_names or not note_durations or len(note_names) != len(note_durations):
            logger.error("Counter-melody creation requires note_names and note_durations of equal length")
            raise ValueError(
                "Counter-melody creation requires specific notes. Please provide 'note_names' (e.g., ['C5', 'D5', 'E5']) "
                "and 'note_durations' (e.g., ['quarter', 'eighth', 'quarter']) of equal length."
            )
        
        # Convert the provided note specifications to MIDI notes
        notes = []
        try:
            current_time = 0.0
            
            # Use provided velocities or default to 75 (counter-melody usually slightly softer)
            velocities = note_velocities if len(note_velocities) == len(note_names) else [75] * len(note_names)
            
            for i, (name, duration_str, velocity) in enumerate(zip(note_names, note_durations, velocities)):
                # Parse note name to MIDI pitch
                pitch = self._parse_note_name(name)
                
                # Convert duration string to beats
                duration = self._convert_duration_to_beats(duration_str, time_signature)
                
                # Create note
                notes.append({
                    "pitch": pitch,
                    "start": current_time,
                    "duration": duration,
                    "velocity": velocity
                })
                
                # Update current time
                current_time += duration
            
            logger.info(f"Converted {len(notes)} counter-melody notes from text notation")
        except Exception as e:
            logger.error(f"Error converting counter-melody notes from text: {str(e)}")
            raise ValueError(f"Failed to convert counter-melody note specifications: {str(e)}")
        
        # Create the instrument with the counter-melody
        instrument = {
            "name": instrument_name,
            "soundfont_name": instrument_name,
            "program": program,
            "channel": 2,
            "patterns": [
                {
                    "type": "counter_melody",
                    "notes": notes
                }
            ]
        }
        
        return {
            "part_type": "counter_melody",
            "instrument_name": instrument_name,
            "description": description,
            "duration_beats": duration_beats,
            "instrument": instrument
        }
    
    async def _handle_combine_parts(self, args: Dict[str, Any], tempo: int, key: str) -> Dict[str, Any]:
        """Handle combine_parts tool."""
        title = args.get("title", "Untitled Composition")
        melody = args.get("melody", {})
        chords = args.get("chords", {})
        drums = args.get("drums", {})
        counter_melody = args.get("counter_melody", {})
        
        logger.debug(f"Combining parts for: {title}")
        
        # Simply return the combined structure - actual combination happens in _create_final_description
        return {
            "title": title,
            "melody": melody,
            "chords": chords,
            "drums": drums,
            "counter_melody": counter_melody
        }
    
    async def _handle_determine_musical_parameters(self, args: Dict[str, Any], tempo: int, key: str) -> Dict[str, Any]:
        """
        Handle determine_musical_parameters tool.
        Uses Claude to determine the appropriate key and tempo based on the description.
        """
        description = args.get("description", "")
        logger.debug(f"Determining musical parameters for: {description[:50]}...")
        
        # If tempo and key are already provided, just return them
        if tempo is not None and key is not None and key != self.default_key:
            logger.info(f"Using provided parameters: tempo={tempo}, key={key}")
            return {
                "tempo": tempo,
                "key": key,
                "time_signature": self.default_time_signature,
                "explanation": "Using provided parameters"
            }
        
        # Otherwise, ask Claude to determine appropriate parameters
        try:
            if not self.client:
                logger.warning("No API client available, using defaults")
                return {
                    "tempo": self.default_tempo,
                    "key": self.default_key,
                    "time_signature": self.default_time_signature,
                    "explanation": "Using defaults (no API client available)"
                }
                
            # Create a specific prompt for Claude to determine musical parameters
            system_prompt = """You are a music theory expert. 
Your task is to determine the most appropriate musical key and tempo (BPM) for a piece of music based on its description.
Respond in JSON format with the following fields:
- key: The musical key that would work best (e.g., "C major", "F# minor", etc.)
- tempo: The tempo in BPM as an integer between 60 and 200
- explanation: A brief explanation of your choices

Consider the following when determining parameters:
- Genre conventions (e.g., EDM typically has higher BPM than ballads)
- Mood/emotion (e.g., minor keys for sad/dark pieces, major for upbeat/happy)
- Energy level (e.g., faster tempo for energetic music, slower for relaxed)
- Any specific key or tempo mentioned in the description should be used
"""
            
            response = self.client.messages.create(
                model=self.model,
                max_tokens=1000,
                temperature=0.3,
                system=system_prompt,
                messages=[{
                    "role": "user",
                    "content": f"Determine appropriate musical parameters for the following description: {description}"
                }]
            )
            
            # Require a valid response and parse it strictly without fallbacks
            if not response.content:
                raise ValueError("No content received from Claude API")
            
            content = response.content[0].text
            
            # Try to parse as JSON - throw error on failure
            # Find JSON content (sometimes Claude wraps it in ```json ... ```)
            import re
            json_match = re.search(r'```json\s*(.*?)\s*```', content, re.DOTALL)
            if json_match:
                content = json_match.group(1)
            
            try:
                result = json.loads(content)
            except json.JSONDecodeError:
                logger.error(f"Failed to parse Claude's response as JSON: {content[:100]}")
                raise ValueError(f"Claude's response could not be parsed as JSON: {content[:100]}")
            
            # Validate required fields
            if "key" not in result:
                raise ValueError("Claude didn't provide a musical key")
            
            if "tempo" not in result:
                raise ValueError("Claude didn't provide a tempo")
            
            # Extract and validate key
            determined_key = result["key"]
            if determined_key not in self.KEY_MAP:
                raise ValueError(f"Claude provided an invalid musical key: {determined_key}")
            
            # Extract and validate tempo
            determined_tempo = result["tempo"]
            if not isinstance(determined_tempo, int) or determined_tempo < 40 or determined_tempo > 220:
                raise ValueError(f"Claude provided an invalid tempo: {determined_tempo}")
            
            logger.info(f"Claude determined key={determined_key}, tempo={determined_tempo}")
            
            return {
                "key": determined_key,
                "tempo": determined_tempo,
                "time_signature": self.default_time_signature,
                "explanation": result.get("explanation", "Parameters determined by musical analysis")
            }
                
        except Exception as e:
            logger.error(f"Error determining musical parameters: {str(e)}")
            # Rethrow the error - no fallbacks
            raise
    
    async def _handle_search_soundfonts(self, args: Dict[str, Any], tempo: int, key: str) -> List[Dict[str, Any]]:
        """Handle search_soundfonts tool."""
        query = args.get("query", "")
        logger.debug(f"Searching soundfonts for: {query}")
        
        return find_soundfonts(query)

# Create a singleton instance
music_tools_service = MusicToolsService()

# Export function for easier access