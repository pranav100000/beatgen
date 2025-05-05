# """
# Specialized music generation tools for AutoCompose.
# Provides focused tools for creating different musical components without fallbacks.
# """
# import os
# import json
# import asyncio
# import logging
# from typing import Dict, List, Any, Optional, Callable, Tuple
# from dotenv import load_dotenv

# # Load environment variables from .env file
# load_dotenv()

# from anthropic import Anthropic
# from app.services.instruments import (
#     get_all_soundfonts,
#     get_soundfonts_by_type,
#     find_soundfonts,
#     get_instrument_metadata
# )
# from app.services.midi import MIDIGenerator

# # Set up logging
# logger = logging.getLogger(__name__)

# # Constants for MIDI generation
# BEATS_PER_MEASURE = 4
# DEFAULT_VELOCITY = 80
# DEFAULT_CHORD_VELOCITY = 70
# DEFAULT_DRUM_VELOCITY = 90

# # Tools for Claude to use
# MUSIC_TOOLS = [
#     {
#         "name": "determine_musical_parameters",
#         "description": "Determines appropriate musical parameters (key, tempo) for a given music description.",
#         "input_schema": {
#             "type": "object",
#             "properties": {
#                 "description": {
#                     "type": "string",
#                     "description": "Description of the music to be composed"
#                 }
#             },
#             "required": ["description"]
#         }
#     },
#     {
#         "name": "create_melody",
#         "description": "Creates a melodic pattern for a specified instrument. YOU MUST specify note_names and note_durations.",
#         "input_schema": {
#             "type": "object",
#             "properties": {
#                 "instrument_name": {
#                     "type": "string",
#                     "description": "Name of the instrument (e.g., 'Piano', 'Violin')"
#                 },
#                 "description": {
#                     "type": "string",
#                     "description": "Description of the melody character (e.g., 'cheerful', 'melancholic')"
#                 },
#                 "duration_beats": {
#                     "type": "integer",
#                     "description": "Length of the melody in beats"
#                 },
#                 "program": {
#                     "type": "integer",
#                     "description": "MIDI program number (0-127) for the instrument"
#                 },
#                 "note_names": {
#                     "type": "array",
#                     "description": "REQUIRED: Array of note names like ['G3', 'Bb3', 'D4', 'G4', 'F4', etc.]",
#                     "items": {"type": "string"}
#                 },
#                 "note_durations": {
#                     "type": "array",
#                     "description": "REQUIRED: Array of note durations like ['quarter', 'eighth', 'half', etc.] or numeric values in beats",
#                     "items": {"type": "string"}
#                 },
#                 "note_velocities": {
#                     "type": "array",
#                     "description": "Optional: Array of note velocities (1-127, with 64-100 being typical). Default is 80 if not provided.",
#                     "items": {"type": "integer"}
#                 }
#             },
#             "required": ["instrument_name", "description", "duration_beats", "note_names", "note_durations"]
#         }
#     },
#     {
#         "name": "create_chords",
#         "description": "Creates a chord progression for a harmony instrument. YOU MUST specify chord_names and chord_durations.",
#         "input_schema": {
#             "type": "object",
#             "properties": {
#                 "instrument_name": {
#                     "type": "string",
#                     "description": "Name of the instrument (e.g., 'Piano', 'Guitar')"
#                 },
#                 "description": {
#                     "type": "string",
#                     "description": "Description of the chord progression (e.g., 'simple', 'jazz')"
#                 },
#                 "duration_beats": {
#                     "type": "integer",
#                     "description": "Length of the chord progression in beats"
#                 },
#                 "program": {
#                     "type": "integer",
#                     "description": "MIDI program number (0-127) for the instrument"
#                 },
#                 "chord_names": {
#                     "type": "array",
#                     "description": "REQUIRED: Array of chord names like ['Gmin', 'Bb', 'D7', 'Gmin', etc.]",
#                     "items": {"type": "string"}
#                 },
#                 "chord_durations": {
#                     "type": "array",
#                     "description": "REQUIRED: Array of chord durations like ['whole', 'half', 'quarter', etc.] or numeric values in beats",
#                     "items": {"type": "string"}
#                 },
#                 "velocities": {
#                     "type": "array",
#                     "description": "Optional: Array of chord velocities (1-127). Default is 70 if not provided.",
#                     "items": {"type": "integer"}
#                 }
#             },
#             "required": ["instrument_name", "description", "duration_beats", "chord_names", "chord_durations"]
#         }
#     },
#     {
#         "name": "create_drums",
#         "description": "Creates a drum pattern for percussion. YOU MUST specify drum_notes and drum_durations.",
#         "input_schema": {
#             "type": "object",
#             "properties": {
#                 "description": {
#                     "type": "string",
#                     "description": "Description of the drum pattern (e.g., 'basic beat', 'complex rhythm')"
#                 },
#                 "duration_beats": {
#                     "type": "integer",
#                     "description": "Length of the drum pattern in beats"
#                 },
#                 "intensity": {
#                     "type": "string",
#                     "enum": ["light", "medium", "heavy"],
#                     "description": "Intensity level of the drum pattern"
#                 },
#                 "drum_names": {
#                     "type": "array",
#                     "description": "REQUIRED: Array of drum names like ['kick', 'snare', 'closed hi-hat', 'open hi-hat', etc.]",
#                     "items": {"type": "string"}
#                 },
#                 "drum_durations": {
#                     "type": "array",
#                     "description": "REQUIRED: Array of note durations like ['quarter', 'eighth', 'half', etc.] or numeric values in beats",
#                     "items": {"type": "string"}
#                 },
#                 "drum_velocities": {
#                     "type": "array",
#                     "description": "Optional: Array of note velocities (1-127, with 64-100 being typical). Default is 90 if not provided.",
#                     "items": {"type": "integer"}
#                 }
#             },
#             "required": ["description", "duration_beats", "drum_names", "drum_durations"]
#         }
#     },
#     {
#         "name": "create_counter_melody",
#         "description": "Creates a counter-melody that complements the main melody. YOU MUST specify note_names and note_durations.",
#         "input_schema": {
#             "type": "object",
#             "properties": {
#                 "instrument_name": {
#                     "type": "string",
#                     "description": "Name of the instrument (e.g., 'Flute', 'Violin')"
#                 },
#                 "description": {
#                     "type": "string",
#                     "description": "Description of the counter-melody's character"
#                 },
#                 "duration_beats": {
#                     "type": "integer",
#                     "description": "Length of the counter-melody in beats"
#                 },
#                 "program": {
#                     "type": "integer",
#                     "description": "MIDI program number (0-127) for the instrument"
#                 },
#                 "note_names": {
#                     "type": "array",
#                     "description": "REQUIRED: Array of note names like ['G3', 'Bb3', 'D4', 'G4', 'F4', etc.]",
#                     "items": {"type": "string"}
#                 },
#                 "note_durations": {
#                     "type": "array",
#                     "description": "REQUIRED: Array of note durations like ['quarter', 'eighth', 'half', etc.] or numeric values in beats",
#                     "items": {"type": "string"}
#                 },
#                 "note_velocities": {
#                     "type": "array",
#                     "description": "Optional: Array of note velocities (1-127, with 64-100 being typical). Default is 75 if not provided.",
#                     "items": {"type": "integer"}
#                 }
#             },
#             "required": ["instrument_name", "description", "duration_beats", "note_names", "note_durations"]
#         }
#     },
#     {
#         "name": "combine_parts",
#         "description": "Combines all musical parts into a complete composition.",
#         "input_schema": {
#             "type": "object",
#             "properties": {
#                 "title": {
#                     "type": "string",
#                     "description": "Title for the composition"
#                 },
#                 "melody": {
#                     "type": "object",
#                     "description": "The melody part created with create_melody"
#                 },
#                 "chords": {
#                     "type": "object",
#                     "description": "The chord part created with create_chords"
#                 },
#                 "drums": {
#                     "type": "object",
#                     "description": "The drum part created with create_drums"
#                 },
#                 "counter_melody": {
#                     "type": "object",
#                     "description": "The counter-melody part created with create_counter_melody"
#                 }
#             },
#             "required": ["title", "melody"]
#         }
#     },
#     {
#         "name": "search_soundfonts",
#         "description": "Searches available soundfonts that match a given query.",
#         "input_schema": {
#             "type": "object",
#             "properties": {
#                 "query": {
#                     "type": "string",
#                     "description": "Search term for soundfonts"
#                 }
#             },
#             "required": ["query"]
#         }
#     }
# ]

