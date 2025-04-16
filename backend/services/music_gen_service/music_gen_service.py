import asyncio
from dataclasses import dataclass, field
import json
import os
import traceback
from typing import Any, Dict, List, Optional
import anthropic
from dotenv import load_dotenv
import logging
from app.utils.sse_queue_manager import SSEQueueManager
from app.types.assistant_actions import AssistantAction, TrackType
from services.music_gen_service.chord_progression_analysis import analyze_chord_progression
from services.soundfont_service.soundfont_service import soundfont_service
from clients.anthropic_client import AnthropicClient
from services.music_gen_service.midi import transform_bars_to_instrument_format, transform_chord_progression_to_instrument_format
from services.music_gen_service.music_utils import get_mode_intervals
from services.music_gen_service.music_gen_tools import CREATE_MELODY_TOOL, DETERMINE_MUSICAL_PARAMETERS_TOOL, SELECT_INSTRUMENTS_TOOL
from services.music_gen_service.prompt_utils import get_ai_composer_agent_initial_system_prompt, get_melody_create_prompt
from services.music_gen_service.music_researcher import MusicResearcher
import re

load_dotenv()
logger = logging.getLogger(__name__)

@dataclass
class Instrument:
    id: str
    name: str
    description: str
    soundfont_name: str
    storage_key: str
    role: str = ""  # For tracking the instrument's role in the composition (melody, chords, etc.)
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert instrument to a dictionary for serialization"""
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "soundfont_name": self.soundfont_name,
            "storage_key": self.storage_key,
            "category": self.category,
            "role": self.role
        }
    
@dataclass
class MusicalParams:
    key: str = ""
    mode: str = ""
    chord_progression: str = ""
    bpm: int = 0
    allowed_intervals: List[int] = field(default_factory=list)
    duration_beats: int = 16
    duration_bars: int = 4
    time_signature: List[int] = field(default_factory=list)
    melody: Optional[Any] = None
    counter_melody: Optional[Any] = None
    chords: Optional[Any] = None
    melody_instrument: Optional[Instrument] = None
    chords_instrument: Optional[Instrument] = None

class MusicGenService:
    def __init__(self):
        self.researcher = MusicResearcher()
        self.anthropic_client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))
        self.anthropic_client2 = AnthropicClient()
        self.melody_composer = AnthropicClient()
        self.chord_composer = AnthropicClient()
        self.model = os.getenv("MODEL_ID")
        self.musical_params = MusicalParams()
        self.available_soundfonts = []
        self.selected_instruments: List[Instrument] = []

    async def compose_music(self, prompt: str, queue: SSEQueueManager):
        
        await queue.stage("Starting research...", "Doing research online to find the best musical parameters...")
        # Run research and soundfont fetching concurrently
        research_result, chord_research_result, self.available_soundfonts = await asyncio.gather(
            self.researcher.enhance_description(prompt),
            self.researcher.research_chord_progression(prompt),
            soundfont_service.get_public_soundfonts()
        )

        # Determine musical parameters
        await self._determine_musical_parameters(prompt, research_result, chord_research_result, queue)

        # Select instruments
        await self._select_instruments_via_llm(queue)

        # Generate chord progression
        await self._generate_chords(queue)

        # Generate melody
        await self._generate_melody(prompt, queue)

        # Build the final response
        instruments = []
        if self.musical_params.melody:
            instruments.append(self.musical_params.melody)
        if self.musical_params.chords:
            instruments.append(self.musical_params.chords)
        if self.musical_params.counter_melody:
            instruments.append(self.musical_params.counter_melody)
            
        return {
            "tempo": self.musical_params.bpm,
            "key": self.musical_params.key,
            "time_signature": self.musical_params.time_signature,
            "instruments": instruments,
            "chord_progression": self.musical_params.chord_progression
        }

    async def _determine_musical_parameters(self, prompt: str, research_result: str, chord_research_result: str, queue: SSEQueueManager):
        """Determines key, mode, BPM, chord progression, and suggested instruments using an LLM."""
        logger.debug("Determining musical parameters...")
        system_prompt = get_ai_composer_agent_initial_system_prompt()
        self.anthropic_client2.set_system_prompt(system_prompt)
        
        message = f"""Based on this description: {prompt}

