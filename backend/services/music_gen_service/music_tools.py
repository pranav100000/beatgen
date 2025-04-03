"""
Specialized music generation tools for AutoCompose.
Provides focused tools for creating different musical components.
"""
import os
import json
import asyncio
import logging
import traceback
from typing import Dict, List, Any, Optional, Callable, Tuple
from dotenv import load_dotenv
from fastapi import Request
import music21

from services.music_gen_service.music_researcher import MusicResearcher
from services.music_gen_service.music_utils import get_mode_intervals
from services.music_gen_service.music_tool_prompts import get_create_melody_prompt, get_select_instruments_prompt
from services.soundfont_service.soundfont_service import soundfont_service
# Load environment variables from .env file
load_dotenv()

from anthropic import Anthropic

logger = logging.getLogger(__name__)

# Initialize MIDI generator

# Define specialized music tools
MUSIC_TOOLS = [
    {
        "name": "determine_musical_parameters",
        "description": "Uses an AI agent to determine appropriate musical parameters (key, tempo) for a given music description. The agent will also determine the mode of the key. Provide as much detail as possible in the description to help the agent make the best decision.",
        "input_schema": {
            "type": "object",
            "properties": {
                "description": {
                    "type": "string",
                    "description": "Detailed description of the music to be composed"
                }
            },
            "required": ["description"]
        }
    },
    {
        "name": "get_chord_progression",
        "description": "Uses an AI agent to get a chord progression for a given music description.",
        "input_schema": {
            "type": "object",
            "properties": {
                "description": {
                    "type": "string",
                    "description": "Detailed description of the music to be composed"
                }
            },
            "required": ["description"]
        }
    },
    {
        "name": "create_melody2",
        "description": "Creates a melodic pattern based on description. Uses AI to generate interval-based melody that's appropriate for the key.",
        "input_schema": {
            "type": "object",
            "properties": {
                "instrument_name": {
                    "type": "string",
                    "description": "Name of the instrument (e.g., 'Piano', 'Violin')"
                },
                "description": {
                    "type": "string",
                    "description": "Detailed description of the melody's character (e.g., 'uplifting and energetic', 'melancholic with moments of hope')"
                },
                "mood": {
                    "type": "string",
                    "description": "Emotional quality of the melody (e.g., 'joyful', 'melancholic', 'suspenseful', 'serene')"
                },
                "tempo_character": {
                    "type": "string",
                    "description": "Speed character (e.g., 'slow', 'moderate', 'fast')"
                },
                "rhythm_type": {
                    "type": "string",
                    "description": "Type of rhythm (e.g., 'simple 4/4', 'swing', 'waltz 3/4', 'march', 'syncopated')"
                },
                "musical_style": {
                    "type": "string",
                    "description": "Musical style or genre (e.g., 'classical', 'jazz', 'folk', 'pop')"
                },
                "melodic_character": {
                    "type": "string",
                    "description": "Character of the melody (e.g., 'flowing', 'staccato', 'legato', 'jumpy', 'smooth')"
                },
                "duration_beats": {
                    "type": "integer",
                    "description": "Length of the melody in beats"
                }
            },
            "required": ["instrument_name", "description"]
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
    # {
    #     "name": "create_drums",
    #     "description": "Creates a drum pattern for percussion. YOU MUST specify drum_notes and drum_durations.",
    #     "input_schema": {
    #         "type": "object",
    #         "properties": {
    #             "description": {
    #                 "type": "string",
    #                 "description": "Description of the drum pattern (e.g., 'basic beat', 'complex rhythm')"
    #             },
    #             "duration_beats": {
    #                 "type": "integer",
    #                 "description": "Length of the drum pattern in beats"
    #             },
    #             "intensity": {
    #                 "type": "string",
    #                 "enum": ["light", "medium", "heavy"],
    #                 "description": "Intensity level of the drum pattern"
    #             },
    #             "drum_names": {
    #                 "type": "array",
    #                 "description": "REQUIRED: Array of drum names like ['kick', 'snare', 'closed hi-hat', 'open hi-hat', etc.]",
    #                 "items": {
    #                     "type": "string"
    #                 }
    #             },
    #             "drum_durations": {
    #                 "type": "array",
    #                 "description": "REQUIRED: Array of note durations like ['quarter', 'eighth', 'half', etc.] or numeric values in beats",
    #                 "items": {
    #                     "type": "string"
    #                 }
    #             },
    #             "drum_velocities": {
    #                 "type": "array",
    #                 "description": "Optional: Array of note velocities (1-127, with 64-100 being typical). Default is 90 if not provided.",
    #                 "items": {
    #                     "type": "integer"
    #                 }
    #             }
    #         },
    #         "required": ["description", "duration_beats", "drum_names", "drum_durations"]
    #     }
    # },
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
                # "duration_beats": {
                #     "type": "integer",
                #     "description": "Length of the counter-melody in beats"
                # },
                # "note_names": {
                #     "type": "array",
                #     "description": "REQUIRED: Array of note names like ['G3', 'Bb3', 'D4', 'G4', 'F4', etc.]",
                #     "items": {
                #         "type": "string"
                #     }
                # },
                # "note_durations": {
                #     "type": "array",
                #     "description": "REQUIRED: Array of note durations like ['quarter', 'eighth', 'half', etc.] or numeric values in beats",
                #     "items": {
                #         "type": "string"
                #     }
                # },
                # "note_velocities": {
                #     "type": "array",
                #     "description": "Optional: Array of note velocities (1-127, with 64-100 being typical). Default is 75 if not provided.",
                #     "items": {
                #         "type": "integer"
                #     }
                # }
            },
            "required": ["instrument_name", "description"]
        }
    },
    # {
    #     "name": "combine_parts",
    #     "description": "Combines all musical parts into a complete composition.",
    #     "input_schema": {
    #         "type": "object",
    #         "properties": {
    #             "title": {
    #                 "type": "string",
    #                 "description": "Title for the composition"
    #             },
    #             "melody": {
    #                 "type": "object",
    #                 "description": "The melody part created with create_melody"
    #             },
    #             "chords": {
    #                 "type": "object",
    #                 "description": "The chord part created with create_chords"
    #             },
    #             "drums": {
    #                 "type": "object",
    #                 "description": "The drum part created with create_drums"
    #             },
    #             "counter_melody": {
    #                 "type": "object",
    #                 "description": "The counter-melody part created with create_counter_melody"
    #             }
    #         },
    #         "required": ["title", "melody"]
    #     }
    # }
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
    
    def __init__(self, api_key: Optional[str] = None, model: str = "claude-3-7-sonnet-latest"):
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
        self.budget_model = "claude-3-5-sonnet-latest"
        self.client = Anthropic(api_key=self.api_key) if self.api_key else None
        self.researcher = MusicResearcher()
        
        # Fixed values for key musical parameters
        self.default_key = "Eb minor"
        self.default_tempo = 120
        self.default_time_signature = [4, 4]
        self.available_notes = []
        
        self.selected_instruments = {}
        self.allowed_intervals = []
        self.chord_progression = ""
        
        # Define tool handlers
        self.tool_handlers = {
            "determine_musical_parameters": self._handle_determine_musical_parameters,
            "get_chord_progression": self._handle_get_musical_params,
            #"create_melody": self._handle_create_melody,
            "create_melody2": self._handle_create_melody2,
            "create_chords": self._handle_create_chords,
            "create_drums": self._handle_create_drums,
            "create_counter_melody": self._handle_create_counter_melody,
            "combine_parts": self._handle_combine_parts,
            "search_soundfonts": self._handle_search_soundfonts,
            "select_instruments": self._handle_select_instruments
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
        
        try:
            soundfonts = await soundfont_service.get_public_soundfonts()
            soundfont_names = [soundfont.get("name") for soundfont in soundfonts]
            logger.info(f"Soundfonts: {soundfont_names}")
        except Exception as e:
            logger.error(f"Error getting soundfonts: {e}")
            return {
                "status": "error",
                "error": "Error getting soundfonts",
                "music_description": {
                    "title": f"Error generating music from: {description[:30]}",
                    "tempo": tempo or self.default_tempo,
                    "instruments": []
                }
            }
        
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
            initial_parameters_message = """IMPORTANT: Before creating any musical parts, FIRST use the determine_musical_parameters, tool 
to select the most appropriate key and tempo based on the music description. Next, use the get_chord_progression tool to get a chord progression for the key and tempo.
For example, a sad piece might be in a minor key at a slower tempo, while an energetic dance track
would use a higher tempo."""
        else:
            initial_parameters_message = f"You will create music in {use_key} at {use_tempo} BPM."
            
        # Create system prompt with proper escaping
        correct_example = '{"soundfont_names": ["MoogLeads.sf2", "DeepPad.sf2", "Standard Drum Kit"]}'
        incorrect_example = '{"soundfont_names": ["m", "o", "o", "g"]}'
        
        system_prompt = f"""You are a music composer creating a piece based on a text description.
{initial_parameters_message}

These are the soundfonts available to you:
{', '.join(soundfont_names)}

CRITICAL STEPS TO FOLLOW:
1. FIRST, you MUST use the determine_musical_parameters tool to determine the key and tempo based on the music description.
2. NEXT, you MUST use the get_chord_progression tool to get a chord progression for the key and tempo.
3. THEN, you MUST use the select_instruments tool to choose your instruments. The tool requires a PROPERLY FORMATTED ARRAY of complete soundfont names (not single letters or characters).
4. For each musical part you create, use ONLY complete soundfont names that you selected with the select_instruments tool
5. Ensure all data is properly formatted

Follow this workflow for creating a complete composition:
1. Use the select_instruments tool with a properly formatted array of complete soundfont names that you chose from the list above
2. Create the main melody - YOU MUST SPECIFY EXACT NOTES as note_names (like ["G3", "Bb3", "D4"]) and note_durations (like ["quarter", "eighth", "half"])
3. Create chord progressions - YOU MUST SPECIFY EXACT CHORDS as chord_names (like ["Gmin", "Bb", "D7"]) and chord_durations (like ["whole", "half"])
4. Add drums if appropriate - YOU MUST SPECIFY EXACT DRUMS as drum_names (like ["kick", "snare", "hi-hat"]) and drum_durations (like ["quarter", "quarter", "eighth"])
5. Consider adding a counter-melody if it enhances the piece - also specify exact notes

CREATE ONLY VALID MUSICAL DATA:
- Ensure notes field is always a valid list, never None
- Ensure instrument field is always a string, never a dictionary
- Never include None values in any lists
- Only use instruments that you've selected with the select_instruments tool

Create melodies, chords, and drum patterns that truly match the musical style described, being careful to use appropriate notes for the specified key ({use_key})."""
        
        try:
            # Start with initial user message
            messages = [{
                "role": "user",
                "content": f"""Please compose music based on this description: {description}

IMPORTANT: First use the select_instruments tool to choose the soundfonts you'll use, then create the music.
For the select_instruments tool:
- Use COMPLETE instrument names from the soundfont list provided
- Pass them as a properly formatted array like: {{"soundfont_names": ["Piano.sf2", "Guitar.sf2"]}}
- DO NOT split names into individual characters or letters

Remember to follow these steps:
1. First select soundfonts using the select_instruments tool with COMPLETE names
2. Then create a melody, add chords, and other elements using only the selected instruments
3. Ensure all data is properly formatted with no None values"""
            }]
            
            # Track conversation to build up the composition in stages
            completed = False
            max_iterations = 10
            iterations = 0
            
            while not completed and iterations < max_iterations:
                iterations += 1
                logger.debug(f"Composition iteration {iterations}")
                
                # # Log the request to Claude for debugging
                # logger.info("========== SENDING TO CLAUDE ==========")
                # logger.info(f"System Prompt: {system_prompt}")
                # logger.info(f"Messages: {json.dumps(messages, indent=2)}")
                # logger.info(f"Tools: {json.dumps(MUSIC_TOOLS, indent=2)}")
                # logger.info("======================================")
                
                # Make API call
                response = self.client.messages.create(
                    model=self.model,
                    max_tokens=20000, 
                    temperature=1,
                    system=system_prompt,
                    messages=messages,
                    tools=MUSIC_TOOLS + [get_select_instruments_prompt(soundfont_names)],
                    thinking={
                        "type": "enabled",
                        "budget_tokens": 16000
                    },
                )
                
                # Simple log of Claude's complete response for debugging
                logger.info(f"CLAUDE RESPONSE: {response}")
                
                # Log the full Claude response for debugging
                logger.info("========== CLAUDE RESPONSE ==========")
                logger.info(f"Response object: {response}")
                
                # Log individual content blocks
                for idx, block in enumerate(response.content):
                    logger.info(f"Content Block {idx+1}:")
                    logger.info(f"  Type: {block.type if hasattr(block, 'type') else 'unknown'}")
                    
                    if hasattr(block, 'type') and block.type == 'text':
                        logger.info(f"  Text: {block.text[:500]}...")
                    elif hasattr(block, 'type') and block.type == 'tool_use':
                        logger.info(f"  Tool: {block.name}")
                        logger.info(f"  Input: {json.dumps(block.input, indent=2)}")
                
                logger.info("=======================================")
                
                # Add model's response to conversation
                content_text = ""
                has_tool_use_block = False
                
                # Check for tool use blocks to determine whether the response contains tools
                for content_block in response.content:
                    if hasattr(content_block, 'type') and content_block.type == 'tool_use':
                        has_tool_use_block = True
                        break
                
                # Extract text content if present
                for content_block in response.content:
                    if hasattr(content_block, 'type') and content_block.type == 'text':
                        content_text = content_block.text
                        break
                
                # Handle case where Claude sends only a tool_use block with no text
                # This is valid - Claude is directly using the tool as instructed
                if not content_text and has_tool_use_block:
                    logger.info("Claude sent a tool call without text content - this is ok")
                    content_text = "Using tool directly without description."
                # Throw error if no content AND no tool use - that's an actual error
                elif not content_text:
                    raise ValueError("Received empty content from Claude API. Failing to ensure we fix the underlying issue.")
                
                assistant_message = {
                    "role": "assistant",
                    "content": content_text
                }
                
                messages.append(assistant_message)
                
                # Process tool use blocks
                tool_responses = []
                has_tool_use = False
                
                # Count the number of tool_use blocks for logging
                tool_use_blocks = [block for block in response.content if hasattr(block, 'type') and block.type == 'tool_use']
                logger.info(f"Found {len(tool_use_blocks)} tool_use blocks in the response")
                
                for content_block in response.content:
                    if hasattr(content_block, 'type') and content_block.type == 'tool_use':
                        has_tool_use = True
                        tool_name = content_block.name
                        tool_args = content_block.input
                        tool_id = content_block.id
                        
                        # Full detailed logging of tool call
                        logger.info(f"Tool use details:")
                        logger.info(f"  Tool name: {tool_name}")
                        logger.info(f"  Tool ID: {tool_id}")
                        logger.info(f"  Tool args: {json.dumps(tool_args)[:200]}...")
                        logger.info(f"Processing tool use: {tool_name} with args: {json.dumps(tool_args)[:100]}...")
                        
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
                                    
                                    # Get notes for this key using music21
                                    key_notes = self.get_notes_for_key(use_key)
                                    
                                    # Create note suggestions string
                                    notes_str = ", ".join(key_notes.get("suggested_notes", ["C4", "D4", "E4", "F4", "G4", "A4", "B4"]))
                                    
                                    # Create chord suggestions string
                                    chords_str = ", ".join(key_notes.get("suggested_chords", ["C", "Dm", "F", "G"]))
                                    
                                    # Get all available notes for reference
                                    all_notes_str = ", ".join(key_notes.get("all_notes", []))
                                    
                                    # Update the system prompt with the new parameters and note suggestions
                                    system_prompt = f"""You are a music composer creating a piece in {use_key} at {use_tempo} BPM.

AVAILABLE NOTES IN THIS KEY:
- Recommended melody notes: {notes_str}
- Recommended chords: {chords_str}
- All available notes in this key: {all_notes_str}

Use the specialized music tools to create a complete composition:
1. First create the main melody - YOU MUST USE NOTES FROM THE KEY {use_key} as note_names (use the available notes listed above)
   Example format: note_names: ["G3", "Bb3", "D4"] and note_durations: ["quarter", "eighth", "half"]
   
2. Then create chord progressions - YOU MUST USE CHORDS FROM THE KEY {use_key} as chord_names (use the recommended chords listed above)
   Example format: chord_names: [{chords_str}] and chord_durations: ["whole", "half"]
   
3. Add drums if appropriate - specify exact drums as drum_names
   Example format: drum_names: ["kick", "snare", "hi-hat"] and drum_durations: ["quarter", "quarter", "eighth"]
   
4. Consider adding a counter-melody - also using notes from the key {use_key} (use the available notes listed above)

5. Finally combine all parts

IMPORTANT: Create melodies, chords, and drum patterns that truly match the musical style described, using ONLY the notes and chords appropriate for the key {use_key}."""
                                    
                                elif tool_name == "create_melody2":
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
                            logger.error(f"Tool args: {json.dumps(tool_args)}")
                            logger.error(f"error: {str(e)}")
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
            # midi_result = await self._generate_midi(music_description)
            
            # Create a comprehensive output JSON with all data
            output_json = {
                "status": "success",
                "title": music_description["title"],
                "description": description,
                "key": music_description.get("key", "unknown"),
                "tempo": music_description.get("tempo", 120),
                "time_signature": music_description.get("time_signature", [4, 4]),
                "tracks": music_description.get("tracks", []),
                "instruments": music_description.get("instruments", []),
                "music_description": music_description,
                "midi_result": [],
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
            
            # Create a more concise version without base64 data for easier reading
            readable_output = json.loads(json.dumps(output_json))
            for track in readable_output.get("tracks", []):
                if "midi_data" in track:
                    track["midi_data"] = "[base64 data removed for readability]"
            
            # Log the readable output for debugging
            logger.debug(f"Generated comprehensive JSON output with {len(music_description.get('instruments', []))} instruments")
            
            return {
                "tracks": [melody_part, chords_part, drums_part, counter_melody_part]
            }
            
            return output_json
                
        except Exception as e:
            logger.error(f"Error in music composition: {str(e)}")
            logger.error(f"Stack trace: {traceback.format_exc()}")
            error_description = {
                "title": f"Error generating music from: {description[:30]}",
                "tempo": use_tempo,
                "key": use_key,
                "time_signature": self.default_time_signature,
                "instruments": []
            }
            
            return {
                "tracks": [melody_part, chords_part, drums_part, counter_melody_part]
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
        
    def get_notes_for_key(self, key: str) -> Dict[str, Any]:
        """
        Get notes and chords for a musical key using music21 library.
        
        Args:
            key: Key name like "C major" or "F# minor"
            
        Returns:
            Dictionary with key information, available notes, and common chords
        """
        try:
            # Handle some common key format variations
            key = key.replace(' Major', ' major').replace(' Minor', ' minor')
            
            # Parse the key into music21 format
            # Extract the root note and mode
            parts = key.split()
            if len(parts) != 2:
                logger.warning(f"Invalid key format: {key}, using C major")
                root_str = "C"
                mode = "major"
            else:
                root_str = parts[0]
                mode = parts[1].lower()
            
            # Create a music21 key object
            if mode == "major":
                k = music21.key.Key(root_str)
            elif mode == "minor":
                k = music21.key.Key(root_str.lower())
            else:
                logger.warning(f"Unsupported mode: {mode}, using major")
                k = music21.key.Key(root_str)
            
            # Get the scale
            scale = k.getScale()
            scale_notes = scale.getPitches()
            
            # Format results
            result = {
                "key": key,
                "root": root_str,
                "mode": mode,
                "notes": {}
            }
            
            # Get notes for 3 octaves (3, 4, 5)
            for octave in [3, 4, 5]:
                octave_notes = []
                for scale_note in scale_notes:
                    # Get note name and adjust octave
                    note_name = scale_note.name
                    # Set the octave - music21 uses a different octave system
                    note_with_octave = f"{note_name}{octave}"
                    octave_notes.append(note_with_octave)
                
                result["notes"][f"octave{octave}"] = octave_notes
            
            # Get common chords in the key
            result["chords"] = self._get_common_chords_for_key(k)
            
            # Add a summary of all available notes
            all_notes = []
            for octave_notes in result["notes"].values():
                all_notes.extend(octave_notes)
            result["all_notes"] = all_notes
            
            # Include special chord and note suggestions
            if mode == "major":
                result["suggested_notes"] = result["notes"]["octave4"]
                result["suggested_chords"] = [result["chords"][i] for i in [0, 3, 4, 5]]  # I, IV, V, vi
            else:  # minor
                result["suggested_notes"] = result["notes"]["octave4"]
                result["suggested_chords"] = [result["chords"][i] for i in [0, 2, 3, 4]]  # i, III, iv, v
            
            return result
        
        except Exception as e:
            logger.error(f"Error generating notes for key {key}: {e}")
            # Return a fallback with C major scale
            return {
                "key": "C major",
                "root": "C",
                "mode": "major",
                "notes": {
                    "octave4": ["C4", "D4", "E4", "F4", "G4", "A4", "B4"],
                },
                "chords": ["C", "Dm", "Em", "F", "G", "Am", "Bdim"],
                "suggested_notes": ["C4", "D4", "E4", "F4", "G4", "A4", "B4"],
                "suggested_chords": ["C", "F", "G", "Am"]
            }
    
    def _get_common_chords_for_key(self, key: music21.key.Key) -> List[str]:
        """Get common chord symbols for a key."""
        # Get scale degrees in this key
        scale = key.getScale()
        
        # Roman numeral representations for chords
        if key.mode == 'major':
            romans = ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°']
            # Build triad on each scale degree
            chords = []
            for i, degree in enumerate([1, 2, 3, 4, 5, 6, 7]):
                # Get the chord from music21 using the roman numeral
                rn = music21.roman.RomanNumeral(romans[i], key)
                
                # Format the chord symbol
                root = rn.root().name
                quality = rn.quality
                
                # Format the chord symbol based on quality
                if quality == 'minor':
                    chord_symbol = f"{root}m"
                elif quality == 'diminished':
                    chord_symbol = f"{root}dim"
                elif quality == 'major':
                    chord_symbol = f"{root}"
                else:
                    chord_symbol = f"{root}{quality}"
                
                chords.append(chord_symbol)
            return chords
        else:  # minor key
            romans = ['i', 'ii°', 'III', 'iv', 'v', 'VI', 'VII']
            # Build triad on each scale degree
            chords = []
            for i, degree in enumerate([1, 2, 3, 4, 5, 6, 7]):
                # Get the chord from music21 using the roman numeral
                rn = music21.roman.RomanNumeral(romans[i], key)
                
                # Format the chord symbol
                root = rn.root().name
                quality = rn.quality
                
                # Format the chord symbol based on quality
                if quality == 'minor':
                    chord_symbol = f"{root}m"
                elif quality == 'diminished':
                    chord_symbol = f"{root}dim"
                elif quality == 'major':
                    chord_symbol = f"{root}"
                else:
                    chord_symbol = f"{root}{quality}"
                
                chords.append(chord_symbol)
            return chords
    
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
        return True, []
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
        
        note_name = note_name.replace("-", "b")
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
    
    def _transform_bars_to_instrument_format(self, data: Dict[str, Any], instrument_name: str, description: str, duration_beats: int) -> Dict[str, Any]:
        """
        Transform the structured bars data from Claude into the expected instrument format.
        
        Args:
            data: Dictionary with bars data from Claude
            instrument_name: Name of the instrument
            description: Description of the melody
            duration_beats: Total duration in beats
            
        Returns:
            Formatted data in the expected output structure
        """
        # Extract bars data
        starting_octave = data.get("starting_octave", 4)
        bars = data.get("bars", [])
        
        # Prepare MIDI notes array
        midi_notes = []
        current_time = 0.0
        
        # Process each bar and its notes
        for bar in bars:
            bar_notes = bar.get("notes", [])
            
            for note in bar_notes:
                # Parse interval and convert to number
                interval_str = note.get("interval", "0")
                if isinstance(interval_str, str):
                    if interval_str.startswith("+"):
                        interval = int(interval_str[1:])
                    elif interval_str.startswith("-"):
                        interval = -int(interval_str[1:])
                    elif interval_str.startswith("R"):
                        interval = 0
                    else:
                        interval = int(interval_str)
                else:
                    interval = int(interval_str)
                
                # Get duration and velocity
                duration_str = note.get("duration")
                velocity = note.get("velocity")
                
                # Convert duration string to beats
                try:
                    duration_beats = self._convert_duration_to_beats(duration_str)
                except ValueError:
                    logger.warning(f"Invalid duration: {duration_str}, defaulting to quarter note")
                    duration_beats = 1.0  # Default to quarter note
                
                # Create MIDI note
                midi_note = {
                    "pitch": 60,  # Placeholder - pitch will be set properly when mapped to scale
                    "start": current_time,
                    "duration": duration_beats,
                    "velocity": velocity
                }
                
                # Add to notes array
                midi_notes.append(midi_note)
                
                # Update current time
                current_time += duration_beats
        
        # Create the instrument structure
        instrument = {
            "name": instrument_name,
            "soundfont_name": instrument_name,
            "channel": 0,
            "patterns": [
                {
                    "type": "melody",
                    "notes": midi_notes
                }
            ]
        }
        
        # Create the full result structure
        storage_key = "default_key"
        if instrument_name in self.selected_instruments:
            storage_key = self.selected_instruments[instrument_name].get("storage_key", "default_key")
        
        result = {
            "part_type": "melody",
            "instrument_name": instrument_name,
            "description": description,
            "duration_beats": duration_beats,
            "instrument": instrument,
            "storage_key": storage_key,
            "original_data": data  # Include the original data for reference
        }
        
        return result
    
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
    
    async def _handle_get_musical_params(self, args: Dict[str, Any], tempo: int, key: str) -> Dict[str, Any]:
        """
        Handle get_chord_progression tool - Get a chord progression for a given key.
        """
        system_prompt = f"""You are a music composer who has specific expertise in chord progressions. You are given a description of a musical style and extensive research about what chord progressions are used in that style. You need to provide a chord progression for that style based on the description and the research.

        Format your response as a JSON object with the following keys:
        - "chord_progression": The chord progression that best fits the description based on the research.
        - "key": The key of the chord progression

        - "explanation": A short explanation of why you picked these chords
        """
        description = args.get("description", "")
        research_result = await self.researcher.research_chord_progression(description)
        logger.info(f"Chord progression research result: {research_result}")
        response = self.client.messages.create(
            model=self.model,
            max_tokens=20000,
            temperature=1,
            system=system_prompt,
            messages=[{
                "role": "user",
                "content": f"Select a chord progression for the following description: {description} based on this research: {research_result}"
            }],
            stream=True
        )
        for content_chunk in response:
            if hasattr(content_chunk, "delta") and hasattr(content_chunk.delta, "text"):
                chunk_text = content_chunk.delta.text
                print(chunk_text)
                if chunk_text:
                    content_text += chunk_text
                    logger.info(f"Received {len(content_text)} characters so far...")
                    

        response_json = json.loads(content_text)
        self.key = response_json.get("key")
        self.chord_progression = response_json.get("chord_progression")
        
        return response_json
    
    async def _handle_create_melody2(self, args: Dict[str, Any], tempo: int, key: str) -> Dict[str, Any]:
        """
        Handle create_melody2 tool - Melody generation using interval-based approach.
        Uses Claude to generate intervals and durations based on the provided description.
        
        Args:
            args: Dictionary with instrument and description
            tempo: Current tempo in BPM
            key: Current musical key
            
        Returns:
            Dictionary with melody part information
        """
        instrument_name = args.get("instrument_name", "")
        description = args.get("description", "")
        duration_beats = args.get("duration_beats", 16)
        duration_bars = args.get("duration_bars", 4)
        
        # Get additional musical characteristics
        mood = args.get("mood", "")
        tempo_character = args.get("tempo_character", "")
        rhythm_type = args.get("rhythm_type", "")
        musical_style = args.get("musical_style", "")
        melodic_character = args.get("melodic_character", "")
        
        self.allowed_intervals = get_mode_intervals("minor")
        allowed_intervals_string = ", ".join(str(interval) for interval in self.allowed_intervals)
        
        # Build a comprehensive musical description
        detailed_description = description
        if mood:
            detailed_description += f", with a {mood} mood"
        if tempo_character:
            detailed_description += f", at a {tempo_character} pace"
        if rhythm_type:
            detailed_description += f", using a {rhythm_type} rhythm"
        if musical_style:
            detailed_description += f", in a {musical_style} style"
        if melodic_character:
            detailed_description += f", with a {melodic_character} melodic character"
        
        # Log the input for debugging
        logger.info(f"Creating melody2 for {instrument_name}: {detailed_description[:50]}...")
        
        if not self.client:
            logger.error("Cannot generate melody: No Anthropic API key available")
            raise ValueError("No Anthropic API key available")
        
        try:
            # Generate intervals and durations based on the description
            system_prompt = f"""You are a music composer creating a melodic pattern based on a text description.
The melody you create needs to be {duration_bars} bars long and needs to be in the key of {key} at {tempo} BPM.

Your task is to create a melody using INTERVALS (semitones) from the LAST NOTE (not the root note) rather than absolute pitches. Try to make the melody as catchy as possible by following repeated rhythmic patterns. This melody will be played in a loop, so it should sound good when played repeatedly. It is crucial to follow a structured rhythmic pattern for this reason. Try to follow a similar rhythmic pattern in each bar or pair of bars.
You will structure your output into {duration_bars} bars, each with their own musical intention.

Musical Considerations:
- Mood: {mood if mood else "Not specified"}
- Tempo character: {tempo_character if tempo_character else "Not specified"}
- Rhythm type: {rhythm_type if rhythm_type else "Not specified"}
- Musical style: {musical_style if musical_style else "Not specified"}
- Melodic character: {melodic_character if melodic_character else "Not specified"}
- Chord progression: {self.chord_progression if self.chord_progression else "Not specified"}
IMPORTANT:
- DO NOT try to add contrast to the mood, tempo, rhythm, or melodic character. Just follow the description. Create a melody that follows the description as closely as possible.

Here are some tips to help create a catchy melody:
- Simplicity - Catchy melodies are usually simple enough to remember but not so simple that they're boring. They often use step-wise motion (moving to adjacent notes) with occasional leaps for interest.
- Repetition - Effective melodies contain repeated motifs or phrases that help listeners anticipate and remember the tune.
- Distinctive rhythm - A memorable rhythm pattern can make even a simple melodic line stand out.
- "Hook" element - Most catchy melodies contain a distinctive musical phrase or "hook" that captures attention and stays in memory.
- Balance between predictability and surprise - Great melodies follow expected patterns but include unexpected elements like unusual intervals or rhythmic variations that create interest.
- Emotional resonance - Melodies that evoke strong emotions tend to be more memorable.
- Singability - If a melody falls within a comfortable vocal range and is easy to sing, people are more likely to remember it.
- Strategic use of tension and resolution - Building tension through dissonance and then resolving it creates satisfaction for listeners.
- Effective use of contour - The shape of a melody as it rises and falls can create a sense of movement that pulls listeners along.
- Alignment with natural speech patterns - Melodies that follow natural speech inflections often feel more intuitive and memorable.
- DO NOT create a melody with a rhythm that is not repetitive at all. It should have a strong rhythmic pattern.
- DO NOT create a melody that is meant to be played once. The melody should be designed to be played in a loop. Therefore for the end of the melody, focus on repeatability and cohesiveness with the start of the melody rather than finality or resolution.

INTERVAL GUIDE - Emotional characteristics and usage:

ASCENDING INTERVALS:
- Unison (0): Stability, reinforcement, emphasis
- +1 (Minor Second): Tension, dissonance, chromatic movement, anxiety
- +2 (Major Second): Gentle forward motion, common stepwise movement
- +3 (Minor Third): Melancholy, sadness, introspection, bluesy feel
- +4 (Major Third): Brightness, happiness, uplift, triumphant feel
- +5 (Perfect Fourth): Strong, open sounds, ancient/modal feel
- +6 (Tritone): Maximum tension, dramatic effect, instability
- +7 (Perfect Fifth): Strong consonance, stability, power
- +8 (Minor Sixth): Bittersweet, nostalgic, emotional depth
- +9 (Major Sixth): Warmth, openness, optimism
- +10 (Minor Seventh): Bluesy, soulful, jazzy, creates expectation
- +11 (Major Seventh): Sophisticated, complex, dreamy, contemplative
- +12 (Octave): Stability, finality, dramatic range expansion

DESCENDING INTERVALS:
- -1 (Minor Second): Tension resolution, grief, sighing effect
- -2 (Major Second): Relaxation, conclusion, natural descent
- -3 (Minor Third): Melancholy, wistfulness, yielding
- -4 (Major Third): Brightness with conclusion, completeness
- -5 (Perfect Fourth): Strong cadential movement, grounding
- -6 (Tritone): Dramatic, unsettling, mysterious
- -7 (Perfect Fifth): Strong harmonic movement, conclusive
- -8 (Minor Sixth): Emotional, expressive, longing
- -9 (Major Sixth): Lyrical, expansive, nobility
- -10 (Minor Seventh): Bluesy, contemplative, emotional depth
- -11 (Major Seventh): Unusual, dramatic, complex
- -12 (Octave): Conclusion, finality, powerful grounding

IMPORTANT:
- Use only intervals that are appropriate for {key}
- Keep the total duration at {duration_beats} beats
- Choose intervals that evoke the requested mood and character
- Mix smaller intervals (for smooth motion) with larger intervals (for drama)
- Track the CUMULATIVE SUM of your intervals to ensure the melody stays within a singable range
- Track the CUMULATIVE SUM of your intervals to ensure it is almost always within these values: {allowed_intervals_string}. If the cumulative sum is not in this range, at any point, that means the note that caused that cumulative sum is out of key. An out of key note is only allowed if it is a passing tone.
- Don't let the cumulative sum go below -7 or above +7 (relative to starting position)
- Plan your intervals to create a natural melodic arc with a climax and resolution
- DO NOT create a melody with a rhythm that is not repetitive at all. It should have a strong rhythmic pattern.

Respond ONLY with a JSON object containing:
- "starting_octave": The octave to start on (3-5)
- "bars": Array of dicts with keys "bar_number", "notes"
    - "bar_number": The bar number associated with this bar of the melody (1-{duration_bars})
    - "musical_intention": The musical intention for this bar of the melody
    - "notes": Array of dicts with keys "interval", "duration", "velocity"
        - "intervals": Array of semitones FROM THE PREVIOUS NOTE (or root note if it's the first note) (e.g., [0, +1, -2, +3]) OR "R" for a rest in STRING FORMAT, where:
        * "R" means a rest
        * "0" means stay on same note
        * "+1" means move up one semitone from the previous note
        * "-1" means move down one semitone from the previous note
        * Values like "+2", "+3", "-2", "-3" represent larger jumps from the previous note
        * IMPORTANT: These are RELATIVE semitone intervals from note to note, not scale degrees
        - "duration": Array of note durations as strings (e.g., ["sixteenth, "eighth", "quarter", "triplet", "half"])
        * IMPORTANT: If you use a triplet, make sure the next two notes are also triplets
        - "velocity": Note velocity or volume (1-127).
        - "explanation": A short explanation of why you picked these values for this interval
        - "cumulative_sum": The cumulative sum of the intervals (should be between -7 and +7)
        - "cumulative_duration": The cumulative duration of the notes' durations. (e.g. cumulative_duration of sixteenth, eighth, eighth is 1/16 + 1/8 + 1/8 = 1/4)
        - "is_in_key": Whether the cumulative sum is in these cumulative intervals: {allowed_intervals_string}. THIS SHOULD ONLY BE FALSE IF IT IS A PASSING TONE/NOTE.
"""
            print("system_prompt", system_prompt)
            # Make API call to generate the intervals
            response = self.client.messages.create(
                model=self.model,
                max_tokens=20000,
                temperature=1,
                system=system_prompt,
                messages=[{
                    "role": "user",
                    "content": f"Create a melody that is {detailed_description} for {instrument_name} in the key of {key} at {tempo} BPM."
                }],
                # Use streaming instead of thinking
                stream=True
            )
            
            # Handle streaming response
            content_text = ""
            logger.info("Processing streaming response...")
            try:
                for content_chunk in response:
                    # Extract text from chunk
                    if hasattr(content_chunk, "delta") and hasattr(content_chunk.delta, "text"):
                        chunk_text = content_chunk.delta.text
                        if chunk_text:
                            content_text += chunk_text
                            # Log progress occasionally
                            #print(chunk_text)
                            if len(content_text) % 500 == 0:
                                logger.info(f"Received {len(content_text)} characters so far...")
                
                logger.info(f"Streaming complete, received {len(content_text)} characters total")
            except Exception as e:
                logger.error(f"Error processing streaming response: {str(e)}")
                raise ValueError(f"Failed to process streaming response: {str(e)}")
            
            # Log the raw response (for debugging)
            logger.info(f"Received content of length {len(content_text)}")
            if not content_text:
                raise ValueError("Received empty content from Claude API")
            
            # Extract JSON from the response - look for code blocks first
            import re
            json_match = re.search(r'```(?:json)?\s*(.*?)\s*```', content_text, re.DOTALL)
            
            if json_match:
                # Found JSON in code blocks
                json_content = json_match.group(1)
                logger.info(f"Extracted JSON from code blocks, length: {len(json_content)}")
                try:
                    melody_data = json.loads(json_content)
                    logger.info(f"Successfully parsed JSON from code block: {json.dumps(melody_data)[:200]}...")
                except json.JSONDecodeError as e:
                    logger.error(f"Failed to parse JSON from code block: {str(e)}")
                    raise ValueError(f"Failed to parse Claude's response from code block: {str(e)}")
            else:
                # Try to parse the raw text as JSON
                try:
                    melody_data = json.loads(content_text)
                    logger.info(f"Generated melody data: {json.dumps(melody_data)[:200]}...")
                except json.JSONDecodeError as e:
                    logger.error(f"Failed to parse Claude's response as JSON: {content_text[:200]}")
                    raise ValueError("Failed to parse Claude's response")
            
            
            # Create the melody using the generated notes
            # Transform the notes into instrument format
            result = self._transform_bars_to_instrument_format(melody_data, instrument_name, description, duration_beats)
            
            return result
            
        except Exception as e:
            logger.error(f"Error in melody generation: {str(e)}")
            logger.error(f"Stack trace: {traceback.format_exc()}")
            raise ValueError(f"Failed to generate melody: {str(e)}")
        
    # Tool handlers
    async def _handle_create_melody(self, args: Dict[str, Any], tempo: int, key: str) -> Dict[str, Any]:
        return;
        """Handle create_melody tool."""
        instrument_name = args.get("instrument_name", "Piano")
        description = args.get("description", "")
        duration_beats = args.get("duration_beats", 16)
        
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
            "instrument": instrument,
            "storage_key": self.selected_instruments[instrument_name]["storage_key"]
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
        instrument_name = args.get("instrument_name", "")
        description = args.get("description", "")
        duration_beats = args.get("duration_beats", 16)
        
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
            "channel": 1,  # Use channel 1 for chords
            "patterns": [
                {
                    "type": "chords",
                    "notes": notes
                }
            ]
        }
        
        logger.info(f"CHORDS INSTRUMENT: {instrument}")
        
        return {
            "part_type": "chords",
            "instrument_name": instrument_name,
            "description": description,
            "duration_beats": duration_beats,
            "instrument": instrument,
            "storage_key": self.selected_instruments[instrument_name]["storage_key"]
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
            "instrument": instrument,
        }
    
    async def _handle_create_counter_melody(self, args: Dict[str, Any], tempo: int, key: str) -> Dict[str, Any]:
        """Handle create_counter_melody tool."""
        instrument_name = args.get("instrument_name")
        description = args.get("description", "")
        duration_beats = args.get("duration_beats", 16)
        
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
            "instrument": instrument,
            "storage_key": self.selected_instruments[instrument_name]["storage_key"]
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
- key: The musical key that would work best (e.g., "C", "F#", etc.)
- mode: The mode of the key. Must be one of these options: ["natural major", "natural minor", "melodic major", "melodic minor", "harmonic major", "harmonic minor"]
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
                max_tokens=20000,
                temperature=1,
                system=system_prompt,
                messages=[{
                    "role": "user",
                    "content": f"Determine appropriate musical parameters for the following description: {description}"
                }],
                thinking={
                    "type": "enabled",
                    "budget_tokens": 16000
                },
            )
            
            # Require a valid response and parse it strictly without fallbacks
            if not response.content:
                raise ValueError("No content received from Claude API")
            
            content = ""
            
            for block in response.content:
                if block.type == "text":
                    content = block.text
                elif block.type == "thinking":
                    logger.info(f"Thinking: {block.thinking}")
            
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
            
            if "mode" not in result:
                raise ValueError("Claude didn't provide a mode")
            
            # Extract and validate key
            determined_key = result["key"]
            if determined_key not in [chr(i) for i in range(ord('A'), ord('G') + 1)]:
                raise ValueError(f"Claude provided an invalid musical key: {determined_key}")
            
            # Extract and validate tempo
            determined_tempo = result["tempo"]
            if not isinstance(determined_tempo, int) or determined_tempo < 40 or determined_tempo > 220:
                raise ValueError(f"Claude provided an invalid tempo: {determined_tempo}")
            
            mode = result["mode"]
            if mode not in ["natural major", "natural minor", "melodic major", "melodic minor", "harmonic major", "harmonic minor", "dorian", "mixolydian", "lydian", "phrygian", "locrian"]:
                raise ValueError(f"Claude provided an invalid mode: {mode}")
            match mode:
                case "natural major":
                    scale = music21.scale.MajorScale(determined_key)
                case "natural minor":
                    scale = music21.scale.MinorScale(determined_key)
                case "melodic minor":
                    scale = music21.scale.MelodicMinorScale(determined_key)
                case "harmonic major":
                    scale = music21.scale.HarmonicMajorScale(determined_key)
                case "harmonic minor":
                    scale = music21.scale.HarmonicMinorScale(determined_key)
                # case "dorian":
                #     scale = music21.scale.DorianScale(determined_key)
                # case "mixolydian":
                #     scale = music21.scale.MixolydianScale(determined_key)
                # case "lydian":
                #     scale = music21.scale.LydianScale(determined_key)
                # case "phrygian":
                #     scale = music21.scale.PhrygianScale(determined_key)
                # case "locrian":
                #     scale = music21.scale.LocrianScale(determined_key)
                # case _:
                #     raise ValueError(f"Claude provided an invalid mode: {mode}")
            
            logger.info(f"Claude determined key={determined_key}, mode={mode}, tempo={determined_tempo}")
            
            available_notes = scale.getPitches()
            available_notes_str = [str(note) for note in available_notes]
            
            logger.info(f"Available notes: {available_notes_str}")
            logger.info("explanation: " + result.get("explanation"))
            
            self.available_notes = available_notes_str
            self.default_key = determined_key + " " + mode
            self.default_tempo = determined_tempo
            self.default_mode = mode
            self.default_bars = 8
            self.allowed_intervals = get_mode_intervals(mode)
            
            return {
                "key": determined_key,
                "tempo": determined_tempo,
                "mode": result["mode"],
                "time_signature": self.default_time_signature,
                "available_notes": available_notes_str,
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
        
        return await soundfont_service.get_public_soundfonts(query)
    
    async def _handle_select_instruments(self, args: Dict[str, Any], tempo: int, key: str) -> Dict[str, Any]:
        """
        Handle select_instruments tool. Selects soundfonts to use in the composition.
        
        Args:
            args: Dictionary with soundfont selection info
            tempo: Tempo parameter (unused)
            key: Key parameter (unused)
            
        Returns:
            Dictionary with selection results
        """
        
        soundfont_names = args.get("soundfont_names", [])
        if not soundfont_names:
            logger.warning("No soundfont names provided to select_instruments")
            return {"error": "No soundfont names provided", "selected_soundfonts": []}
        
        matching_soundfonts = await soundfont_service.get_public_soundfonts()
        # Process each soundfont name
        results = []
        for soundfont_name in soundfont_names:
            # Search for this soundfont name
            found_match = None
            
            # Find the first matching soundfont
            for soundfont in matching_soundfonts:
                name = soundfont.get("name", "").lower()
                display_name = soundfont.get("display_name", "").lower()
                category = soundfont.get("category", "").lower()
                
                search_name = soundfont_name.lower()
                if (search_name in name or 
                    search_name in display_name or 
                    search_name in category):
                    found_match = soundfont
                    break
            
            if found_match:
                # Store in the selected instruments dictionary
                storage_key = found_match.get("storage_key")
                self.selected_instruments[soundfont_name] = {
                    "storage_key": storage_key,
                    "id": found_match.get("id")
                }
                
                results.append({
                    "soundfont_name": soundfont_name,
                    "storage_key": storage_key,
                    "status": "found"
                })
                logger.info(f"Selected soundfont: {soundfont_name} with storage key: {storage_key}")
            else:
                # No match found
                results.append({
                    "soundfont_name": soundfont_name,
                    "status": "not_found"
                })
                logger.warning(f"No matching soundfont found for: {soundfont_name}")
        
        return {
            "selected_soundfonts": results,
            "total_selected": len([r for r in results if r["status"] == "found"]),
            "total_not_found": len([r for r in results if r["status"] == "not_found"])
        }

# Create a singleton instance
music_tools_service = MusicToolsService()

# Export function for easier access