# # Mapping from note/duration names to MIDI values
# NOTE_MAP = {
#     "C": 0, "C#": 1, "Db": 1, "D": 2, "D#": 3, "Eb": 3,
#     "E": 4, "F": 5, "F#": 6, "Gb": 6, "G": 7, "G#": 8,
#     "Ab": 8, "A": 9, "A#": 10, "Bb": 10, "B": 11
# }

# KEY_MAP = {
#     "C major": "C", "G major": "G", "D major": "D", "A major": "A",
#     "E major": "E", "B major": "B", "F# major": "F#", "C# major": "C#",
#     "F major": "F", "Bb major": "Bb", "Eb major": "Eb", "Ab major": "Ab",
#     "Db major": "Db", "Gb major": "Gb", "Cb major": "Cb",
#     "A minor": "Am", "E minor": "Em", "B minor": "Bm", "F# minor": "F#m",
#     "C# minor": "C#m", "G# minor": "G#m", "D# minor": "D#m", "A# minor": "A#m",
#     "D minor": "Dm", "G minor": "Gm", "C minor": "Cm", "F minor": "Fm",
#     "Bb minor": "Bbm", "Eb minor": "Ebm", "Ab minor": "Abm"
# }

# DURATION_MAP = {
#     "whole": 4.0,       # 4 beats in 4/4 time
#     "half": 2.0,        # 2 beats in 4/4 time
#     "quarter": 1.0,     # 1 beat in 4/4 time
#     "eighth": 0.5,      # 0.5 beats in 4/4 time
#     "sixteenth": 0.25,  # 0.25 beats in 4/4 time
#     "dotted half": 3.0,        # 3 beats in 4/4 time
#     "dotted quarter": 1.5,     # 1.5 beats in 4/4 time
#     "dotted eighth": 0.75,     # 0.75 beats in 4/4 time
#     "dotted sixteenth": 0.375,  # 0.375 beats in 4/4 time
#     "triplet quarter": 0.6667,  # 2/3 of a beat in 4/4 time
#     "triplet eighth": 0.3333,  # 1/3 of a beat in 4/4 time
# }

# # Drum name to MIDI note mapping
# DRUM_MAP = {
#     "kick": 36,
#     "bass drum": 36,
#     "kick drum": 36,
#     "snare": 38,
#     "snare drum": 38,
#     "clap": 39,
#     "hand clap": 39,
#     "hi-hat": 42,  # Closed hi-hat by default
#     "closed hi-hat": 42,
#     "pedal hi-hat": 44,
#     "open hi-hat": 46,
#     "crash": 49,
#     "crash cymbal": 49,
#     "crash 1": 49,
#     "crash 2": 57,
#     "ride": 51,
#     "ride cymbal": 51,
#     "ride bell": 53,
#     "tom": 47,
#     "tom 1": 47,  # Low-mid tom
#     "low tom": 45,
#     "high tom": 50,
#     "floor tom": 43,
#     "tambourine": 54,
#     "cowbell": 56,
#     "conga": 63,
#     "bongo": 60,
#     "rimshot": 37,
#     "woodblock": 76,
#     "mute cuica": 78,
#     "open cuica": 79
# }

# class MusicToolsService:
#     """Service for generating music using specialized tools."""

#     def __init__(self, api_key: Optional[str] = None, model: str = os.getenv("MODEL_ID")):
#         """
#         Initialize the music tools service.

#         Args:
#             api_key: Anthropic API key. If not provided, uses ANTHROPIC_API_KEY env variable.
#             model: Claude model to use.
#         """
#         self.api_key = api_key or os.environ.get("ANTHROPIC_API_KEY")

#         # Initialize API client if key is available
#         if self.api_key:
#             self.client = Anthropic(api_key=self.api_key)
#         else:
#             self.client = None
#             logger.warning("No API key provided. Set ANTHROPIC_API_KEY in .env or provide it when initializing MusicToolsService.")

#         # Store configuration
#         self.model = model

#         # Default parameters
#         self.default_tempo = 120
#         self.default_key = "C major"
#         self.default_time_signature = [4, 4]

#         # Set up handlers for each tool
#         self.tool_handlers = {
#             "determine_musical_parameters": self._handle_determine_musical_parameters,
#             "create_melody": self._handle_create_melody,
#             "create_chords": self._handle_create_chords,
#             "create_drums": self._handle_create_drums,
#             "create_counter_melody": self._handle_create_counter_melody,
#             "combine_parts": self._handle_combine_parts,
#             "search_soundfonts": self._handle_search_soundfonts
#         }

#         # Initialize MIDI generator
#         self.midi_generator = MIDIGenerator(output_dir="output")

#     async def compose_music(self, description: str, tempo: Optional[int] = None, key: Optional[str] = None) -> Dict[str, Any]:
#         """
#         Compose music based on a text description, using specialized music tools.

#         Args:
#             description: Text description of the music to compose
#             tempo: Optional tempo in BPM. If None, Claude will determine an appropriate tempo.
#             key: Optional musical key. If None, Claude will determine an appropriate key.

#         Returns:
#             Dictionary with the composition results
#         """
#         # Store placeholder results for parts
#         melody_part = None
#         chords_part = None
#         drums_part = None
#         counter_melody_part = None
#         combined_parts = None
#         parameters_part = None

#         # Use provided parameters or defaults
#         use_tempo = tempo or self.default_tempo
#         use_key = key or self.default_key
#         let_claude_determine = (tempo is None or key is None or key == self.default_key)

#         logger.info(f"Starting music composition for: {description[:100]}...")

#         logger.info(f"Initial parameters: tempo={use_tempo} BPM, key={use_key}")
#         if let_claude_determine:
#             logger.info("Claude will determine musical parameters based on description")

#         # System prompt focused on using the specialized tools
#         initial_parameters_message = ""
#         if let_claude_determine:
#             initial_parameters_message = """IMPORTANT: Before creating any musical parts, FIRST use the determine_musical_parameters tool
# to select the most appropriate key and tempo based on the music description.
# For example, a sad piece might be in a minor key at a slower tempo, while an energetic dance track
# would use a higher tempo."""
#         else:
#             initial_parameters_message = f"You will create music in {use_key} at {use_tempo} BPM."

#         system_prompt = f"""You are a music composer creating a piece based on a text description.
# {initial_parameters_message}

# Use the specialized music tools to create a complete composition:
# 0. FIRST, search for available instruments using search_soundfonts tool to ensure you select instruments that are available
# 1. Then create the main melody - YOU MUST USE the create_melody tool and SPECIFY EXACT NOTES as note_names (like ["G3", "Bb3", "D4"]) and note_durations (like ["quarter", "eighth", "half"])
# 2. Then create chord progressions - YOU MUST USE the create_chords tool and SPECIFY EXACT CHORDS as chord_names (like ["Gmin", "Bb", "D7"]) and chord_durations (like ["whole", "half"])
# 3. Add drums if appropriate - YOU MUST USE the create_drums tool and SPECIFY EXACT DRUMS as drum_names (like ["kick", "snare", "hi-hat", "kick", "snare"]) and drum_durations (like ["quarter", "quarter", "eighth", "quarter", "quarter"])
# 4. Consider adding a counter-melody - YOU MUST USE the create_counter_melody tool and specify exact notes
# 5. Finally combine all parts using the combine_parts tool