I need you to determine the musical parameters (key, mode, BPM, melody instrument, chords instrument, and chord progression). 

First, explain your reasoning for each parameter:
1. What key would work best and why?
2. What mode would complement this and why?
3. What tempo (BPM) would capture the right feel and why?
4. What chord progression would support this style and why?
5. What melody instrument would work best and why? (Suggest a general type, not a specific soundfont yet)
6. What chords instrument would work best and why? (Suggest a general type, not a specific soundfont yet)

After you've explained your choices, use the determine_musical_parameters tool to set these values.

**IMPORTANT: Explain your reasoning for each parameter before using the tool.**

Here is some research we've done on the description: {research_result} 
And here is some research we've done on the chord progression: {chord_research_result}"""
        
        # Ask for reasoning first
        await self.anthropic_client2.send_message_async(message, queue, stream=True, tools=[])
        
        # Ask for tool use
        message = """
        Now use the "determine_musical_parameters" tool to set the musical parameters based on your previous reasoning.
        """
        _, tool_use_json = await self.anthropic_client2.send_message_async(message, queue, stream=True, tools=[DETERMINE_MUSICAL_PARAMETERS_TOOL])
        
        if not tool_use_json:
             raise ValueError("Failed to get musical parameters from LLM tool use.")

        self._set_musical_params(
            tool_use_json.get("key"), 
            tool_use_json.get("mode"), 
            tool_use_json.get("chord_progression"), 
            tool_use_json.get("tempo"),
            tool_use_json.get("melody_instrument"), # Store suggested names/types for now
            tool_use_json.get("chords_instrument")
        )
        logger.info(f"Determined Musical Params: {self.musical_params}")
        await queue.action(AssistantAction.change_bpm(value=self.musical_params.bpm))
        # Optionally send key/mode change action here if needed by frontend immediately
        # await queue.action(AssistantAction.change_key(value=(self.musical_params.key + self.musical_params.mode)))

    async def _select_instruments_via_llm(self, queue: SSEQueueManager):
        """Selects specific soundfonts using an LLM based on available soundfonts and desired roles."""
        logger.debug("Selecting instruments via LLM...")
        soundfont_names = [sf["name"] for sf in self.available_soundfonts]
        
        # Prepare message with suggested roles from initial parameter determination
        melody_suggestion = f"The suggested melody instrument type is: {self.musical_params.melody_instrument_suggestion}" if self.musical_params.melody_instrument_suggestion else ""
        chords_suggestion = f"The suggested chords instrument type is: {self.musical_params.chords_instrument_suggestion}" if self.musical_params.chords_instrument_suggestion else ""
        
        message = f"""Now we need to select specific instruments (soundfonts) for the composition. 
        
{melody_suggestion}
{chords_suggestion}

Look through this list of available soundfonts and select specific ones that fit the roles (melody, chords) and the overall style. 
Available Soundfonts: {soundfont_names} 

Explain your choices briefly for each role. You should select at least one instrument for melody and one for chords. Make sure they fit well together.

After explaining, use the select_instruments tool to finalize your choices."""

        # Ask for reasoning
        await self.anthropic_client2.send_message_async(message, queue, stream=True, tools=[])

        # Ask for tool use
        message = "Now use the select_instruments tool to confirm your instrument selections."
        _, tool_use_json = await self.anthropic_client2.send_message_async(message, queue, stream=True, tools=[SELECT_INSTRUMENTS_TOOL])
        
        if not tool_use_json:
             raise ValueError("Failed to get instrument selections from LLM tool use.")
             
        self._process_instrument_selections(tool_use_json)
        logger.info(f"Selected Instruments: {self.selected_instruments}")
        
    def _process_instrument_selections(self, tool_use_args: Dict[str, Any]):
        """Processes the instrument selections from the LLM tool use."""
        instrument_selections = tool_use_args.get("instrument_selections", [])
        if not instrument_selections:
            logger.warning("LLM did not select any instruments.")
            # Basic fallback: Assign first available soundfont to melody and second to chords if available
            if len(self.available_soundfonts) >= 1:
                 self._add_selected_instrument(self.available_soundfonts[0], "melody", "Fallback selection")
            if len(self.available_soundfonts) >= 2:
                 self._add_selected_instrument(self.available_soundfonts[1], "chords", "Fallback selection")
            return

        # Create a lookup map for faster access
        soundfont_map = {sf["name"]: sf for sf in self.available_soundfonts}

        self.selected_instruments = [] # Clear previous selections if any
        for selection in instrument_selections:
            instrument_name = selection.get("instrument_name")
            role = selection.get("role")
            explanation = selection.get("explanation", "")

            if instrument_name in soundfont_map:
                soundfont_data = soundfont_map[instrument_name]
                self._add_selected_instrument(soundfont_data, role, explanation)
            else:
                logger.warning(f"LLM selected instrument '{instrument_name}' not found in available soundfonts.")
                
        # Ensure we have at least one melody and one chord instrument if possible
        has_melody = any(inst.role == "melody" for inst in self.selected_instruments)
        has_chords = any(inst.role == "chords" for inst in self.selected_instruments)

        if not has_melody and self.available_soundfonts:
             logger.warning("No melody instrument selected, assigning fallback.")
             # Assign first available that isn't already assigned to chords
             fallback_melody = next((sf for sf in self.available_soundfonts if sf['name'] not in [inst.name for inst in self.selected_instruments if inst.role == 'chords']), self.available_soundfonts[0])
             self._add_selected_instrument(fallback_melody, "melody", "Fallback for missing melody role")
        
        if not has_chords and self.available_soundfonts:
             logger.warning("No chords instrument selected, assigning fallback.")
             # Assign first available that isn't already assigned to melody
             fallback_chords = next((sf for sf in self.available_soundfonts if sf['name'] not in [inst.name for inst in self.selected_instruments if inst.role == 'melody']), self.available_soundfonts[0])
             self._add_selected_instrument(fallback_chords, "chords", "Fallback for missing chords role")

    def _add_selected_instrument(self, soundfont_data: Dict[str, Any], role: str, description: str):
        """Adds a selected instrument to the list, avoiding duplicates."""
        # Check if an instrument with the same name is already added
        if any(inst.name == soundfont_data["name"] for inst in self.selected_instruments):
             logger.debug(f"Instrument '{soundfont_data['name']}' already selected, skipping duplicate add.")
             return
             
        instrument = Instrument(
            id=soundfont_data["id"],
            name=soundfont_data["name"],
            description=description,
            soundfont_name=soundfont_data["name"], # Redundant? name should suffice
            storage_key=soundfont_data["storage_key"],
            role=role
        )
        self.selected_instruments.append(instrument)
        logger.info(f"Added instrument: {instrument.name} with role: {instrument.role}")

    async def _generate_chords(self, queue: SSEQueueManager):
        """Generates the chord progression MIDI data."""
        logger.debug("Generating chords...")
        try:
            chords_result = await self._handle_create_chords(queue=queue)
            if chords_result:
                logger.info(f"Successfully generated chord progression")
            else:
                logger.warning("Chord generation did not return results.")
        except Exception as e:
            logger.error(f"Error generating chord progression: {str(e)}", exc_info=True)
            # Decide if we should raise or continue without chords
            # For now, we log and continue, the final result will lack chords.
            self.musical_params.chords = None 

    async def _generate_melody(self, prompt: str, queue: SSEQueueManager):
        """Generates the melody MIDI data using an LLM."""
        logger.debug("Generating melody...")
        
        melody_instrument = next((inst for inst in self.selected_instruments if inst.role == "melody"), None)
        if not melody_instrument:
             logger.error("Cannot generate melody: No melody instrument selected.")
             # Potentially raise an error or handle gracefully
             return

        # Ask LLM to describe the melody first (optional but good practice)
        message = f"""Describe a suitable melody for the following description: '{prompt}'.
Consider the key ({self.musical_params.key} {self.musical_params.mode}), tempo ({self.musical_params.bpm} BPM), chord progression ({self.musical_params.chord_progression}), and the chosen melody instrument ({melody_instrument.name}). 
Describe the melody in terms of: mood, rhythm, musical style, and overall character.
Then, use the create_melody tool to generate the notes."""
        
        # Ask for description and tool use in one go? Or separate? Let's try separate for clarity.
        await self.anthropic_client2.send_message_async(message, queue, stream=True, tools=[]) 
        
        # Ask for tool use
        message = f"Now use the create_melody tool to generate the melody notes based on your description and the established musical parameters (Key: {self.musical_params.key} {self.musical_params.mode}, Tempo: {self.musical_params.bpm} BPM, Chord Progression: {self.musical_params.chord_progression}, Melody Instrument: {melody_instrument.name})."
        
        # Send message to Anthropic to get melody parameters via tool
        _, tool_use_json = await self.anthropic_client2.send_message_async(message, queue, stream=True, tools=[CREATE_MELODY_TOOL])

        if not tool_use_json:
             raise ValueError("Failed to get melody generation parameters from LLM tool use.")
             
        try:
            await self._handle_create_melody(tool_use_json, queue)
            logger.info("Successfully generated melody.")
        except Exception as e:
            logger.error(f"Error generating melody: {str(e)}", exc_info=True)
            # Decide if we should raise or continue without melody
            self.musical_params.melody = None
            
    async def _handle_create_chords(self, args: Dict[str, Any] = None, queue: SSEQueueManager = None) -> Optional[Dict[str, Any]]:
        """
        Handle chord generation based on the musical parameters.
        Generate MIDI notes for the chord progression and format for client use.
        
        Args:
            args: Optional arguments (currently unused, relies on self.musical_params)
            queue: SSEQueueManager for sending updates.
            
        Returns:
            Dictionary with chord data formatted for client use, or None if failed.
        """
        key = self.musical_params.key
        mode = self.musical_params.mode
        tempo = self.musical_params.bpm # Not directly used in transform, but good context
        chord_progression = self.musical_params.chord_progression
        
        if not all([key, mode, tempo, chord_progression]):
             logger.error("Cannot generate chords: Missing key, mode, tempo, or chord progression.")
             return None

        # Find an appropriate instrument for chords from selected instruments
        chord_instrument = next((inst for inst in self.selected_instruments if inst.role == "chords"), None)
                
        if not chord_instrument:
            logger.error("No 'chords' role instrument selected for chord progression")
            # Fallback: Use the first selected instrument if available? Or fail? Let's fail for now.
            # If needed, uncomment below:
            # if self.selected_instruments:
            #    chord_instrument = self.selected_instruments[0]
            #    logger.warning(f"No dedicated chord instrument, using fallback: {chord_instrument.name}")
            # else:
            #    logger.error("No instruments selected at all.")
            #    return None
            return None # Fail if no chord instrument explicitly selected/assigned

        logger.info(f"Generating chord progression: '{chord_progression}' in {key} {mode} using {chord_instrument.name}")
        
        try:
            # Standardize chord progression format (replace spaces/commas with hyphens)
            if isinstance(chord_progression, str):
                 processed_chord_progression = re.sub(r'[,\s]+', '-', chord_progression).strip('-')
            else:
                 logger.error(f"Invalid chord progression format: {chord_progression}")
                 return None

            result = transform_chord_progression_to_instrument_format(
                chord_progression=processed_chord_progression,
                instrument=chord_instrument, # Pass the Instrument object
                key=key
            )
            
            # Check if result is valid and contains notes
            if not result or 'notes' not in result or not result['notes']:
                 logger.error(f"Chord transformation returned empty or invalid result for progression '{processed_chord_progression}'")
                 return None

            self.musical_params.chords = result # Store the generated chord data
            
            # Add metadata for the client/frontend
            result["part_type"] = "chords"
            result["description"] = f"Chord progression {processed_chord_progression} in {key} {mode}"
            
            await queue.action(AssistantAction.add_track(
                type=TrackType.MIDI,
                instrument_id=chord_instrument.id,
                notes=result.get('notes')
            ))
            
            logger.info(f"Generated chord progression with {len(result.get('notes', []))} notes")
            return result
            
        except Exception as e:
            logger.error(f"Error during chord transformation/MIDI generation: {str(e)}")
            logger.error(f"Stack trace: {traceback.format_exc()}")
            # Raise? Or return None? Returning None for now to potentially allow melody generation still.
            return None
    
    async def _handle_create_melody(self, args: Dict[str, Any], queue: SSEQueueManager) -> Optional[Dict[str, Any]]:
        """Handles the melody generation process based on LLM tool output and musical parameters."""
        
        # Extract parameters from the LLM tool call results (args)
        # These might describe the desired melody characteristics
        instrument_name_llm = args.get("instrument_name", "") # LLM might suggest an instrument name again
        description = args.get("description", "")
        duration_beats = args.get("duration_beats", self.musical_params.duration_beats) # Use class default if not provided
        duration_bars = args.get("duration_bars", self.musical_params.duration_bars) # Use class default if not provided
        mood = args.get("mood", "")
        tempo_character = args.get("tempo_character", "") # e.g., "driving", "relaxed"
        rhythm_type = args.get("rhythm_type", "") # e.g., "syncopated", "straight"
        musical_style = args.get("musical_style", "") # e.g., "jazzy", "classical"
        melodic_character = args.get("melodic_character", "") # e.g., "angular", "smooth"

        # Get core parameters from the service state
        key = self.musical_params.key
        mode = self.musical_params.mode
        tempo = self.musical_params.bpm
        allowed_intervals = self.musical_params.allowed_intervals # Already calculated in _set_musical_params
        chord_progression = self.musical_params.chord_progression
        
        if not all([key, mode, tempo, chord_progression]):
             logger.error("Cannot generate melody: Missing key, mode, tempo, or chord progression.")
             return None

        # Find the actual selected melody instrument object
        melody_instrument = next((inst for inst in self.selected_instruments if inst.role == "melody"), None)
        if not melody_instrument:
             logger.error("Cannot generate melody: No 'melody' role instrument selected.")
             return None

        # Log the effective instrument being used
        logger.info(f"Using instrument '{melody_instrument.name}' for melody generation.")
        if instrument_name_llm and instrument_name_llm != melody_instrument.name:
             logger.warning(f"LLM suggested melody instrument '{instrument_name_llm}' in create_melody tool, but using selected instrument '{melody_instrument.name}'.")

        # Build a comprehensive description for the melody generation prompt
        detailed_description = f"Generate a melody for the instrument '{melody_instrument.name}'. "
        detailed_description += description # Add LLM's description
        # Append structured parameters
        structured_params = {
            "key": key, "mode": mode, "tempo": f"{tempo} BPM", "mood": mood,
            "tempo_character": tempo_character, "rhythm_type": rhythm_type,
            "musical_style": musical_style, "melodic_character": melodic_character,
            "chord_progression": chord_progression
        }
        detailed_description += ". Parameters: " + ", ".join(f"{k}='{v}'" for k, v in structured_params.items() if v)
        detailed_description += f". The duration should be approximately {duration_bars} bars ({duration_beats} beats)."
        detailed_description += f". Adhere strictly to the key ({key} {mode}) and follow the chord progression ({chord_progression}) closely."

        # Log the input for debugging
        logger.info(f"Requesting melody generation with description: {detailed_description[:150]}...")
        
        # Ensure Anthropic client is available (already checked in compose_music conceptually)
        # if not self.anthropic_client: ... (handled by AnthropicClient init likely)

        try:
            # Prepare context for the melody generation LLM (e.g., system prompt, note probabilities)
            allowed_intervals_string = ", ".join(map(str, allowed_intervals))
            
            system_prompt = get_melody_create_prompt(
                key, mode, tempo, allowed_intervals_string, chord_progression,
                mood, tempo_character, rhythm_type, musical_style, melodic_character, 
                duration_bars, duration_beats
            )
            self.melody_composer.set_system_prompt(system_prompt)
            
            # Chord analysis for note probabilities
            try:
                 chord_progression_list = re.split(r'[-,\s]+', chord_progression)
                 # Basic cleaning, might need more robust parsing depending on expected format
                 chord_progression_list = [chord.strip().replace("b", "-") for chord in chord_progression_list if chord.strip()] 
                 note_probabilities = analyze_chord_progression(chord_progression_list, key)
                 note_probabilities_string = json.dumps(note_probabilities, indent=2) # Use 2 spaces for compactness
                 logger.debug(f"Note probabilities calculated for chords: {chord_progression_list}")
            except Exception as analysis_err:
                 logger.error(f"Failed to analyze chord progression for note probabilities: {analysis_err}", exc_info=True)
                 note_probabilities_string = "{}" # Provide empty object if analysis fails

            # Construct the final message for the melody generation LLM
            message = f"""Create the musical notes for a melody based on the following:
Description: {detailed_description}
Use this note probability data derived from the chord progression to guide note selection: 
{note_probabilities_string}

Constraints:
- Adhere strictly to the key of {key} {mode}.
- Follow the chord progression '{chord_progression}' closely.
- The output MUST be ONLY a valid JSON object representing the melody structure (e.g., bars, notes with pitch, start_beat, duration_beats).
- Do NOT include any explanatory text, comments, or markdown formatting before or after the JSON object.

Example JSON structure (adapt as needed for your expected format):
{{
  "bars": [
    {{ "bar": 1, "notes": [{{"pitch": 60, "start_beat": 0, "duration_beats": 1}}, ...] }},
    {{ "bar": 2, "notes": [...] }}
  ]
}}

Generate the JSON output now."""

            # Call the LLM to generate the melody JSON
            await queue.stage("Generating melody notes...", "Asking the AI composer to write the melody...")
            content_text, _ = await self.melody_composer.send_message_async(message, queue, stream=True, thinking=True)
            
            # Log the raw response for debugging
            logger.debug(f"Raw melody LLM response (first 500 chars): {content_text[:500]}")
            
            # Extract and parse the JSON melody data
            melody_data = self._extract_json_from_text(content_text)
            if not melody_data:
                 logger.error("Failed to extract valid JSON melody data from the LLM response.")
                 raise ValueError("LLM response did not contain valid JSON for melody.")

            logger.info(f"Successfully parsed melody JSON data.")
            logger.debug(f"Parsed Melody Data (snippet): {json.dumps(melody_data)[:200]}...")
            
            # Transform the melody data into the required instrument format
            result = transform_bars_to_instrument_format(melody_data, melody_instrument, key)
            
            if not result or 'notes' not in result or not result['notes']:
                 logger.error("Melody transformation returned empty or invalid result.")
                 return None
                 
            self.musical_params.melody = result # Store the generated melody data
            
            # Add metadata for the client/frontend
            result["part_type"] = "melody"
            result["description"] = f"Melody for {melody_instrument.name} in {key} {mode}"
            
            # Send action to frontend
            await queue.action(AssistantAction.add_track(
                type=TrackType.MIDI,
                instrument_id=melody_instrument.id,
                notes=result.get('notes')
            ))
            
            logger.info(f"Generated melody with {len(result.get('notes', []))} notes.")
            return result
                
        except Exception as e:
            logger.error(f"Error during melody generation: {str(e)}")
            logger.error(f"Stack trace: {traceback.format_exc()}")
            # Raise? Or return None? Returning None for now.
            return None
            
    def _extract_json_from_text(self, text: str) -> Optional[Dict[str, Any]]:
        """
        Attempts to extract a JSON object from a string.
        Handles markdown code blocks and raw JSON.
        """
        logger.debug(f"Attempting to extract JSON from text (length {len(text)})...")
        
        # 1. Try finding JSON within markdown code blocks (```json ... ``` or ``` ... ```)
        json_match = re.search(r'```(?:json)?\s*({.*?})\s*```', text, re.DOTALL | re.IGNORECASE)
        if json_match:
            json_content = json_match.group(1)
            logger.debug("Found JSON within markdown code block.")
            try:
                # Basic cleaning within the block (remove potential leading/trailing non-JSON chars)
                json_content = json_content.strip()
                # Attempt parsing
                parsed_json = json.loads(json_content)
                logger.info("Successfully parsed JSON from markdown block.")
                return parsed_json
            except json.JSONDecodeError as e:
                logger.warning(f"Failed to parse JSON from markdown block: {e}. Content: {json_content[:100]}...")
                # Fall through to other methods

        # 2. Try finding the first brace `{` and last brace `}` and parsing content between them
        first_brace = text.find('{')
        last_brace = text.rfind('}')
        if first_brace != -1 and last_brace != -1 and last_brace > first_brace:
            potential_json = text[first_brace:last_brace + 1]
            logger.debug("Attempting to parse content between first/last braces.")
            try:
                parsed_json = json.loads(potential_json)
                logger.info("Successfully parsed JSON between first/last braces.")
                return parsed_json
            except json.JSONDecodeError as e:
                logger.warning(f"Failed to parse JSON between first/last braces: {e}. Content: {potential_json[:100]}...")
                # Fall through

        # 3. Try a more robust regex to find JSON object (might be slower)
        # This looks for balanced braces. Caution: Can be computationally expensive on very large texts.
        # json_regex_match = re.search(r'\{(?:[^{}]|(?R))*\}', text) # Recursive regex - might be slow/complex
        # A simpler greedy approach might suffice for many cases:
        json_regex_match = re.search(r'({[\s\S]*})', text) 
        if json_regex_match:
             potential_json = json_regex_match.group(1)
             logger.debug("Attempting to parse JSON found via greedy regex.")
             try:
                 # Clean comments just in case (though prompt asks not to include them)
                 potential_json = re.sub(r'//.*?\n|/\*.*?\*/', '', potential_json, flags=re.DOTALL)
                 parsed_json = json.loads(potential_json)
                 logger.info("Successfully parsed JSON via greedy regex.")
                 return parsed_json
             except json.JSONDecodeError as e:
                 logger.warning(f"Failed to parse JSON from greedy regex match: {e}. Content: {potential_json[:100]}...")
                 # Fall through
                 
        # 4. If all else fails
        logger.error("Could not find or parse valid JSON in the provided text.")
        return None
        
    
    def _set_musical_params(self, key, mode, chord_progression, bpm, melody_instrument_suggestion, chords_instrument_suggestion):
        """Sets the core musical parameters."""
        self.musical_params.key = key or "C" # Default if not provided
        self.musical_params.mode = mode or "major" # Default if not provided
        self.musical_params.chord_progression = chord_progression or "I-V-vi-IV" # Default
        try:
             self.musical_params.bpm = int(bpm) if bpm else 120 # Default
        except (ValueError, TypeError):
             logger.warning(f"Invalid BPM value received: {bpm}. Defaulting to 120.")
             self.musical_params.bpm = 120
             
        # Calculate allowed intervals based on mode
        try:
            self.musical_params.allowed_intervals = get_mode_intervals(self.musical_params.mode)
        except ValueError as e:
             logger.warning(f"Could not determine intervals for mode '{self.musical_params.mode}': {e}. Using major scale intervals.")
             self.musical_params.allowed_intervals = get_mode_intervals("major") # Default to major

        # Store the *suggestions* for instruments, actual selection happens later
        self.musical_params.melody_instrument_suggestion = melody_instrument_suggestion
        self.musical_params.chords_instrument_suggestion = chords_instrument_suggestion
        
        # Reset generated parts - they will be created later
        self.musical_params.melody = None
        self.musical_params.chords = None
        self.musical_params.counter_melody = None # Reset counter melody too
        
        # Reset selected instruments list - selection happens after this step
        self.selected_instruments = []

    @staticmethod   
    def _get_stream_response(response) -> tuple[str, dict]:
        content_text = ""
        tool_use_started = False
        tool_use_data = []
        for data in response:
            if tool_use_started:
                tool_use_data.append(data)
            if hasattr(data, "delta") and hasattr(data.delta, "text"):
                chunk_text = data.delta.text
                print(chunk_text)
                if chunk_text:
                    content_text += chunk_text
                    logger.info(f"Received {len(content_text)} characters so far...")
            if data.type == "content_block_start":
                if data.content_block.type == "tool_use":
                    tool_use_started = True
                    print(data.content_block)
            if data.type == "content_block_end":
                tool_use_started = False
        print("TOOL USE DATA:", tool_use_data)
        tool_use_json = MusicGenService._parse_tool_use_data(tool_use_data)
        print("TOOL USE JSON:", tool_use_json)
        return content_text, tool_use_json
    
    @staticmethod
    def _parse_tool_use_data(tool_use_data) -> dict:
        full_json = ""
        for data in tool_use_data:
            # Only process RawContentBlockDeltaEvent events that have delta attribute
            if hasattr(data, 'delta') and hasattr(data.delta, 'partial_json'):
                full_json += data.delta.partial_json
        
        try:
            # Parse the accumulated JSON string into a Python dict
            if full_json:
                return json.loads(full_json)
            return None
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse tool use JSON: {e}")
            return None

music_gen_service = MusicGenService()