# CRITICAL INSTRUCTION: Do not simply describe what you plan to do next. When you want to add chords, drums, or a counter-melody, directly use the appropriate tool. Do not say "Next, I'll add chords" - instead, immediately invoke the create_chords tool.

# IMPORTANT: Only use instrument names that were found by the search_soundfonts tool to ensure the instruments exist and can be played.

# Create melodies, chords, and drum patterns that truly match the musical style described, being careful to use appropriate notes for the specified key ({use_key})."""

#         try:
#             # Start with initial user message
#             messages = [{
#                 "role": "user",
#                 "content": f"""Please compose music based on this description: {description}

# Start by searching for available instruments using the search_soundfonts tool to ensure you're using instruments that exist.
# Then create a melody, add chords and other elements as appropriate.
# Only use instruments that you've verified exist by searching for them first.
# Use the tools to create each part of the composition."""
#             }]

#             # Track conversation to build up the composition in stages
#             completed = False
#             max_iterations = 15  # Increased from 10 to allow for more steps
#             iterations = 0

#             # Track tool usage
#             tool_usage_history = []

#             # Track repeated tool use to prevent getting stuck in loops
#             last_tool = None
#             repeated_tool_count = 0
#             max_repeated_tools = 3  # Max allowed consecutive calls to same tool

#             while not completed and iterations < max_iterations:
#                 iterations += 1
#                 logger.info(f"Composition iteration {iterations}/{max_iterations}")

#                 # Make API call
#                 logger.info(f"Calling Claude API with {len(messages)} messages")
#                 # Use higher max_tokens for tool-calling steps
#                 max_tokens_to_use = 8000  # Increased from 4000
#                 logger.info(f"Using max_tokens={max_tokens_to_use}")

#                 # Log ALL messages for comprehensive debugging
#                 logger.info("----- COMPLETE MESSAGE HISTORY -----")
#                 for idx, msg in enumerate(messages):
#                     logger.info(f"Message [{idx}]: role={msg.get('role')}")
#                     content = msg.get('content', '')
#                     if len(content) > 300:
#                         logger.info(f"Content (truncated): {content[:300]}...")
#                     else:
#                         logger.info(f"Content: {content}")
#                 logger.info("-----------------------------------")

#                 # Log that we're forcing tool use
#                 logger.info("Forcing Claude to use a tool by setting tool_choice={'type': 'any'}")
#                 response = self.client.messages.create(
#                     model=self.model,
#                     max_tokens=max_tokens_to_use,
#                     temperature=0.7,
#                     system=system_prompt,
#                     messages=messages,
#                     tools=MUSIC_TOOLS,
#                     tool_choice={"type": "any"}  # Force Claude to always use one of the provided tools
#                 )

#                 # Extract text content and only add non-empty assistant messages
#                 content_text = ""
#                 has_tool_use_block = False

#                 # Log the full response structure for debugging
#                 logger.info(f"Response type: {type(response)}")
#                 logger.info(f"Response content type: {type(response.content)}")
#                 logger.info(f"Response content length: {len(response.content)}")

#                 # Log the raw response object attributes
#                 logger.info("RAW RESPONSE ATTRIBUTES:")
#                 for attr in dir(response):
#                     if not attr.startswith('_'):
#                         try:
#                             value = getattr(response, attr)
#                             logger.info(f"  {attr}: {value}")
#                         except Exception as e:
#                             logger.info(f"  {attr}: ERROR: {str(e)}")

#                 # Log the raw response content in detail
#                 logger.info("RAW RESPONSE CONTENT:")
#                 for i, content_item in enumerate(response.content):
#                     logger.info(f"  Item {i}:")
#                     for attr in dir(content_item):
#                         if not attr.startswith('_'):
#                             try:
#                                 value = getattr(content_item, attr)
#                                 logger.info(f"    {attr}: {value}")
#                             except Exception as e:
#                                 logger.info(f"    {attr}: ERROR: {str(e)}")

#                 # Log each content block
#                 for i, content_block in enumerate(response.content):
#                     if hasattr(content_block, 'type'):
#                         logger.info(f"Content block {i} type: {content_block.type}")
#                         if content_block.type == 'tool_use':
#                             has_tool_use_block = True
#                     else:
#                         logger.info(f"Content block {i} has no type attribute")

#                 # Extract text content
#                 for content_block in response.content:
#                     if hasattr(content_block, 'type') and content_block.type == 'text':
#                         content_text = content_block.text
#                         # Log the text content (truncated if too long)
#                         if len(content_text) > 200:
#                             logger.info(f"Claude's text response (first 200 chars): {content_text[:200]}...")
#                         else:
#                             logger.info(f"Claude's text response: {content_text}")
#                         break

#                 # Handle case where Claude sends only a tool_use block with no text
#                 # This is valid - Claude is directly using the tool as instructed
#                 if not content_text and has_tool_use_block:
#                     logger.info("Claude sent a tool call without text content - this is ok")
#                     content_text = "Using tool directly without description."
#                 # Throw error if no content AND no tool use - that's an actual error
#                 elif not content_text:
#                     raise ValueError("Received empty content from Claude API. Failing to ensure we fix the underlying issue.")

#                 assistant_message = {
#                     "role": "assistant",
#                     "content": content_text
#                 }

#                 messages.append(assistant_message)

#                 # Process tool use blocks
#                 tool_responses = []
#                 has_tool_use = False

#                 logger.info(f"Checking for tool use in Claude's response...")

#                 # Count the number of tool_use blocks for logging
#                 tool_use_blocks = [block for block in response.content if hasattr(block, 'type') and block.type == 'tool_use']
#                 logger.info(f"Found {len(tool_use_blocks)} tool_use blocks in the response")

#                 for content_block in response.content:
#                     if hasattr(content_block, 'type') and content_block.type == 'tool_use':
#                         has_tool_use = True
#                         tool_name = content_block.name
#                         tool_args = content_block.input
#                         tool_id = content_block.id

#                         # Full detailed logging of tool call
#                         logger.info(f"Tool use details:")
#                         logger.info(f"  Tool name: {tool_name}")
#                         logger.info(f"  Tool ID: {tool_id}")
#                         logger.info(f"  Tool args: {json.dumps(tool_args)[:200]}...")
#                         logger.info(f"Processing tool use: {tool_name} with args: {json.dumps(tool_args)[:100]}...")

#                         # Track tool usage
#                         tool_usage_history.append(tool_name)

#                         # Track repeated tool use
#                         if tool_name == last_tool:
#                             repeated_tool_count += 1
#                             logger.info(f"Repeated tool use detected: {tool_name} used {repeated_tool_count} times consecutively")

#                             # If stuck in a loop of the same tool, inject a prompt to move on
#                             if repeated_tool_count >= max_repeated_tools:
#                                 logger.warning(f"Detected tool use loop with {tool_name}. Will prompt to move on after this call.")
#                         else:
#                             # Reset counter for new tool
#                             repeated_tool_count = 1
#                             last_tool = tool_name

#                         try:
#                             # Call appropriate handler
#                             if tool_name in self.tool_handlers:
#                                 logger.info(f"Calling handler for tool: {tool_name}")
#                                 result = await self.tool_handlers[tool_name](tool_args, use_tempo, use_key)

#                                 # Store part based on tool type
#                                 if tool_name == "determine_musical_parameters":
#                                     parameters_part = result
#                                     # Update key and tempo if they were determined by Claude
#                                     if "key" in result and result["key"] in KEY_MAP:
#                                         use_key = result["key"]
#                                         logger.info(f"Using Claude-determined key: {use_key}")
#                                     if "tempo" in result and isinstance(result["tempo"], int):
#                                         use_tempo = result["tempo"]
#                                         logger.info(f"Using Claude-determined tempo: {use_tempo} BPM")

#                                     # Update the system prompt with the new parameters
#                                     system_prompt = f"""You are a music composer creating a piece in {use_key} at {use_tempo} BPM.
# Use the specialized music tools to create a complete composition:
# 0. FIRST, search for available instruments using search_soundfonts tool to ensure you select instruments that are available
# 1. Then create the main melody - YOU MUST USE the create_melody tool and SPECIFY EXACT NOTES as note_names (like ["G3", "Bb3", "D4"]) and note_durations (like ["quarter", "eighth", "half"])
# 2. Then create chord progressions - YOU MUST USE the create_chords tool and SPECIFY EXACT CHORDS as chord_names (like ["Gmin", "Bb", "D7"]) and chord_durations (like ["whole", "half"])
# 3. Add drums if appropriate - YOU MUST USE the create_drums tool and SPECIFY EXACT DRUMS as drum_names (like ["kick", "snare", "hi-hat", "kick", "snare"]) and drum_durations (like ["quarter", "quarter", "eighth", "quarter", "quarter"])
# 4. Consider adding a counter-melody - YOU MUST USE the create_counter_melody tool and specify exact notes
# 5. Finally combine all parts using the combine_parts tool

# CRITICAL INSTRUCTION: Do not simply describe what you plan to do next. When you want to add chords, drums, or a counter-melody, directly use the appropriate tool. Do not say "Next, I'll add chords" - instead, immediately invoke the create_chords tool.

# IMPORTANT: Only use instrument names that were found by the search_soundfonts tool to ensure the instruments exist and can be played.

# Create melodies, chords, and drum patterns that truly match the musical style described, being careful to use appropriate notes for the specified key ({use_key})."""

#                                 elif tool_name == "create_melody":
#                                     melody_part = result
#                                     # After creating melody, add prompt for chords
#                                     prompt_for_chords = True
#                                 elif tool_name == "create_chords":
#                                     chords_part = result
#                                 elif tool_name == "create_drums":
#                                     drums_part = result
#                                 elif tool_name == "create_counter_melody":
#                                     counter_melody_part = result
#                                 elif tool_name == "combine_parts":
#                                     combined_parts = result
#                                     completed = True  # Mark complete when parts are combined

#                                 # Add tool response
#                                 tool_responses.append({
#                                     "role": "tool",
#                                     "tool_call_id": tool_id,
#                                     "name": tool_name,
#                                     "content": json.dumps(result)
#                                 })
#                             else:
#                                 logger.warning(f"Unknown tool: {tool_name}")
#                                 tool_responses.append({
#                                     "role": "tool",
#                                     "tool_call_id": tool_id,
#                                     "name": tool_name,
#                                     "content": json.dumps({"error": f"Unknown tool: {tool_name}"})
#                                 })
#                         except Exception as e:
#                             logger.error(f"Error handling tool {tool_name}: {str(e)}")
#                             tool_responses.append({
#                                 "role": "tool",
#                                 "tool_call_id": tool_id,
#                                 "name": tool_name,
#                                 "content": json.dumps({"error": str(e)})
#                             })

#                 # For Anthropic API, we cannot use "tool" role messages
#                 # Instead, add the tool responses as part of the next user message
#                 if tool_responses:
#                     # Format the tool responses as text for the next user message
#                     tool_results = ""
#                     for resp in tool_responses:
#                         tool_results += f"\nResult from {resp['name']}:\n"
#                         content = json.loads(resp['content'])
#                         tool_results += json.dumps(content, indent=2) + "\n"

#                     # Prepare user message with tool results
#                     message_content = f"Here are the results from the tools you used:{tool_results}\n\nPlease continue with the composition using these results."

#                     # If we detected a tool loop, add a prompt to move on
#                     if repeated_tool_count >= max_repeated_tools and tool_name == "create_melody":
#                         message_content += "\n\nThe melody is great! Now, please move on to creating chord progressions using the create_chords tool. Do not try to improve the melody further."
#                         logger.warning("Adding prompt to move on from melody to chords")
#                     elif repeated_tool_count >= max_repeated_tools and tool_name == "create_chords":
#                         message_content += "\n\nThe chord progression is great! Now, please move on to creating drums using the create_drums tool. Do not try to improve the chords further."
#                         logger.warning("Adding prompt to move on from chords to drums")

#                     # Add a new user message with the results
#                     user_message = {
#                         "role": "user",
#                         "content": message_content
#                     }
#                     logger.info(f"Adding tool response message with {len(tool_responses)} tool results")
#                     messages.append(user_message)
#                 else:
#                     logger.info("No tool responses to add to the conversation")

#                 # Check for tool intent in Claude's response (chords, drums, etc.)
#                 # These are cases where Claude says it will use a tool but doesn't actually use it
#                 intents = {
#                     "chord": "create_chords",
#                     "add harmony": "create_chords",
#                     "add chords": "create_chords",
#                     "chord progression": "create_chords",
#                     "create chord": "create_chords",
#                     "drum": "create_drums",
#                     "percussion": "create_drums",
#                     "rhythm": "create_drums",
#                     "beat": "create_drums",
#                     "counter": "create_counter_melody",
#                     "counter melody": "create_counter_melody",
#                     "counter-melody": "create_counter_melody",
#                     "combine": "combine_parts",
#                     "combine all": "combine_parts",
#                     "combine the parts": "combine_parts",
#                     "combine our": "combine_parts",
#                     "complete composition": "combine_parts",
#                     "final composition": "combine_parts"
#                 }

#                 # Check if Claude mentioned an intention but didn't use the tool
#                 mentioned_intent = False
#                 intended_tool = None

#                 for phrase, tool in intents.items():
#                     if phrase in content_text.lower():
#                         mentioned_intent = True
#                         intended_tool = tool
#                         logger.warning(f"Claude mentioned {phrase} but didn't use {tool} tool")
#                         break

#                 if mentioned_intent:
#                     logger.info(f"Claude's response: {content_text[:200]}...")

#                     # Log more details about the response to understand what's happening
#                     logger.info(f"Full response content structure:")
#                     for i, block in enumerate(response.content):
#                         block_type = getattr(block, 'type', 'unknown')
#                         logger.info(f"Block {i}: type={block_type}")
#                         if block_type == 'text':
#                             logger.info(f"  Text (snippet): {block.text[:100]}...")
#                         elif block_type == 'tool_use':
#                             logger.info(f"  Tool: name={block.name}, id={block.id}")

#                     # Log conversation state too
#                     logger.info(f"Current conversation has {len(messages)} messages")
#                     for i, msg in enumerate(messages[-2:]):  # Just log the last two messages for brevity
#                         logger.info(f"Message {i} role: {msg.get('role')}")
#                         content = msg.get('content', '')
#                         logger.info(f"Message {i} content (snippet): {content[:100]}...")

#                     # Add a prompt to directly use the intended tool
#                     prompt_message = {
#                         "role": "user",
#                         "content": f"Please directly use the {intended_tool} tool now. Don't just describe what you plan to do - immediately invoke the {intended_tool} tool."
#                     }
#                     logger.info(f"Adding prompt to use {intended_tool} tool")
#                     messages.append(prompt_message)

#                     # Skip the usual tool use check - we've added a prompt message so continue the loop
#                     continue

#                 # Exit if no tool use or reached completion, BUT...
#                 # If Claude indicates intent to use a specific tool but doesn't, add a helpful message
#                 if not has_tool_use:
#                     indicated_tool_use = False

#                     # Look for both explicit tool intentions and general tool references
#                     tool_indicators = [
#                         "using the create_chords tool",
#                         "using the create_melody tool",
#                         "using the create_drums tool",
#                         "using the create_counter_melody tool",
#                         "using the combine_parts tool",
#                         "using the search_soundfonts tool",
#                         "using the determine_musical_parameters tool"
#                     ]

#                     # Also check for general intentions to do something without using a tool
#                     general_indicators = [
#                         "search for",
#                         "let's find",
#                         "let me find",
#                         "i'll search",
#                         "determine the",
#                         "let's create",
#                         "next step",
#                         "let's add",
#                         "i'll add",
#                         "add some",
#                         "let's now"
#                     ]

#                     # Check for explicit tool mentions
#                     mentioned_specific_tool = any(indicator in content_text.lower() for indicator in tool_indicators)

#                     # Check for general intention statements
#                     mentioned_general_intent = any(indicator in content_text.lower() for indicator in general_indicators)

#                     # If Claude specifically mentions using a tool, help it along
#                     if mentioned_specific_tool or mentioned_general_intent:
#                         if mentioned_specific_tool:
#                             logger.warning("Claude indicated intent to use a specific tool but didn't make the tool call")
#                         else:
#                             logger.warning("Claude indicated intent to do something but didn't use appropriate tool")
#                         logger.info(f"Response snippet: {content_text[:200]}...")

#                         # Instead of breaking, add a user message prompting Claude to use the tool
#                         prompt_message = {
#                             "role": "user",
#                             "content": "Please directly use the appropriate tool now. Don't just describe what you want to do - actually invoke the tool. If you want to search for something, use the search_soundfonts tool. If you want to create a melody, use the create_melody tool. If you want to add chords, use the create_chords tool."
#                         }
#                         logger.info("Adding prompt to encourage tool use")
#                         messages.append(prompt_message)
#                         indicated_tool_use = True

#                     # Only break if Claude didn't indicate intent to do something
#                     if not indicated_tool_use:
#                         logger.warning("Claude did not use any tools in this response. Breaking loop.")
#                         # Check if Claude indicates intention to create something but doesn't use the tool
#                         if any(phrase in content_text.lower() for phrase in
#                               ["let's add", "next let", "next, let", "add some chord", "create chord",
#                                "add harmony", "add a counter", "add drum"]):
#                             logger.warning("Claude indicated general intent to create something but didn't use the tool")
#                             logger.info(f"Response snippet: {content_text[:200]}...")
#                         break

#                 if completed:
#                     logger.info("Composition process marked as completed. Breaking loop.")
#                     break

#             # Summary of tool usage and iterations
#             logger.info(f"Completed {iterations} iterations out of {max_iterations}")
#             logger.info(f"Tools used: {tool_usage_history}")
#             logger.info(f"Completed status: {completed}")

#             # Log parts collected
#             logger.info(f"Parameters: {parameters_part is not None}")
#             logger.info(f"Melody: {melody_part is not None}")
#             logger.info(f"Chords: {chords_part is not None}")
#             logger.info(f"Drums: {drums_part is not None}")
#             logger.info(f"Counter melody: {counter_melody_part is not None}")
#             logger.info(f"Combined: {combined_parts is not None}")

#             # For incomplete compositions, try to generate final output anyway
#             if not completed and iterations >= max_iterations:
#                 logger.warning("Maximum iterations reached without completion")
#                 # Force completion if we at least have a melody
#                 if melody_part is not None:
#                     logger.info("Forcing completion with available parts")
#                     completed = True

#             # Once all parts are complete, generate the final music description
#             logger.info("Generating final music description")
#             music_description = self._create_final_description(
#                 description=description,
#                 tempo=use_tempo,
#                 key=use_key,
#                 melody=melody_part,
#                 chords=chords_part,
#                 drums=drums_part,
#                 counter_melody=counter_melody_part,
#                 combined=combined_parts
#             )

#             # Generate MIDI files
#             midi_result = await self._generate_midi(music_description)

#             # Collect Claude's raw inputs and responses
#             claude_conversation = []
#             current_user_input = ""

#             # Process pairs of user and assistant messages
#             for i in range(0, len(messages)):
#                 message = messages[i]
#                 role = message.get("role", "")
#                 content = message.get("content", "")

#                 if role == "user":
#                     # Store user input for next assistant response
#                     current_user_input = content
#                 elif role == "assistant" and current_user_input:
#                     # When we see an assistant message, create an exchange with the previous user input
#                     exchange = {
#                         "user_input": current_user_input,
#                         "claude_response": content
#                     }
#                     claude_conversation.append(exchange)
#                     current_user_input = ""  # Reset for next user input

#             # If there's a dangling user message with no response, add it too
#             if current_user_input:
#                 exchange = {
#                     "user_input": current_user_input,
#                     "claude_response": "No response"
#                 }
#                 claude_conversation.append(exchange)

#             # Create a comprehensive output JSON with all data
#             output_json = {
#                 "status": "success",
#                 "title": music_description["title"],
#                 "description": description,
#                 "key": music_description.get("key", "unknown"),
#                 "tempo": music_description.get("tempo", 120),
#                 "time_signature": music_description.get("time_signature", [4, 4]),
#                 "tracks": midi_result["tracks"],
#                 "instruments": music_description.get("instruments", []),
#                 "notes_json": midi_result.get("notes_json", []),  # Add the simple JSON notes structure
#                 "music_description": music_description,
#                 "midi_result": midi_result,
#                 "claude_parameters": parameters_part,
#                 "directory": midi_result.get("directory", ""),
#                 "parts": {
#                     "melody": melody_part,
#                     "chords": chords_part,
#                     "drums": drums_part,
#                     "counter_melody": counter_melody_part,
#                     "combined": combined_parts
#                 },
#                 "claude_conversation": claude_conversation  # Add Claude's conversation
#             }

#             return output_json

#         except Exception as e:
#             logger.error(f"Error in music composition: {str(e)}")

#             # Return an error response with whatever partial data we have
#             return {
#                 "status": "error",
#                 "error": str(e),
#                 "description": description,
#                 "key": use_key,
#                 "tempo": use_tempo,
#                 "claude_parameters": parameters_part,
#                 "tracks": [],
#                 "notes_json": [],  # Empty notes JSON structure
#                 "time_signature": self.default_time_signature,
#                 "claude_conversation": []  # Empty conversation
#             }

#     def _create_final_description(self, description: str, tempo: int, key: str,
#                                  melody: Optional[Dict[str, Any]] = None,
#                                  chords: Optional[Dict[str, Any]] = None,
#                                  drums: Optional[Dict[str, Any]] = None,
#                                  counter_melody: Optional[Dict[str, Any]] = None,
#                                  combined: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
#         """Create a final music description from the individual parts."""
#         # Start with a basic title if combined doesn't provide one
#         title = f"{description[:20]}... in {key}"
#         if combined and "title" in combined:
#             title = combined["title"]

#         # Basic structure
#         music_description = {
#             "title": title,
#             "tempo": tempo,
#             "key": key,
#             "time_signature": self.default_time_signature,
#             "instruments": []
#         }

#         # Track used channels to avoid conflicts
#         used_channels = set()

#         # Add melody instrument if available
#         if melody and "instrument" in melody:
#             melody_instrument = melody["instrument"]
#             music_description["instruments"].append(melody_instrument)
#             if "channel" in melody_instrument:
#                 used_channels.add(melody_instrument["channel"])

#         # Add chords instrument if available
#         if chords and "instrument" in chords:
#             chords_instrument = chords["instrument"]
#             # Ensure unique channel
#             if "channel" in chords_instrument and chords_instrument["channel"] in used_channels:
#                 # Find an unused channel
#                 for i in range(16):
#                     if i != 9 and i not in used_channels:  # Skip drum channel (9)
#                         chords_instrument["channel"] = i
#                         break

#             music_description["instruments"].append(chords_instrument)
#             if "channel" in chords_instrument:
#                 used_channels.add(chords_instrument["channel"])

#         # Add drums if available - always use channel 9
#         if drums and "instrument" in drums:
#             drums_instrument = drums["instrument"]
#             drums_instrument["channel"] = 9  # Standard drum channel
#             music_description["instruments"].append(drums_instrument)
#             used_channels.add(9)

#         # Add counter melody if available
#         if counter_melody and "instrument" in counter_melody:
#             counter_instrument = counter_melody["instrument"]
#             # Ensure unique channel
#             if "channel" in counter_instrument and counter_instrument["channel"] in used_channels:
#                 # Find an unused channel
#                 for i in range(16):
#                     if i != 9 and i not in used_channels:  # Skip drum channel (9)
#                         counter_instrument["channel"] = i
#                         break

#             music_description["instruments"].append(counter_instrument)
#             if "channel" in counter_instrument:
#                 used_channels.add(counter_instrument["channel"])

#         # Set final title
#         music_description["title"] = title

#         # Ensure every instrument has a soundfont_name
#         for instrument in music_description["instruments"]:
#             if "soundfont_name" not in instrument or not instrument["soundfont_name"]:
#                 instrument["soundfont_name"] = instrument.get("name", "Default")

#         return music_description

#     async def _generate_midi(self, music_description: Dict[str, Any]) -> Dict[str, Any]:
#         """Generate MIDI files from the music description and return a detailed JSON."""
#         logger.debug(f"Generating MIDI for: {music_description['title']}")

#         # Generate separate MIDI files
#         try:
#             results = await self.midi_generator.generate_midi_separate(music_description)
#         except Exception as e:
#             logger.error(f"Error generating MIDI: {str(e)}")
#             # Return minimal valid result with error info
#             return {
#                 "error": str(e),
#                 "tracks": [],
#                 "directory": ""
#             }

#         # Get the directory path from the first result
#         dir_path = os.path.dirname(results[0]["file_path"]) if results else ""

#         # Prepare tracks data with notes information
#         tracks = []
#         note_data_json = []  # Separate, simple JSON structure for notes

#         for result in results:
#             # Extract and format notes data from patterns
#             instrument = None
#             for instr in music_description.get("instruments", []):
#                 if instr.get("name") == result["instrument_name"]:
#                     instrument = instr
#                     break

#             # Collect all notes from all patterns for this instrument
#             all_notes = []
#             if instrument and "patterns" in instrument:
#                 for pattern in instrument["patterns"]:
#                     if "notes" in pattern:
#                         all_notes.extend(pattern["notes"])

#             # Add note data to simple JSON
#             instrument_notes = {
#                 "instrument": result["instrument_name"],
#                 "soundfont": result["soundfont_name"],
#                 "program": instrument.get("program", 0) if instrument else 0,
#                 "channel": instrument.get("channel", 0) if instrument else 0,
#                 "notes": all_notes
#             }
#             note_data_json.append(instrument_notes)

#             # Create track data for API output
#             track_data = {
#                 "instrument_name": result["instrument_name"],
#                 "soundfont_name": result["soundfont_name"],
#                 "file_path": result["file_path"],
#                 "track_count": result["track_count"],
#                 "midi_data": result["midi_data"],
#                 "download_url": f"/download/{os.path.basename(dir_path)}/{os.path.basename(result['file_path'])}",
#                 "channel": instrument.get("channel", 0) if instrument else 0,
#                 "program": instrument.get("program", 0) if instrument else 0,
#             }

#             # Add pattern types and notes if available
#             if instrument and "patterns" in instrument:
#                 track_data["pattern_types"] = [p.get("type", "unknown") for p in instrument["patterns"]]
#                 track_data["notes"] = all_notes

#             tracks.append(track_data)

#         # Create comprehensive output
#         return {
#             "title": music_description["title"],
#             "key": music_description.get("key", "unknown"),
#             "tempo": music_description.get("tempo", 120),
#             "time_signature": music_description.get("time_signature", [4, 4]),
#             "directory": dir_path,
#             "tracks": tracks,
#             "notes_json": note_data_json,  # Simple, standalone JSON structure of note data
#             "detailed_json": {
#                 "title": music_description["title"],
#                 "key": music_description.get("key", "unknown"),
#                 "tempo": music_description.get("tempo", 120),
#                 "time_signature": music_description.get("time_signature", [4, 4]),
#                 "instruments": music_description.get("instruments", [])
#             }
#         }

#     async def _handle_determine_musical_parameters(self, args: Dict[str, Any], tempo: int, key: str) -> Dict[str, Any]:
#         """
#         Handle determine_musical_parameters tool.
#         Uses Claude to determine the appropriate key and tempo based on the description.
#         """
#         description = args.get("description", "")
#         logger.debug(f"Determining musical parameters for: {description[:50]}...")

#         # If tempo and key are already provided, just return them
#         if tempo is not None and key is not None and key != self.default_key:
#             logger.info(f"Using provided parameters: tempo={tempo}, key={key}")
#             return {
#                 "tempo": tempo,
#                 "key": key,
#                 "time_signature": self.default_time_signature,
#                 "explanation": "Using provided parameters"
#             }

#         # Otherwise, ask Claude to determine appropriate parameters
#         try:
#             if not self.client:
#                 logger.warning("No API client available, using defaults")
#                 raise ValueError("No API client available")

#             # Create a specific prompt for Claude to determine musical parameters
#             system_prompt = """You are a music theory expert.
# Your task is to determine the most appropriate musical key and tempo (BPM) for a piece of music based on its description.
# Respond in JSON format with the following fields:
# - key: The musical key that would work best (e.g., "C major", "F# minor", etc.)
# - tempo: The tempo in BPM as an integer between 60 and 200
# - explanation: A brief explanation of your choices

# Consider the following when determining parameters:
# - Genre conventions (e.g., EDM typically has higher BPM than ballads)
# - Mood/emotion (e.g., minor keys for sad/dark pieces, major for upbeat/happy)
# - Energy level (e.g., faster tempo for energetic music, slower for relaxed)
# - Any specific key or tempo mentioned in the description should be used
# """

#             response = self.client.messages.create(
#                 model=self.model,
#                 max_tokens=1000,
#                 temperature=0.3,
#                 system=system_prompt,
#                 messages=[{
#                     "role": "user",
#                     "content": f"Determine appropriate musical parameters for the following description: {description}"
#                 }]
#             )

#             # Require a valid response and parse it strictly without fallbacks
#             if not response.content:
#                 raise ValueError("No content received from Claude API")

#             content = response.content[0].text

#             # Try to parse as JSON - throw error on failure
#             # Find JSON content (sometimes Claude wraps it in ```json ... ```)
#             import re
#             json_match = re.search(r'```json\s*(.*?)\s*```', content, re.DOTALL)
#             if json_match:
#                 content = json_match.group(1)

#             try:
#                 result = json.loads(content)
#             except json.JSONDecodeError:
#                 logger.error(f"Failed to parse Claude's response as JSON: {content[:100]}")
#                 raise ValueError(f"Claude's response could not be parsed as JSON: {content[:100]}")

#             # Validate required fields
#             if "key" not in result:
#                 raise ValueError("Claude didn't provide a musical key")

#             if "tempo" not in result:
#                 raise ValueError("Claude didn't provide a tempo")

#             # Extract and validate key
#             determined_key = result["key"]
#             if determined_key not in KEY_MAP:
#                 raise ValueError(f"Claude provided an invalid musical key: {determined_key}")

#             # Extract and validate tempo
#             determined_tempo = result["tempo"]
#             if not isinstance(determined_tempo, int) or determined_tempo < 40 or determined_tempo > 220:
#                 raise ValueError(f"Claude provided an invalid tempo: {determined_tempo}")

#             logger.info(f"Claude determined key={determined_key}, tempo={determined_tempo}")

#             return {
#                 "key": determined_key,
#                 "tempo": determined_tempo,
#                 "time_signature": self.default_time_signature,
#                 "explanation": result.get("explanation", "Parameters determined by musical analysis")
#             }

#         except Exception as e:
#             logger.error(f"Error determining musical parameters: {str(e)}")
#             # Rethrow the error - no fallbacks
#             raise

#     async def _handle_create_melody(self, args: Dict[str, Any], tempo: int, key: str) -> Dict[str, Any]:
#         """Handle create_melody tool."""
#         logger.info(f"RAW MELODY INPUT: {json.dumps(args)}")

#         instrument_name = args.get("instrument_name", "Piano")
#         description = args.get("description", "")
#         duration_beats = args.get("duration_beats", 16)
#         program = args.get("program", 0)  # Default to piano

#         # Get the note names and durations
#         note_names = args.get("note_names", [])
#         note_durations = args.get("note_durations", [])
#         note_velocities = args.get("note_velocities", [])

#         logger.info(f"Claude provided: {len(note_names)} notes, {len(note_durations)} durations, {len(note_velocities)} velocities")
#         logger.info(f"Sample notes: {note_names[:5]}")
#         logger.info(f"Sample durations: {note_durations[:5]}")

#         # Convert note names and durations to MIDI values
#         notes = []
#         current_time = 0.0

#         for i in range(len(note_names)):
#             if i >= len(note_durations):
#                 break

#             note_name = note_names[i]
#             duration_value = note_durations[i]

#             # Convert duration to beats
#             duration_beats = self._parse_duration(duration_value)

#             # Convert note name to MIDI pitch
#             pitch = self._parse_note_name(note_name)

#             # Get velocity (default 80 if not provided)
#             velocity = note_velocities[i] if i < len(note_velocities) else DEFAULT_VELOCITY

#             # Create note object
#             note = {
#                 "pitch": pitch,
#                 "start": current_time,
#                 "duration": duration_beats,
#                 "velocity": velocity
#             }

#             notes.append(note)
#             current_time += duration_beats

#         logger.info(f"Converted {len(notes)} notes from text notation")

#         # Create the instrument data
#         instrument = {
#             "name": instrument_name,
#             "soundfont_name": instrument_name,  # Use instrument name as soundfont
#             "program": program,
#             "channel": 0,  # Default channel
#             "patterns": [
#                 {
#                     "type": "melody",
#                     "notes": notes
#                 }
#             ]
#         }

#         return {
#             "part_type": "melody",
#             "instrument_name": instrument_name,
#             "description": description,
#             "duration_beats": duration_beats,
#             "instrument": instrument
#         }

#     async def _handle_create_chords(self, args: Dict[str, Any], tempo: int, key: str) -> Dict[str, Any]:
#         """Handle create_chords tool."""
#         logger.info(f"RAW CHORD INPUT: {json.dumps(args)}")

#         instrument_name = args.get("instrument_name", "Piano")
#         description = args.get("description", "")
#         duration_beats = args.get("duration_beats", 16)
#         program = args.get("program", 0)  # Default to piano

#         # Get the chord names and durations
#         chord_names = args.get("chord_names", [])
#         chord_durations = args.get("chord_durations", [])
#         velocities = args.get("velocities", [])

#         logger.info(f"Claude provided: {len(chord_names)} chords, {len(chord_durations)} durations, {len(velocities)} velocities")
#         logger.info(f"Sample chords: {chord_names[:5]}")
#         logger.info(f"Sample durations: {chord_durations[:5]}")

#         # Convert chords to MIDI notes
#         notes = []
#         current_time = 0.0

#         for i in range(len(chord_names)):
#             if i >= len(chord_durations):
#                 break

#             chord_name = chord_names[i]
#             duration_value = chord_durations[i]

#             # Convert duration to beats
#             duration_beats = self._parse_duration(duration_value)

#             # Convert chord name to MIDI pitches
#             chord_pitches = self._parse_chord_name(chord_name)

#             # Get velocity (default 70 for chords)
#             velocity = velocities[i] if i < len(velocities) else DEFAULT_CHORD_VELOCITY

#             # Create note objects for each pitch in the chord
#             for pitch in chord_pitches:
#                 note = {
#                     "pitch": pitch,
#                     "start": current_time,
#                     "duration": duration_beats,
#                     "velocity": velocity
#                 }
#                 notes.append(note)

#             current_time += duration_beats

#         logger.info(f"Processed {len(chord_names)} chords into {len(notes)} notes")

#         # Create the instrument data
#         instrument = {
#             "name": instrument_name,
#             "soundfont_name": instrument_name,  # Use instrument name as soundfont
#             "program": program,
#             "channel": 1,  # Default chord channel
#             "patterns": [
#                 {
#                     "type": "chords",
#                     "notes": notes
#                 }
#             ]
#         }

#         return {
#             "part_type": "chords",
#             "instrument_name": instrument_name,
#             "description": description,
#             "duration_beats": duration_beats,
#             "instrument": instrument
#         }

#     async def _handle_create_drums(self, args: Dict[str, Any], tempo: int, key: str) -> Dict[str, Any]:
#         """Handle create_drums tool."""
#         description = args.get("description", "")
#         duration_beats = args.get("duration_beats", 16)
#         intensity = args.get("intensity", "medium")

#         # Get the drum names and durations
#         drum_names = args.get("drum_names", [])
#         drum_durations = args.get("drum_durations", [])
#         drum_velocities = args.get("drum_velocities", [])

#         # Convert drum names to MIDI notes
#         notes = []
#         current_time = 0.0

#         for i in range(len(drum_names)):
#             if i >= len(drum_durations):
#                 break

#             drum_name = drum_names[i].lower()
#             duration_value = drum_durations[i]

#             # Convert duration to beats
#             duration_beats = self._parse_duration(duration_value)

#             # Convert drum name to MIDI pitch
#             if drum_name in DRUM_MAP:
#                 pitch = DRUM_MAP[drum_name]
#             else:
#                 # Default to snare if unknown
#                 pitch = 38

#             # Get velocity (default 90 for drums)
#             velocity_multiplier = 0.8 if intensity == "light" else 1.0 if intensity == "medium" else 1.2
#             base_velocity = drum_velocities[i] if i < len(drum_velocities) else DEFAULT_DRUM_VELOCITY
#             velocity = min(127, int(base_velocity * velocity_multiplier))

#             # Create note object
#             note = {
#                 "pitch": pitch,
#                 "start": current_time,
#                 "duration": min(0.25, duration_beats),  # Drums usually have short durations
#                 "velocity": velocity
#             }

#             notes.append(note)
#             current_time += duration_beats

#         # Create the instrument data
#         instrument = {
#             "name": "Drums",
#             "soundfont_name": "Standard Drum Kit",
#             "program": "percussion",  # Special case for drums
#             "channel": 9,  # Standard drum channel
#             "patterns": [
#                 {
#                     "type": "drums",
#                     "notes": notes
#                 }
#             ]
#         }

#         return {
#             "part_type": "drums",
#             "description": description,
#             "duration_beats": duration_beats,
#             "intensity": intensity,
#             "instrument": instrument
#         }

#     async def _handle_create_counter_melody(self, args: Dict[str, Any], tempo: int, key: str) -> Dict[str, Any]:
#         """Handle create_counter_melody tool."""
#         instrument_name = args.get("instrument_name", "Flute")
#         description = args.get("description", "")
#         duration_beats = args.get("duration_beats", 16)
#         program = args.get("program", 73)  # Default to flute

#         # Get the note names and durations
#         note_names = args.get("note_names", [])
#         note_durations = args.get("note_durations", [])
#         note_velocities = args.get("note_velocities", [])

#         # Convert note names and durations to MIDI values (similar to create_melody)
#         notes = []
#         current_time = 0.0

#         for i in range(len(note_names)):
#             if i >= len(note_durations):
#                 break

#             note_name = note_names[i]
#             duration_value = note_durations[i]

#             # Convert duration to beats
#             duration_beats = self._parse_duration(duration_value)

#             # Convert note name to MIDI pitch
#             pitch = self._parse_note_name(note_name)

#             # Get velocity (default 75 for counter melody)
#             velocity = note_velocities[i] if i < len(note_velocities) else 75

#             # Create note object
#             note = {
#                 "pitch": pitch,
#                 "start": current_time,
#                 "duration": duration_beats,
#                 "velocity": velocity
#             }

#             notes.append(note)
#             current_time += duration_beats

#         # Create the instrument data
#         instrument = {
#             "name": instrument_name,
#             "soundfont_name": instrument_name,  # Use instrument name as soundfont
#             "program": program,
#             "channel": 2,  # Default counter melody channel
#             "patterns": [
#                 {
#                     "type": "counter_melody",
#                     "notes": notes
#                 }
#             ]
#         }

#         return {
#             "part_type": "counter_melody",
#             "instrument_name": instrument_name,
#             "description": description,
#             "duration_beats": duration_beats,
#             "instrument": instrument
#         }

#     async def _handle_combine_parts(self, args: Dict[str, Any], tempo: int, key: str) -> Dict[str, Any]:
#         """Handle combine_parts tool."""
#         title = args.get("title", "Untitled Composition")
#         melody = args.get("melody", None)
#         chords = args.get("chords", None)
#         drums = args.get("drums", None)
#         counter_melody = args.get("counter_melody", None)

#         # Simply return the args as the combined result
#         return {
#             "title": title,
#             "parts": {
#                 "melody": melody,
#                 "chords": chords,
#                 "drums": drums,
#                 "counter_melody": counter_melody
#             }
#         }

#     async def _handle_search_soundfonts(self, args: Dict[str, Any], tempo: int, key: str) -> List[Dict[str, Any]]:
#         """Handle search_soundfonts tool."""
#         query = args.get("query", "")
#         logger.debug(f"Searching soundfonts for: {query}")

#         return find_soundfonts(query)

#     def _parse_note_name(self, note_name: str) -> int:
#         """Parse a note name like 'C4' to MIDI pitch value."""
#         if not note_name:
#             return 60  # Default to middle C

#         try:
#             # Handle different formats like 'C4', 'C-4', 'C 4'
#             note_name = note_name.replace('-', '').replace(' ', '')

#             # Extract letter, accidental and octave
#             if len(note_name) >= 2:
#                 # Extract the note letter and any accidental
#                 if len(note_name) >= 3 and note_name[1] in ['#', 'b']:
#                     note = note_name[:2]
#                     octave = note_name[2:]
#                 else:
#                     note = note_name[:1]
#                     octave = note_name[1:]

#                 # Convert octave to integer
#                 try:
#                     octave = int(octave)
#                 except ValueError:
#                     octave = 4  # Default to middle octave

#                 # Get the base value for the note
#                 if note in NOTE_MAP:
#                     base_value = NOTE_MAP[note]
#                 else:
#                     # Just get the note letter without accidental
#                     base_note = note[0].upper()
#                     base_value = NOTE_MAP.get(base_note, 0)

#                 # Calculate the MIDI pitch value
#                 return base_value + (12 * (octave + 1))
#             else:
#                 return 60  # Default to middle C
#         except Exception as e:
#             logger.warning(f"Error parsing note name '{note_name}': {str(e)}")
#             return 60  # Default to middle C

#     def _parse_duration(self, duration_value: str) -> float:
#         """Parse a duration value to beats."""
#         if isinstance(duration_value, (int, float)):
#             return float(duration_value)

#         if isinstance(duration_value, str):
#             duration_value = duration_value.lower()
#             if duration_value in DURATION_MAP:
#                 return DURATION_MAP[duration_value]

#             try:
#                 return float(duration_value)
#             except ValueError:
#                 pass

#         return 1.0  # Default to quarter note

#     def _parse_chord_name(self, chord_name: str) -> List[int]:
#         """Parse a chord name like 'C', 'Gm', 'F7' to MIDI pitches."""
#         # This is a simplified implementation - a full version would handle more complex chords
#         root_note = chord_name[0].upper()

#         # Handle accidentals in the root
#         if len(chord_name) > 1 and chord_name[1] in ['#', 'b']:
#             root_note += chord_name[1]
#             chord_type = chord_name[2:]
#         else:
#             chord_type = chord_name[1:]

#         # Get the root pitch (assuming octave 3)
#         if root_note in NOTE_MAP:
#             root_pitch = NOTE_MAP[root_note] + 48  # C3 = 48
#         else:
#             root_pitch = 48  # Default to C3

#         # Determine chord type
#         if 'min' in chord_type or 'm' in chord_type:
#             # Minor chord: root, minor 3rd, perfect 5th
#             return [root_pitch, root_pitch + 3, root_pitch + 7]
#         elif 'dim' in chord_type or '°' in chord_type:
#             # Diminished chord: root, minor 3rd, diminished 5th
#             return [root_pitch, root_pitch + 3, root_pitch + 6]
#         elif 'aug' in chord_type or '+' in chord_type:
#             # Augmented chord: root, major 3rd, augmented 5th
#             return [root_pitch, root_pitch + 4, root_pitch + 8]
#         elif '7' in chord_type:
#             if 'maj7' in chord_type or 'M7' in chord_type:
#                 # Major 7th chord: root, major 3rd, perfect 5th, major 7th
#                 return [root_pitch, root_pitch + 4, root_pitch + 7, root_pitch + 11]
#             elif 'min7' in chord_type or 'm7' in chord_type:
#                 # Minor 7th chord: root, minor 3rd, perfect 5th, minor 7th
#                 return [root_pitch, root_pitch + 3, root_pitch + 7, root_pitch + 10]
#             else:
#                 # Dominant 7th chord: root, major 3rd, perfect 5th, minor 7th
#                 return [root_pitch, root_pitch + 4, root_pitch + 7, root_pitch + 10]
#         elif 'sus4' in chord_type:
#             # Suspended 4th chord: root, perfect 4th, perfect 5th
#             return [root_pitch, root_pitch + 5, root_pitch + 7]
#         elif 'sus2' in chord_type:
#             # Suspended 2nd chord: root, major 2nd, perfect 5th
#             return [root_pitch, root_pitch + 2, root_pitch + 7]
#         else:
#             # Default to major chord: root, major 3rd, perfect 5th
#             return [root_pitch, root_pitch + 4, root_pitch + 7]

# # Create a singleton instance
# music_tools_service = MusicToolsService()

# # Export main function for easier access
# compose_music = music_tools_service.compose_music
