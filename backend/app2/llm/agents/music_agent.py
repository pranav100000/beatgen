import asyncio
import json # Added for json.dumps used later
import re # Added for splitting chord progression string
from pydantic import BaseModel, Field
from typing import List, Optional, Any, Dict, Type, Union
import uuid
from sqlmodel import Session # Added Union

# Remove Pydantic AI direct imports
# from pydantic_ai import Agent, RunContext, Tool 
# from pydantic_ai.models.test import TestModel
# from pydantic_ai.messages import ToolReturnPart

# Schemas from the music_gen_service will be crucial
# We\'\'\'ll need to adjust import paths based on final project structure
# For now, assuming they can be imported like this:
from app2.sse.sse_queue_manager import SSEQueueManager
from app2.llm.music_gen_service.llm_schemas import (
    DetermineMusicalParameters,
    FullMusicalParameters,
    IntervalMelodyOutput,
    LLMDeterminedMusicalParameters, 
    SelectInstruments, 
    InstrumentSelectionItem,
    MelodyData, 
    Note, 
    Bar,
    SelectDrumSounds,
    CreateDrumBeat,
    DrumBeatPatternItem,
    ChordProgressionOutput,
    BaseCoerceModel,
    SongComposition,
    SongRequest
)
# Utilities from music_gen_service
from app2.llm.music_gen_service.music_researcher import MusicResearcher
from app2.core.logging import get_service_logger
from app2.models.track_models.drum_track import DrumTrackRead
from app2.models.track_models.sampler_track import SamplerTrackRead
from services.soundfont_service.soundfont_service import soundfont_service
from app2.api.dependencies import (
    get_drum_sample_service,
    get_drum_sample_public_repository,
)
from app2.models.track_models.midi_track import MidiTrackRead
from app2.models.public_models.instrument_file import InstrumentFileRead
from app2.types.assistant_actions import AssistantAction

# We\'\'\'ll need to mock or adapt soundfont_service and drum_sample_service for now
# from pydantic_ai_wrapper.music_gen_service.soundfont_service import soundfont_service
# from pydantic_ai_wrapper.music_gen_service.drum_sample_service import drum_sample_service
# from app2.llm.music_gen_service.midi2 import (
#     transform_chord_progression_to_instrument_format,
#     transform_drum_beats_to_midi_format 
#     # Add other necessary midi transformations
# )
from app2.llm.music_gen_service.midi import (
    convert_interval_melody_to_absolute_melody,
    correct_notes_in_key,
    transform_chord_progression_to_instrument_format,
    transform_bars_to_instrument_format,
    transform_drum_beats_to_midi_format,
    transform_melody_data_to_instrument_format 
    # Add other necessary midi transformations
)
# from pydantic_ai_wrapper.music_gen_service.music_utils import get_mode_intervals # If needed

# Schemas from music_gen_tools.py for descriptions
from app2.llm.music_gen_service.music_gen_tools import (
    DETERMINE_MUSICAL_PARAMETERS_TOOL as DMP_TOOL_DEF,
    SELECT_INSTRUMENTS_TOOL as SI_TOOL_DEF,
    CREATE_MELODY_TOOL as CM_TOOL_DEF, # We'll need a way to call LLM for notes
    CREATE_DRUM_BEAT_TOOL as CDB_TOOL_DEF, # Similar, calls LLM for patterns
    SELECT_DRUM_SOUNDS_TOOL as SDS_TOOL_DEF
)

from app2.llm.music_gen_service.prompt_utils import (
    get_ai_composer_agent_initial_system_prompt,
    get_melody_create_prompt # Added import
)

# Import the new validation function
from app2.llm.music_gen_service.music_utils import get_scale_pitch_classes, validate_melody_in_key, get_complete_scale_pitch_classes
# Import chord progression analysis function
from app2.llm.music_gen_service.chord_progression_analysis import analyze_chord_progression

from app2.llm.chat_wrapper import ChatSession # Keep this import
from app2.llm.available_models import ModelInfo # Import the new dataclass
from app2.llm.streaming import TextDeltaEvent # Import TextDeltaEvent

from app2.core.config import settings

# --- Input and Output Schemas for the Main Agent Tool ---


logger = get_service_logger("music_agent")

# --- Music Generation Agent State Keys ---
class MusicAgentStateKeys:
    SONG_REQUEST = "song_request"
    MUSICAL_PARAMETERS = "musical_parameters" # Stores DetermineMusicalParameters model + title
    AVAILABLE_SOUNDFONTS = "available_soundfonts"
    AVAILABLE_DRUM_SAMPLES = "available_drum_samples"
    SOUNDFONT_MAP = "soundfont_map" # name to soundfont object
    DRUM_SAMPLE_MAP = "drum_sample_map" # name to drum sample object
    SELECTED_INSTRUMENTS_RAW = "selected_instruments_raw" # Stores SelectInstruments model
    PROCESSED_INSTRUMENTS = "processed_instruments" # Role -> {soundfont, notes[]}
    GENERATED_MELODY_DATA = "generated_melody_data" # Stores MelodyData
    SELECTED_DRUM_SOUNDS_RAW = "selected_drum_sounds_raw" # Stores SelectDrumSounds model
    PROCESSED_DRUM_SOUNDS = "processed_drum_sounds" # List of drum sample objects
    GENERATED_DRUM_BEAT_DATA = "generated_drum_beat_data" # Stores CreateDrumBeat model


# --- Music Generation Agent (No longer a Pydantic AI Agent) ---

# Remove Pydantic AI TestModel and default settings
# default_model = TestModel() 
# default_model_settings: Dict[str, Any] = {}

class MusicGenerationAgent:
    _music_researcher: MusicResearcher

    def __init__(self):
        #self._init_mock_data()
        self._music_researcher = MusicResearcher()

        
    async def _init_real_data(self, session: Session):
        _drum_file_repository = get_drum_sample_public_repository(session)
        drum_sample_service = get_drum_sample_service(_drum_file_repository)
        self._available_soundfonts = await soundfont_service.get_public_soundfonts()
        self._available_drum_samples = await drum_sample_service.get_all_samples()
        self._soundfont_map = {sf["name"]: sf for sf in self._available_soundfonts}
        self._drum_sample_map = {ds.display_name: ds for ds in self._available_drum_samples}
        self._drum_sample_id_map = {str(ds.id): ds for ds in self._available_drum_samples}

    # --- Helper for Focused LLM Calls (No longer uses RunContext) ---
    async def _focused_llm_call(self, prompt: str, output_type: Type[BaseModel]) -> BaseModel:
        """Helper to make an isolated LLM call for structured output using ChatSession."""
        logger.info(f"DEBUG: _focused_llm_call using self.chat_session for schema: {output_type.__name__}")
        
        llm_call_model_settings: Dict[str, Any] = {}
        max_retries = 1 # Max number of retries (so 1 retry means 2 attempts total)
        if output_type is IntervalMelodyOutput: # More retries for complex melody generation
            max_retries = 2

        llm_output_obj: Optional[BaseModel] = None
        last_error: Optional[Exception] = None
        current_prompt = prompt

        for attempt in range(max_retries + 1):
            logger.info(f"Attempt {attempt + 1} for {output_type.__name__}...")
            raw_llm_output_data_str: Optional[str] = None
            last_error = None # Reset last_error for this attempt
            try:
                response_data = await self.chat_session.send_message_async(
                    user_prompt_content=current_prompt,
                    stream=False,
                    model_settings=llm_call_model_settings,
                    expect_json=True
                )

                if isinstance(response_data, str):
                    raw_llm_output_data_str = response_data
                    parsed_json_data = json.loads(raw_llm_output_data_str)
                    
                    if output_type is CreateDrumBeat: # Specific correction logic
                        if isinstance(parsed_json_data, dict) and 'drum_beats' in parsed_json_data and isinstance(parsed_json_data['drum_beats'], list):
                            for item_dict in parsed_json_data['drum_beats']:
                                if isinstance(item_dict, dict) and 'pattern' in item_dict and isinstance(item_dict['pattern'], list):
                                    pat = item_dict['pattern']
                                    expected_len = 32
                                    if len(pat) > expected_len:
                                        logger.info(f"ChatSession parse: Truncating drum pattern for {item_dict.get('drum_sound_id', 'N/A')} from {len(pat)} to {expected_len}.")
                                        item_dict['pattern'] = pat[:expected_len]
                                    elif len(pat) < expected_len:
                                        logger.info(f"ChatSession parse: Padding drum pattern for {item_dict.get('drum_sound_id', 'N/A')} from {len(pat)} to {expected_len}.")
                                        item_dict['pattern'].extend([False] * (expected_len - len(pat)))
                    
                    llm_output_obj = output_type(**parsed_json_data)
                    logger.info(f"Successfully parsed and validated output for {output_type.__name__} on attempt {attempt + 1}.")
                    break # Successful parse and validation, exit retry loop
                
                elif isinstance(response_data, output_type):
                    llm_output_obj = response_data
                    logger.info(f"Warning: ChatSession unexpectedly returned a parsed Pydantic object of type {type(response_data)}.")
                    break # Exit loop as we got a directly usable object
                else:
                    last_error = TypeError(f"ChatSession returned unexpected data type: {type(response_data)}. Content: {str(response_data)[:200]}...")
                    logger.info(f"Error on attempt {attempt + 1}: {last_error}")

            except json.JSONDecodeError as jde:
                last_error = jde
                logger.info(f"ERROR on attempt {attempt + 1} (JSONDecodeError) for {output_type.__name__}: {jde}. Raw: '{raw_llm_output_data_str if raw_llm_output_data_str else 'N/A'}...'")
            except Exception as e_pydantic: # Catches Pydantic validation errors or others
                last_error = e_pydantic
                parsed_json_for_error_msg = raw_llm_output_data_str if raw_llm_output_data_str else 'N/A (no raw string)'
                if 'parsed_json_data' in locals() and isinstance(parsed_json_data, dict):
                    parsed_json_for_error_msg = str(parsed_json_data)
                logger.info(f"ERROR on attempt {attempt + 1} (Pydantic/Validation Error) for {output_type.__name__}: {e_pydantic}. Data: {parsed_json_for_error_msg}...")
            
            if llm_output_obj: # Should have broken if successful
                break

            # If not the last attempt and an error occurred, prepare for retry
            if attempt < max_retries and last_error:
                logger.info(f"Preparing for retry attempt {attempt + 2} for {output_type.__name__}...")
                # Use str(last_error) directly. Limit previous raw output to a reasonable length.
                prev_output_for_retry = (raw_llm_output_data_str + '...' if raw_llm_output_data_str and len(raw_llm_output_data_str) > 500 else raw_llm_output_data_str) or 'N/A'

                retry_instruction = (
                    f"The previous attempt to generate JSON for {output_type.__name__} failed. "
                    f"Please carefully review the original request and the following error, then provide a corrected JSON response. "
                    f"Ensure your entire response is a single, valid JSON object matching the schema, with all keys and string values in double quotes.\n"
                    f"Previous Error: {str(last_error)}\n"
                    f"Previous Raw Output (possibly truncated):\n{prev_output_for_retry}\n\n"
                    f"Original request was (please regenerate response based on this original request, incorporating corrections):\n{prompt}"
                )
                current_prompt = retry_instruction # Use this elaborated prompt for the next attempt
            elif attempt >= max_retries and last_error and not llm_output_obj:
                logger.info(f"All {max_retries + 1} attempts failed for {output_type.__name__}. Last error: {last_error}")
        
        if not llm_output_obj: 
            logger.info(f"Warning: All attempts for {output_type.__name__} failed. Constructing fallback.")
            # Try to construct a fallback object
            try:
                if output_type is LLMDeterminedMusicalParameters:
                    llm_output_obj = LLMDeterminedMusicalParameters(chord_progression="C-G-Am-F", key="C", mode="major", tempo=120, melody_instrument_suggestion="Piano", chords_instrument_suggestion="Strings", song_title="Fallback Title")
                elif output_type is SelectInstruments: 
                    llm_output_obj = SelectInstruments(instrument_selections=[])
                elif output_type is MelodyData: 
                    llm_output_obj = MelodyData(bars=[])
                elif output_type is IntervalMelodyOutput:
                    llm_output_obj = IntervalMelodyOutput(starting_octave=3, bars=[])
                elif output_type is SelectDrumSounds: 
                    llm_output_obj = SelectDrumSounds(drum_sounds=[])
                elif output_type is CreateDrumBeat:
                    llm_output_obj = CreateDrumBeat(drum_beats=[])
                else:
                    llm_output_obj = output_type() # Generic fallback construction
                
                logger.info(f"Successfully constructed fallback for {output_type.__name__}.")
            except Exception as e_constr_fallback: 
                # If even fallback construction fails, then we must raise an error.
                logger.info(f"Fatal: Failed to construct fallback for {output_type.__name__} after ChatSession failure: {e_constr_fallback}."); 
                raise # Re-raise the construction error for the fallback
        
        return llm_output_obj # Return the validated object or the successfully constructed fallback

    # --- Music Generation Steps (formerly tools, now regular methods) ---

    async def determine_musical_parameters(self, user_prompt: str, duration_bars: int) -> FullMusicalParameters:
        """Determines core musical parameters via LLM call, streaming explanation first."""
        logger.info(f"Step 'determine_musical_parameters' called with user_prompt: '{user_prompt}', duration_bars: {duration_bars}")

        # 1. Stream Explanation
        explanation_prompt = f"""Based on the user request: '{user_prompt}' for a song of {duration_bars} bars, please explain your reasoning for the following musical parameters:
1. Key and Mode: What key/mode would fit the description and why?
2. Tempo (BPM): What tempo would capture the right feel and why?
3. Chord Progression: Suggest a suitable chord progression and explain why it works.
4. Melody Instrument Suggestion: What type of instrument would be good for the melody?
5. Chords Instrument Suggestion: What type of instrument would be good for the chords?
6. Song Title Suggestion: Suggest a title.

Provide only your reasoning and suggestions conversationally. Do NOT output JSON in this step."""
        
        logger.info("Streaming explanation for musical parameters...")
        try:
            async for text_chunk in await self.chat_session.send_message_async(
                user_prompt_content=explanation_prompt,
                stream=True
                # Note: History might be needed here if reasoning depends on prior turns.
                # For now, assume reasoning is based on the current user_prompt context.
                # This stream's messages are NOT added to the main history used for JSON generation.
            ):
                if isinstance(text_chunk, str): # Check if it's a string delta
                    logger.debug(f"STREAMING TEXT CHUNK: '{text_chunk}'") 
                    await self.chat_session.queue.add_chunk(text_chunk)
                # else:
                    # If ChatSession might yield other event types (e.g., error events),
                    # handle them here or ensure they are not strings.
                    # logger.debug(f"STREAMING OTHER EVENT TYPE: {type(text_chunk)}")

            logger.info("Finished streaming explanation.")
        except Exception as e:
            logger.error(f"Error streaming explanation for musical parameters: {e}")
            await self.chat_session.queue.error("Failed to stream parameter explanation.") # Use chat_session's queue

        await self.chat_session.queue.add_chunk("\n\n")
        await self.chat_session.queue.add_chunk("---")
        await self.chat_session.queue.add_chunk("\n\n")
        # 2. Get JSON Data (Focused Call)
        logger.info("Requesting JSON for musical parameters...")
        schema_example_for_focused_call = json.dumps(LLMDeterminedMusicalParameters.model_json_schema())
        focused_prompt_for_llm = (
            f"Based on the user request: '{user_prompt}' for a song of {duration_bars} bars, and considering the reasoning previously discussed, determine the core musical parameters. "
            f"The response MUST be a valid JSON object precisely matching the 'LLMDeterminedMusicalParameters' schema. "
            f"Schema to follow: {schema_example_for_focused_call}. "
            f"Ensure you populate: 'chord_progression', 'key', 'mode' (major/minor), 'tempo', 'melody_instrument_suggestion', 'chords_instrument_suggestion', and 'song_title' (can be null). "
            f"Output only the JSON object."
        )
        
        # Use the focused call helper which handles retries and uses the main history
        llm_simple_params = await self._focused_llm_call(focused_prompt_for_llm, LLMDeterminedMusicalParameters)

        # 3. Process JSON Data
        if not isinstance(llm_simple_params, LLMDeterminedMusicalParameters):
            logger.info(f"ERROR: _focused_llm_call for determine_musical_parameters did not return LLMDeterminedMusicalParameters. Got {type(llm_simple_params)}. Falling back.")
            return FullMusicalParameters(
                chord_progression="C-G-Am-F", key="C", mode="major", tempo=120,
                melody_instrument_suggestion="Piano", chords_instrument_suggestion="Strings",
                song_title="Fallback Song Title",
                original_user_prompt=user_prompt, 
                duration_bars=duration_bars
            )

        try:
            full_params = FullMusicalParameters(
                **llm_simple_params.model_dump(),
                original_user_prompt=user_prompt, 
                duration_bars=duration_bars
            )
        except Exception as e:
            logger.info(f"Error assembling FullMusicalParameters: {e}. Using fallback.")
            full_params = FullMusicalParameters(
                chord_progression="C-G-Am-F", key="C", mode="major", tempo=120,
                melody_instrument_suggestion="Piano", chords_instrument_suggestion="Strings",
                song_title="Fallback Assembled Title",
                original_user_prompt=user_prompt, 
                duration_bars=duration_bars
            )

        logger.info(f"Step 'determine_musical_parameters' returning: {full_params.model_dump_json(indent=2)}")
        return full_params

    async def select_instruments(self, determined_params: FullMusicalParameters) -> SelectInstruments:
        """Streams explanation, then selects specific instruments via LLM call."""
        logger.info(f"Step 'select_instruments' called for song: {determined_params.song_title if determined_params.song_title else 'Untitled'}")
        soundfont_names_list = [sf["name"] for sf in self._available_soundfonts]

        # 1. Stream Explanation
        explanation_prompt_instruments = f"""Now I need to select specific instruments (soundfonts) for the composition.
Musical Context: Title: '{determined_params.song_title}', Key: {determined_params.key} {determined_params.mode}, Tempo: {determined_params.tempo} BPM.
User prompt: '{determined_params.original_user_prompt}'. Duration: {determined_params.duration_bars} bars.
My initial thoughts were: Melody: '{determined_params.melody_instrument_suggestion}', Chords: '{determined_params.chords_instrument_suggestion}'.

Available Soundfonts are: {json.dumps(soundfont_names_list)}

Please explain your choices for the melody and chords instruments from the available soundfonts. Consider how they fit the style and complement each other. 
Do NOT output JSON in this step, just your conversational reasoning."""

        logger.info("Streaming explanation for instrument selection...")
        try:
            async for text_chunk in await self.chat_session.send_message_async(
                user_prompt_content=explanation_prompt_instruments,
                stream=True
            ):
                if isinstance(text_chunk, str):
                    logger.debug(f"INSTRUMENT EXPLANATION STREAMING TEXT CHUNK: '{text_chunk}'") 
                    await self.chat_session.queue.add_chunk(text_chunk)
            logger.info("Finished streaming instrument selection explanation.")
        except Exception as e:
            logger.error(f"Error streaming instrument selection explanation: {e}")
            await self.chat_session.queue.error("Failed to stream instrument selection explanation.")
            # Potentially return a default/empty SelectInstruments or raise error if critical

        await self.chat_session.queue.add_chunk("\n\n")
        await self.chat_session.queue.add_chunk("---")
        await self.chat_session.queue.add_chunk("\n\n")
        # 2. Get JSON Data (Focused Call)
        logger.info("Requesting JSON for instrument selection...")
        focused_prompt = f"""
Musical Context: Title: '{determined_params.song_title}', Key: {determined_params.key} {determined_params.mode}, Tempo: {determined_params.tempo} BPM.
User prompt: '{determined_params.original_user_prompt}'. Duration: {determined_params.duration_bars} bars.
Suggested Melody Instrument Type: {determined_params.melody_instrument_suggestion}
Suggested Chords Instrument Type: {determined_params.chords_instrument_suggestion}
Available Soundfonts (choose from this list only): {json.dumps(soundfont_names_list)}

Based on our prior discussion and reasoning, select specific soundfonts for 'melody' and 'chords' roles. You can also suggest for 'bass' if appropriate.
Provide your response *only* in the 'SelectInstruments' JSON structure (an object with an 'instrument_selections' list of items, where each item has 'instrument_name', 'role', and 'explanation' fields).
Ensure instrument_name in each selection exactly matches a name from the Available Soundfonts list.
Example of desired JSON structure: {json.dumps(SelectInstruments.model_json_schema(), indent=2)}
Output only the JSON object."""
        
        instrument_selections_raw = await self._focused_llm_call(focused_prompt, SelectInstruments)
        
        # 3. Process JSON Data (existing logic)
        instrument_selections = SelectInstruments(instrument_selections=[]) 
        if hasattr(instrument_selections_raw, 'instrument_selections') and instrument_selections_raw.instrument_selections is not None:
            instrument_selections = SelectInstruments(instrument_selections=instrument_selections_raw.instrument_selections)
        logger.info(f"LLM selected instruments JSON: {instrument_selections.model_dump_json()}")
        validated_selections = []
        if instrument_selections.instrument_selections: 
            for item in instrument_selections.instrument_selections:
                if item.instrument_name in self._soundfont_map:
                    validated_selections.append(item)
                else:
                    logger.info(f"Warning: LLM selected unknown instrument '{item.instrument_name}'. Ignoring.")
        else:
            logger.info("Warning: No instrument selections returned or in unexpected format from focused LLM call.")
        
        # Fallback logic if crucial roles are missing (melody, chords)
        selected_roles = {sel.role.lower() for sel in validated_selections}
        if 'melody' not in selected_roles and self._available_soundfonts:
            logger.warning("No melody instrument selected by LLM, attempting fallback.")
            # Simple fallback: pick the first available soundfont not used for chords
            first_available_melody = next((sf for sf in self._available_soundfonts if sf["name"] not in [s.instrument_name for s in validated_selections if s.role.lower() == 'chords']), self._available_soundfonts[0])
            validated_selections.append(InstrumentSelectionItem(instrument_name=first_available_melody["name"], role="melody", explanation="Fallback for missing melody role."))
            logger.info(f"Fallback selected melody: {first_available_melody['name']}")

        if 'chords' not in selected_roles and self._available_soundfonts:
            logger.warning("No chords instrument selected by LLM, attempting fallback.")
            # Simple fallback: pick the first available soundfont not used for melody
            first_available_chords = next((sf for sf in self._available_soundfonts if sf["name"] not in [s.instrument_name for s in validated_selections if s.role.lower() == 'melody']), self._available_soundfonts[0])
            # Avoid using the same instrument as melody if possible
            if len(self._available_soundfonts) > 1 and first_available_chords["name"] == next((s.instrument_name for s in validated_selections if s.role.lower() == 'melody'), None):
                first_available_chords = next((sf for sf in self._available_soundfonts if sf["name"] != first_available_chords["name"]), self._available_soundfonts[1 if len(self._available_soundfonts) > 1 else 0])

            validated_selections.append(InstrumentSelectionItem(instrument_name=first_available_chords["name"], role="chords", explanation="Fallback for missing chords role."))
            logger.info(f"Fallback selected chords: {first_available_chords['name']}")
            
        return SelectInstruments(instrument_selections=validated_selections)

    async def _generate_chords_and_send_sse(self, params: FullMusicalParameters, selected_instruments: SelectInstruments, queue: SSEQueueManager):
        """Finds chord instrument, generates notes, and sends add_midi_track SSE action."""
        logger.info("Starting chord generation...")
        chord_instrument_selection = next((
            item for item in selected_instruments.instrument_selections 
            if item.role.lower() == "chords"
        ), None)

        if chord_instrument_selection:
            chord_instrument_name = chord_instrument_selection.instrument_name
            if chord_instrument_name in self._soundfont_map:
                chord_instrument_details = self._soundfont_map[chord_instrument_name]
                logger.info(f"Found chords instrument: {chord_instrument_name}")

                try:
                    if isinstance(params.chord_progression, str):
                        processed_chord_progression = re.sub(
                            r"[,\s]+", "-", params.chord_progression
                        ).strip("-")
                    else:
                        logger.info(f"Warning: Invalid chord progression format: {params.chord_progression}, skipping chord generation.")
                        processed_chord_progression = None

                    if processed_chord_progression:
                        logger.info(f"Generating notes for chord progression: '{processed_chord_progression}' in {params.key} {params.mode} using {chord_instrument_name}")
                        
                        # Note: transform_chord_progression_to_instrument_format expects a dict-like object for instrument
                        chord_notes_data = transform_chord_progression_to_instrument_format(
                            chord_progression=processed_chord_progression,
                            instrument=InstrumentFileRead(
                                id=chord_instrument_details["id"],
                                file_name=chord_instrument_details["name"],
                                display_name=chord_instrument_details["name"],
                                storage_key=chord_instrument_details["storage_key"],
                                file_format="sf2",  # TODO: Fix this later (like service)
                                file_size=0,  # TODO: Fix this later (like service)
                                category="chords",
                                is_public=True,
                                description=f"Chord progression {processed_chord_progression} in {params.key} {params.mode}",
                            ),
                            key=params.key,
                        )

                        if not chord_notes_data or "notes" not in chord_notes_data or not chord_notes_data["notes"]:
                            logger.info(
                                f"Chord transformation returned empty or invalid result for progression '{processed_chord_progression}'"
                            )
                        else:
                            logger.info(f"Generated {len(chord_notes_data.get('notes', []))} chord notes.")
                            track_id = uuid.uuid4()
                            instrument_file = InstrumentFileRead(
                                id=chord_instrument_details["id"],
                                file_name=chord_instrument_details["name"],
                                display_name=chord_instrument_details["name"],
                                storage_key=chord_instrument_details["storage_key"],
                                file_format="sf2",  # TODO: Fix this later (like service)
                                file_size=0,  # TODO: Fix this later (like service)
                                category="chords",
                                is_public=True,
                                description=f"Chord progression {processed_chord_progression} in {params.key} {params.mode}",
                            )
                            chord_track = MidiTrackRead(
                                id=track_id,
                                name=chord_instrument_details["name"],
                                instrument_id=chord_instrument_details["id"],
                                midi_notes_json=chord_notes_data.get("notes"),
                                instrument_file=instrument_file,
                            )
                            
                            logger.info(f"Sending add_midi_track action for chords: {chord_track.name}")
                            await queue.action(AssistantAction.add_midi_track(track=chord_track))

                except Exception as e:
                    logger.info(f"Error during chord generation/SSE: {str(e)}")
                    # Optionally send an error via queue?
                    # await queue.error("Failed to generate chords.")
            else:
                logger.info(f"Warning: Selected chords instrument '{chord_instrument_name}' not found in soundfont map.")
        else:
            logger.info("Warning: No instrument with role 'chords' selected. Skipping chord generation.")

    async def _generate_melody_and_send_sse(self, params: FullMusicalParameters, selected_instruments: SelectInstruments, queue: SSEQueueManager):
        """Streams melody explanation, then generates notes and sends add_midi_track SSE action."""
        logger.info("Starting melody generation process...")

        melody_instrument_selection = next((
            item for item in selected_instruments.instrument_selections
            if item.role.lower() == "melody"
        ), None)

        if not melody_instrument_selection:
            logger.info("Warning: No instrument with role 'melody' selected. Skipping melody generation.")
            return

        melody_instrument_name = melody_instrument_selection.instrument_name
        if melody_instrument_name not in self._soundfont_map:
            logger.info(f"Warning: Selected melody instrument '{melody_instrument_name}' not found in soundfont map. Skipping melody generation.")
            return
        
        melody_instrument_details = self._soundfont_map[melody_instrument_name]
        logger.info(f"Found melody instrument: {melody_instrument_name}")

        # 1. Stream Explanation for Melody
        explanation_prompt_melody = f"""Now I'm going to create a melody.
Based on the key of {params.key} {params.mode}, tempo {params.tempo} BPM, the chord progression '{params.chord_progression}', and using the '{melody_instrument_name}' for the melody, describe the style, mood, and characteristics of the melody you are about to compose.

Keep it concise and conversational. Do NOT generate the actual musical notes or JSON in this step."""

        logger.info("Streaming explanation for melody...")
        try:
            async for text_chunk in await self.chat_session.send_message_async(
                user_prompt_content=explanation_prompt_melody,
                stream=True
            ):
                if isinstance(text_chunk, str):
                    logger.debug(f"MELODY EXPLANATION STREAMING TEXT CHUNK: '{text_chunk}'") 
                    await self.chat_session.queue.add_chunk(text_chunk)
            logger.info("Finished streaming melody explanation.")
        except Exception as e:
            logger.error(f"Error streaming melody explanation: {e}")
            await self.chat_session.queue.error("Failed to stream melody explanation.")
            # Decide if we should return here or attempt note generation anyway
            # For now, let's return if explanation fails, as it might indicate a larger issue.
            return

        await self.chat_session.queue.add_chunk("\n\n")
        await self.chat_session.queue.add_chunk("---")
        await self.chat_session.queue.add_chunk("\n\n")
        # 2. Generate Melody Notes (Focused Call internally within generate_melody_notes)
        logger.info(f"Proceeding to generate actual melody notes for {melody_instrument_name}...")
        try:
            melody_data = await self.generate_melody_notes(
                current_params=params,
                selected_instruments=selected_instruments 
            )

            if not melody_data or not melody_data.bars:
                logger.info("Melody generation returned empty or invalid result from generate_melody_notes.")
                await queue.error("Melody generation failed to produce notes.")
                return
            
            logger.info(f"Generated {len(melody_data.bars)} melody bars and {sum(len(bar.notes) for bar in melody_data.bars)} notes.")
            track_id = uuid.uuid4()
            
            melody_data_json = transform_melody_data_to_instrument_format(melody_data)
            
            # Use the already fetched melody_instrument_details for InstrumentFileRead
            instrument_file = InstrumentFileRead(
                id=melody_instrument_details["id"],
                file_name=melody_instrument_details["name"],
                display_name=melody_instrument_details["name"],
                storage_key=melody_instrument_details["storage_key"],
                file_format="sf2", 
                file_size=0, 
                category="melody",
                is_public=True,
                description=f"Melody for {melody_instrument_name} in {params.key} {params.mode}",
            )
            melody_track = MidiTrackRead(
                id=track_id,
                name=melody_instrument_details["name"],
                instrument_id=melody_instrument_details["id"],
                midi_notes_json=melody_data_json, 
                instrument_file=instrument_file,
            )
            
            logger.info(f"Sending add_midi_track action for melody: {melody_track.name}")
            await queue.action(AssistantAction.add_midi_track(track=melody_track))

        except Exception as e:
            logger.error(f"Error during melody note generation or SSE: {str(e)}", exc_info=True)
            await queue.error(f"Failed to generate melody notes: {str(e)}")
            
    async def _generate_drum_beat_patterns_and_send_sse(self, params: FullMusicalParameters, selected_drums_data: SelectDrumSounds, queue: SSEQueueManager, drum_research_result: Optional[str] = None):
        """Streams explanation, then generates drum beat patterns via LLM call."""
        logger.info(f"Step 'generate_drum_beat_patterns' called for song: {params.song_title if params.song_title else 'Untitled'}")
        drum_track = await self.generate_drum_beat_patterns(
            determined_params=params,
            selected_drums_data=selected_drums_data,
            drum_research_result=drum_research_result
        )
        
        await queue.action(AssistantAction.add_drum_track(track=drum_track))


    async def generate_melody_notes(self, current_params: FullMusicalParameters, selected_instruments: SelectInstruments) -> MelodyData:
        """Generates melody notes. This tool now uses a detailed interval-based prompt and converts the result to absolute notes."""
        logger.info(f"Step 'generate_melody_notes' for song: {current_params.song_title if current_params and current_params.song_title else 'Untitled'}")
        
        key = current_params.key
        mode = current_params.mode
        tempo = current_params.tempo
        allowed_intervals_string = str(list(range(-7, 8))) 
        chord_progression_str = current_params.chord_progression # The string form, e.g., "C-G-Am-F"
        user_prompt_lower = current_params.original_user_prompt.lower()
        mood = "upbeat" if "upbeat" in user_prompt_lower or "happy" in user_prompt_lower or "cheerful" in user_prompt_lower else "neutral"
        if "sad" in user_prompt_lower or "lo-fi" in user_prompt_lower: mood = "sad"
        tempo_character = "fast" if tempo > 140 else "moderate" if tempo > 100 else "slow"
        rhythm_type = "pop" 
        musical_style = "pop" 
        if "lo-fi" in user_prompt_lower: musical_style = "lo-fi"
        if "cinematic" in user_prompt_lower: musical_style = "cinematic"
        melodic_character = "catchy"
        duration_bars = current_params.duration_bars
        beats_per_bar = 4 
        duration_beats = duration_bars * beats_per_bar

        # --- Add Chord Progression Analysis ---
        actual_chord_analysis_data: Optional[Dict[str, Any]] = None # To store the raw dict
        note_analysis_json_str = "{}" # Default to empty JSON string if analysis fails
        try:
            #chord_list = [chord.strip() for chord in re.split(r'[-,\s]+', chord_progression_str) if chord.strip()]
            
            # Corrected logic for key_for_analysis
            key_for_analysis = key
            if mode.lower() == "minor":
                if not key.upper().endswith("M"): # Handles cases like "C", "D" for minor
                    key_for_analysis = key + "m" # Becomes "Cm", "Dm"
            # If key is already "Cm", "Dm", it remains as is.
            # If key is "C" (major), it remains "C".
            
            chord_progression_list = re.split(r"[-,\s]+", chord_progression_str)
            chord_progression_list = [
                chord.strip().replace("b", "-")
                for chord in chord_progression_list
                if chord.strip()
            ]

            logger.info(f"Analyzing chord progression: {chord_progression_list} in key: {key_for_analysis}")

            analysis_result = analyze_chord_progression(chord_progression_list, key_for_analysis) # Assume this returns a dict or None
            
            if analysis_result:
                actual_chord_analysis_data = analysis_result
                note_analysis_json_str = json.dumps(analysis_result, indent=2)
                #logger.info(f"Chord analysis generated: {note_analysis_json_str}...")
            else:
                logger.warning("Warning: Chord analysis returned no data.")
        except Exception as e_analysis:
            logger.info(f"Warning: Failed to analyze chord progression '{chord_progression_str}' for key '{key}' {mode}: {e_analysis}. Proceeding without detailed note weights.")
        # --- End Chord Progression Analysis ---

        interval_prompt = get_melody_create_prompt(
            key=key, mode=mode, tempo=tempo, 
            allowed_intervals_string=allowed_intervals_string, 
            chord_progression=chord_progression_str, 
            mood=mood, tempo_character=tempo_character, rhythm_type=rhythm_type, 
            musical_style=musical_style, melodic_character=melodic_character, 
            duration_bars=duration_bars, duration_beats=duration_beats
        )

        # Append chord analysis information to the prompt
        if note_analysis_json_str != "{}":
            enhancement_instruction = (
                "\n\n--- Additional Harmonic Context ---\n"
                "Use the following detailed chord analysis and note weights to guide your melodic interval choices. "
                "Focus on notes that align well with the underlying harmony of each chord, considering chord tones, extensions, and passing tones that resolve appropriately. "
                "This analysis provides weights for notes against each chord in the progression:\n"
                f"{note_analysis_json_str}\n"
                "Let this harmonic context heavily influence the intervals you select to create a musically consonant and expressive melody."
            )
            interval_prompt += enhancement_instruction

        logger.info(f"DEBUG: Creating fresh ChatSession for melody generation...")
        
        # Clone settings from the agent's main chat session
        melody_chat_session = ChatSession(
            provider_name=self.chat_session.current_provider_name,
            model_name=self.chat_session.current_model_name,
            queue=self.chat_session.queue,
            api_key=self.chat_session.current_api_key,
            base_url=self.chat_session.current_base_url,
            **self.chat_session.current_provider_kwargs
        )
        
        logger.info(f"DEBUG: Prompting for IntervalMelodyOutput with fresh context. Prompt length: {len(interval_prompt)} chars.")
        logger.info(f"DEBUG: Prompt start: {interval_prompt[:200]}...")
        
        # Direct LLM call with fresh context instead of using _focused_llm_call
        max_retries = 2
        interval_melody_output_raw = None
        
        for attempt in range(max_retries + 1):
            try:
                logger.info(f"Melody generation attempt {attempt + 1}...")
                response_data = await melody_chat_session.send_message_async(
                    user_prompt_content=interval_prompt,
                    stream=False,
                    model_settings={},
                    expect_json=True
                )
                
                if isinstance(response_data, str):
                    # Attempt to parse the JSON string
                    try:
                        parsed_json_data = json.loads(response_data)
                        #logger.info(f"Parsed JSON data raw: {parsed_json_data}") # Log the raw parsed data

                        # Find the dictionary within the parsed data
                        melody_dict_data = None
                        if isinstance(parsed_json_data, list):
                            for item in parsed_json_data:
                                if isinstance(item, dict):
                                    melody_dict_data = item
                                    break
                        elif isinstance(parsed_json_data, dict):
                            melody_dict_data = parsed_json_data

                        if melody_dict_data:
                            logger.info(f"Extracted melody dictionary: {melody_dict_data}")
                            # Instantiate the model using the extracted dictionary
                            interval_melody_output_raw = IntervalMelodyOutput(**melody_dict_data)
                            logger.info(f"Successfully parsed melody on attempt {attempt + 1}.")
                            break # Exit loop on success
                        else:
                            logger.info(f"Could not find a dictionary in the parsed JSON data on attempt {attempt + 1}.")
                            # Let the loop continue to retry if possible

                    except json.JSONDecodeError as jde:
                        logger.info(f"JSON decode error on attempt {attempt + 1}: {jde}. Raw response: {response_data[:500]}...") # Log raw response on error
                    except Exception as e_instantiate: # Catch potential errors during instantiation as well
                         logger.info(f"Error instantiating IntervalMelodyOutput on attempt {attempt + 1}: {e_instantiate}. Data used: {melody_dict_data}")

                elif isinstance(response_data, IntervalMelodyOutput):
                    interval_melody_output_raw = response_data
                    logger.info(f"ChatSession directly returned IntervalMelodyOutput on attempt {attempt + 1}.")
                    break
                else:
                    logger.info(f"Unexpected response type on attempt {attempt + 1}: {type(response_data)}")
            except Exception as e:
                logger.info(f"Error on melody generation attempt {attempt + 1}: {e}")
            
            if attempt < max_retries:
                retry_prompt = f"Previous attempt failed. Please provide a valid IntervalMelodyOutput JSON.\nSchema: {IntervalMelodyOutput.model_json_schema()}\nOriginal request: {interval_prompt[:300]}..."
                interval_prompt = retry_prompt
                
        # Fall back if all attempts failed
        if not interval_melody_output_raw:
            logger.info("All melody generation attempts failed. Using empty fallback.")
            interval_melody_output_raw = IntervalMelodyOutput(starting_octave=3, bars=[])
        
        interval_melody_output = interval_melody_output_raw
        logger.info(f"LLM returned interval melody: {interval_melody_output.model_dump_json(indent=2)}...")

        final_melody_data_from_intervals = convert_interval_melody_to_absolute_melody(
            interval_melody=interval_melody_output,
            key_name=key,
            mode_name=mode # mode_name might be useful for determining actual scale for the root note
        )
        logger.info(f"Converted to absolute melody: {final_melody_data_from_intervals.model_dump_json(indent=2)}...")

        # Correct notes if analysis is available
        final_melody_data: MelodyData
        if actual_chord_analysis_data: # This is the dict from analyze_chord_progression
            logger.info("Attempting to correct out-of-key notes using chord analysis...")
            # Note: _correct_notes_in_key is synchronous, so no await here
            corrected_melody_data = correct_notes_in_key(
                melody_data=final_melody_data_from_intervals,
                key_name=key,
                mode_name=mode,
                chord_analysis_data=actual_chord_analysis_data, 
                chord_progression_str=chord_progression_str,
                duration_bars=duration_bars
            )
            final_melody_data = corrected_melody_data
        else:
            logger.info("Chord analysis data not available or failed, skipping note correction.")
            final_melody_data = final_melody_data_from_intervals
        
        logger.info(f"Melody after potential correction: {final_melody_data.model_dump_json(indent=2)}...")

        # Validate the generated melody right after conversion/correction
        try:
            # Normalize key for music21 (remove trailing 'm' if present)
            normalized_key = key
            if mode.lower() == "minor" and key.endswith("m"):
                normalized_key = key[:-1]  # Remove trailing 'm' from 'Cm', 'Am', etc.
            
            logger.info(f"Validating melody with normalized key: {normalized_key} {mode}")
            # Use our new robust validation function
            validate_melody_in_key(melody_data=final_melody_data, key_name=normalized_key, mode_name=mode)
            logger.info("Melody successfully validated by generate_melody_notes.")
        except ValueError as e_validation:
            logger.info(f"Melody validation failed: {e_validation}")
            # Propagate the validation error
            raise e_validation

        return final_melody_data


    async def select_drum_sounds(self, determined_params: FullMusicalParameters, drum_research_result: Optional[str] = None) -> SelectDrumSounds:
        """Streams explanation, then selects drum sounds via LLM call."""
        logger.info(f"Step 'select_drum_sounds' called for song: {determined_params.song_title if determined_params.song_title else 'Untitled'}")
        drum_sample_names = [ds.display_name for ds in self._available_drum_samples]

        # 1. Stream Explanation for Drum Sound Selection
        explanation_context = f"For a song in {determined_params.key} {determined_params.mode} at {determined_params.tempo} BPM, with style hints from title '{determined_params.song_title}' and user prompt '{determined_params.original_user_prompt}'."
        if drum_research_result:
            explanation_context += f"\nConsider this research on drum sounds: {drum_research_result}"
        explanation_context += f"\nAvailable Drum Samples are: {json.dumps(drum_sample_names)}"

        explanation_prompt_drums = f"""Now I need to select specific drum sounds (e.g., kick, snare, hi-hat, cymbals).
{explanation_context}

Please explain your choices for 4-5 drum sounds from the available list that would fit the style. Describe the role each sound will play.
Do NOT output JSON in this step, just your conversational reasoning."""

        logger.info("Streaming explanation for drum sound selection...")
        try:
            async for text_chunk in await self.chat_session.send_message_async(
                user_prompt_content=explanation_prompt_drums,
                stream=True
            ):
                if isinstance(text_chunk, str):
                    logger.debug(f"DRUM SOUND EXPLANATION STREAMING TEXT CHUNK: '{text_chunk}'") 
                    await self.chat_session.queue.add_chunk(text_chunk)
            logger.info("Finished streaming drum sound selection explanation.")
        except Exception as e:
            logger.error(f"Error streaming drum sound selection explanation: {e}")
            await self.chat_session.queue.error("Failed to stream drum sound explanation.")

        await self.chat_session.queue.add_chunk("\n\n")
        await self.chat_session.queue.add_chunk("---")
        await self.chat_session.queue.add_chunk("\n\n")
        # 2. Get JSON Data (Focused Call)
        logger.info("Requesting JSON for drum sound selection...")
        focused_prompt_context = f"For a song in {determined_params.key} {determined_params.mode} at {determined_params.tempo} BPM, with style hints from the title '{determined_params.song_title}', user prompt '{determined_params.original_user_prompt}', and chord progression '{determined_params.chord_progression}'."
        if drum_research_result:
            focused_prompt_context += f"\nRelevant drum sound research to consider: {drum_research_result}"
        
        focused_prompt = f"""
{focused_prompt_context}
Available Drum Samples (choose from this list only): {json.dumps(drum_sample_names)}

Based on our prior discussion and reasoning, select 4-5 appropriate drum sounds (e.g., kick, snare, hi-hat).
Provide your response *only* in the 'SelectDrumSounds' JSON structure (an object with a 'drum_sounds' list of strings, where each string is an exact name from the Available Drum Samples list).
<CRITICAL_INSTRUCTION>The sounds you choose MUST be in the list of available drum samples.</CRITICAL_INSTRUCTION>
<CRITICAL_INSTRUCTION>Any sounds not appearing in the available drum samples list will be rejected.</CRITICAL_INSTRUCTION>
<CRITICAL_INSTRUCTION>Remember, you MUST choose from THESE SAMPLES ONLY: {json.dumps(drum_sample_names)}</CRITICAL_INSTRUCTION>
Example of desired JSON structure: {json.dumps(SelectDrumSounds.model_json_schema())}
Output only the JSON object."""
        
        drum_sound_selections_raw = await self._focused_llm_call(focused_prompt, SelectDrumSounds)
        
        # 3. Process JSON Data (existing logic)
        drum_sound_selections = SelectDrumSounds(drum_sounds=[]) 
        if hasattr(drum_sound_selections_raw, 'drum_sounds') and drum_sound_selections_raw.drum_sounds is not None:
            drum_sound_selections = SelectDrumSounds(drum_sounds=drum_sound_selections_raw.drum_sounds)
        logger.info(f"LLM selected drum sounds JSON: {drum_sound_selections.model_dump_json()}")
        validated_drums = []
        if drum_sound_selections.drum_sounds:
            for name in drum_sound_selections.drum_sounds:
                if name in self._drum_sample_map:
                    validated_drums.append(name)
                else:
                    logger.info(f"Warning: LLM selected unknown drum sound '{name}'. Ignoring.")
                    logger.info(f"Available drum samples: {list(self._drum_sample_map.keys())}") # Log available keys for easier debug
        else:
            logger.info("Warning: No drum sounds returned or in unexpected format from focused LLM call.")
        
        # Fallback if no drums selected
        if not validated_drums and self._available_drum_samples:
            raise Exception("No drum sounds selected by LLM or validated, attempting fallback.")
            # logger.warning("No drum sounds selected by LLM or validated, attempting fallback.")
            # # Simple fallback: try to pick common types if names are suggestive, else pick first few
            # common_types = {'kick': False, 'snare': False, 'hat': False, 'clap': False}
            # for sample in self._available_drum_samples:
            #     sample_name_lower = sample.display_name.lower()
            #     added = False
            #     if 'kick' in sample_name_lower and not common_types['kick']:
            #         validated_drums.append(sample.display_name)
            #         common_types['kick'] = True
            #         added = True
            #     elif 'snare' in sample_name_lower and not common_types['snare']:
            #         validated_drums.append(sample.display_name)
            #         common_types['snare'] = True
            #         added = True
            #     elif ('hat' in sample_name_lower or 'hi-hat' in sample_name_lower) and not common_types['hat']:
            #         validated_drums.append(sample.display_name)
            #         common_types['hat'] = True
            #         added = True
            #     elif 'clap' in sample_name_lower and not common_types['clap']:
            #         validated_drums.append(sample.display_name)
            #         common_types['clap'] = True
            #         added = True
            #     if len(validated_drums) >= 4: break # Limit fallback to around 4 sounds
            
            # if not validated_drums: # If name matching failed, just pick first few
            #     validated_drums = [ds.display_name for ds in self._available_drum_samples[:min(4, len(self._available_drum_samples))]]
            # logger.info(f"Fallback selected drums: {validated_drums}")

        return SelectDrumSounds(drum_sounds=validated_drums)

    async def generate_drum_beat_patterns(self, determined_params: FullMusicalParameters, selected_drums_data: SelectDrumSounds, drum_research_result: Optional[str] = None) -> CreateDrumBeat:
        """Streams explanation, then generates drum beat patterns via LLM call."""
        logger.info(f"Step 'generate_drum_beat_patterns' called for song: {determined_params.song_title if determined_params.song_title else 'Untitled'}")
        
        drum_info_for_llm = []
        if hasattr(selected_drums_data, 'drum_sounds') and selected_drums_data.drum_sounds:
            for name in selected_drums_data.drum_sounds:
                if name in self._drum_sample_map:
                    # Ensure ID is a string for JSON serialization in prompts, and for CreateDrumBeat schema if it expects string IDs
                    drum_info_for_llm.append({"id": str(self._drum_sample_map[name].id), "name": name})
        
        if not drum_info_for_llm:
            logger.info("No valid selected drum sounds to generate patterns for. Returning empty patterns.")
            return CreateDrumBeat(drum_beats=[])
        
        # 2. Get JSON Data (Focused Call)
        logger.info("Requesting JSON for drum beat patterns...")
        # drum_info_for_prompt used in the focused_prompt should contain the IDs as expected by the CreateDrumBeat schema
        focused_prompt = f"""
Create drum beat patterns for a {determined_params.duration_bars}-bar song in {determined_params.key} {determined_params.mode} at {determined_params.tempo} BPM.
User prompt for style: '{determined_params.original_user_prompt}'.
Use these selected drum sounds (provide patterns for these IDs and names): {json.dumps(drum_info_for_llm)}.

Here is some research on drum beats of this style:
{drum_research_result}

<CRITICAL_INSTRUCTION>Ensure the drum patterns are in the style of the research and prompt provided.</CRITICAL_INSTRUCTION>
For EACH of the drum sounds listed above, create a rhythmic pattern.
Each pattern MUST be a JSON array of exactly 32 boolean values (true/false), representing 16th notes over 2 bars (in 4/4 time).
'true' means the drum hits on that 16th note step, 'false' means silence.
Do NOT exceed 32 items in any pattern list.
Output *only* in the 'CreateDrumBeat' JSON structure (an object with a 'drum_beats' list, where each item in the list has 'drum_sound_id' and 'pattern' fields).
Example of desired JSON structure: {json.dumps(CreateDrumBeat.model_json_schema(), indent=2)}
Output only the JSON object."""
        
        # Create a fresh ChatSession for this specific LLM call
        drum_chat_session = ChatSession(
            provider_name=self.chat_session.current_provider_name,
            model_name=self.chat_session.current_model_name,
            queue=self.chat_session.queue, # Use the main agent's queue
            api_key=self.chat_session.current_api_key,
            base_url=self.chat_session.current_base_url,
            **self.chat_session.current_provider_kwargs
        )

        max_retries = 1 
        drum_beat_data_raw: Optional[CreateDrumBeat] = None
        current_llm_prompt_for_drums = focused_prompt
        last_error: Optional[Exception] = None

        for attempt in range(max_retries + 1):
            logger.info(f"Drum beat pattern generation attempt {attempt + 1} for CreateDrumBeat...")
            raw_llm_output_str: Optional[str] = None
            # Reset last_error for this attempt, critical if previous attempt had error but didn't enter except block
            last_error = None 
            
            try:
                response_data = await drum_chat_session.send_message_async(
                    user_prompt_content=current_llm_prompt_for_drums,
                    stream=False,
                    model_settings={}, 
                    expect_json=True
                )

                if isinstance(response_data, str):
                    raw_llm_output_str = response_data
                    parsed_json_data = json.loads(raw_llm_output_str)
                    
                    # Specific correction logic for CreateDrumBeat patterns (ensure 32 booleans)
                    if isinstance(parsed_json_data, dict) and 'drum_beats' in parsed_json_data and isinstance(parsed_json_data['drum_beats'], list):
                        for item_dict in parsed_json_data['drum_beats']:
                            if isinstance(item_dict, dict) and 'pattern' in item_dict and isinstance(item_dict['pattern'], list):
                                pat = item_dict['pattern']
                                expected_len = 32 
                                if len(pat) > expected_len:
                                    logger.info(f"Drum pattern parse: Truncating drum pattern for {item_dict.get('drum_sound_id', 'N/A')} from {len(pat)} to {expected_len}.")
                                    item_dict['pattern'] = pat[:expected_len]
                                elif len(pat) < expected_len:
                                    logger.info(f"Drum pattern parse: Padding drum pattern for {item_dict.get('drum_sound_id', 'N/A')} from {len(pat)} to {expected_len}.")
                                    item_dict['pattern'].extend([False] * (expected_len - len(pat)))
                    
                    drum_beat_data_raw = CreateDrumBeat(**parsed_json_data)
                    logger.info(f"Successfully parsed and validated CreateDrumBeat on attempt {attempt + 1}.")
                    break 
                elif isinstance(response_data, CreateDrumBeat):
                    drum_beat_data_raw = response_data
                    logger.info(f"ChatSession directly returned CreateDrumBeat object on attempt {attempt + 1}.")
                    break
                else:
                    last_error = TypeError(f"ChatSession returned unexpected data type for drum patterns: {type(response_data)}. Content: {str(response_data)[:200]}...")
                    logger.info(f"Error on attempt {attempt + 1}: {last_error}")

            except json.JSONDecodeError as jde:
                last_error = jde
                logger.info(f"ERROR on attempt {attempt + 1} (JSONDecodeError) for CreateDrumBeat: {jde}. Raw: '{raw_llm_output_str if raw_llm_output_str else 'N/A'}...'")
            except Exception as e_pydantic: 
                last_error = e_pydantic
                parsed_json_for_error_msg = raw_llm_output_str if raw_llm_output_str else 'N/A (no raw string)'
                if 'parsed_json_data' in locals() and isinstance(parsed_json_data, dict):
                     parsed_json_for_error_msg = str(parsed_json_data) # locals() check needed
                logger.info(f"ERROR on attempt {attempt + 1} (Pydantic/Validation Error) for CreateDrumBeat: {e_pydantic}. Data: {parsed_json_for_error_msg}...")
            
            if drum_beat_data_raw: 
                break

            if attempt < max_retries and last_error:
                logger.info(f"Preparing for retry attempt {attempt + 2} for CreateDrumBeat...")
                prev_output_for_retry = (raw_llm_output_str[:500] + '...' if raw_llm_output_str and len(raw_llm_output_str) > 500 else raw_llm_output_str) or 'N/A'
                retry_instruction = (
                    f"The previous attempt to generate JSON for CreateDrumBeat failed. "
                    f"Please carefully review the original request and the following error, then provide a corrected JSON response. "
                    f"Ensure your entire response is a single, valid JSON object matching the schema, with all keys and string values in double quotes.\\n"
                    f"Previous Error: {str(last_error)}\\n"
                    f"Previous Raw Output (possibly truncated):\\n{prev_output_for_retry}\\n\\n"
                    f"Original request was (please regenerate response based on this original request, incorporating corrections):\\n{focused_prompt}"
                )
                current_llm_prompt_for_drums = retry_instruction
            elif attempt >= max_retries and last_error and not drum_beat_data_raw: # Check last_error here
                 logger.info(f"All {max_retries + 1} attempts failed for CreateDrumBeat. Last error: {last_error}")
        
        if not drum_beat_data_raw:
            logger.info("All drum beat pattern generation attempts failed. Using empty CreateDrumBeat fallback.")
            drum_beat_data_raw = CreateDrumBeat(drum_beats=[])
            
        drum_beat_data = drum_beat_data_raw
        # END of new LLM call logic
        
        # 3. Process JSON Data (existing logic)
        if not isinstance(drum_beat_data, CreateDrumBeat):
            logger.info(f"Warning: _focused_llm_call did not return CreateDrumBeat. Got {type(drum_beat_data)}. Returning empty.")
            # Fallback: Attempt to create an empty CreateDrumBeat if the call failed badly
            try:
                return CreateDrumBeat(drum_beats=[])
            except Exception:
                 # If even this fails, it means CreateDrumBeat model itself has issues or expects non-optional fields
                 # For now, we'll let an error propagate if this very basic fallback fails.
                 # A more robust solution might be to always ensure CreateDrumBeat can be initialized with no args.
                 raise # Or return a pre-constructed empty valid object

        logger.info(f"LLM generated drum patterns JSON: {drum_beat_data.model_dump_json() if drum_beat_data else 'None'}")
        # Further validation of patterns can be added here if needed (e.g., ensuring all patterns are 32 booleans)
        
        logger.info(f"Drum sound keys: {[beat_data.drum_sound_id for beat_data in drum_beat_data.drum_beats]}")
        logger.info(f"Drum sound map keys: {[key for key in self._drum_sample_id_map.keys()]}")
        
        drum_track_id = uuid.uuid4()
        drum_track = DrumTrackRead(
            id=drum_track_id,
            name="Drums",
        )
        for beat_data in drum_beat_data.drum_beats:
            drum_sound_id = beat_data.drum_sound_id
            pattern = beat_data.pattern * 2

            logger.info(f"Drum sound ID: {drum_sound_id}")
            logger.info(f"Pattern: {pattern}")

            notes = transform_drum_beats_to_midi_format(pattern)
            logger.info(f"Notes: {notes}")

            if (
                not drum_sound_id
                or not isinstance(pattern, list)
                or len(pattern) != 64
            ):
                logger.warning(
                    f"Invalid drum beat data received: {beat_data}, skipping."
                )
                continue


            if drum_sound_id in self._drum_sample_id_map:
                drum_sample = self._drum_sample_id_map[drum_sound_id]
                logger.info(
                    f"Adding drum track for {drum_sample.display_name} (ID: {drum_sound_id})"
                )
                sampler_track_id = uuid.uuid4()
                drum_track.sampler_tracks.append(
                    SamplerTrackRead(
                        id=sampler_track_id,
                        name=drum_sample.display_name,
                        audio_file_name=drum_sample.file_name,
                        base_midi_note=settings.audio.DEFAULT_SAMPLER_BASE_NOTE,
                        grain_size=settings.audio.DEFAULT_SAMPLER_GRAIN_SIZE,
                        overlap=settings.audio.DEFAULT_SAMPLER_OVERLAP,
                        audio_file_sample_rate=settings.audio.SAMPLE_RATE,
                        audio_storage_key=drum_sample.storage_key,
                        audio_file_format=drum_sample.file_format,
                        audio_file_size=drum_sample.file_size,
                        audio_file_duration=drum_sample.duration or 0,
                        drum_track_id=drum_track_id,
                        midi_notes_json=notes,
                    )
                )
                drum_track.sampler_track_ids.append(sampler_track_id)
            else:
                logger.warning(
                    f"Drum sound ID '{drum_sound_id}' from LLM response not found in selected drums."
                )

        logger.info(f"Successfully processed and added drum track: {drum_track}")

        return drum_track

    def _sanitize_key_and_mode(self, key: str, mode: str) -> tuple[str, str]:
        """If key is like 'A minor' or 'C major', split it. Always return (tonic, mode)."""
        if key and isinstance(key, str) and " " in key:
            parts = key.strip().split()
            if len(parts) == 2 and parts[1].lower() in ("major", "minor"):
                return parts[0], parts[1].lower()
        return key, mode.lower() if mode else "major"

    # --- Main Orchestration Method ---
    async def run(self, request: SongRequest, model_info: ModelInfo, queue: SSEQueueManager, session: Session):
        """Orchestrates the music generation process and returns the final composition. Requires model_info for ChatSession."""
        self.chat_session = ChatSession(
            provider_name=model_info.provider_name,
            model_name=model_info.model_name,
            queue=queue,
            api_key=model_info.api_key,
            base_url=model_info.base_url
        )
        
        await self._init_real_data(session)
        
        logger.info(f"MusicGenerationAgent run started for prompt: '{request.user_prompt}', duration: {request.duration_bars} bars")
        logger.info(f"Available soundfonts length: {len(self._available_soundfonts)}")
        logger.info(f"Available drum samples length: {len(self._available_drum_samples)}")
        
        await queue.add_chunk(f"Doing research for prompt: '{request.user_prompt}'...\n\n")
        # Pass chat_session to all internal methods that need it
        # ... update all internal calls to use chat_session ...
        # For brevity, only show the start of the method here. The rest of the method and all internal calls must be updated to use chat_session as needed.
        logger.info(f"MusicGenerationAgent run started for prompt: '{request.user_prompt}', duration: {request.duration_bars} bars")
        self._initial_song_request = request # Store for potential use by helper methods if ever needed

        # --- 1. Research Step (NEW, like music_gen_service.py) ---
        logger.info("Starting research using MusicResearcher...")
        
        await queue.stage(
            "Starting research...",
            "Doing research online to find the best musical parameters...",
        )
        await queue.stage(
            "Starting research...",
            "Doing research online to find the best musical parameters...",
        )
        research_result, chord_research_result, drum_research_result = await asyncio.gather(
            self._music_researcher.enhance_description(request.user_prompt),
            self._music_researcher.research_chord_progression(request.user_prompt),
            self._music_researcher.research_drum_sounds(request.user_prompt)
        )

        # 2. Determine Core Musical Parameters (now with research context)
        research_addition = ""
        if research_result and isinstance(research_result, dict) and research_result.get("prompt_addition"):
            research_addition += research_result["prompt_addition"]
        if chord_research_result:
            research_addition += f"\n\nChord progression research:\n{chord_research_result}"
        user_prompt_with_research = request.user_prompt + research_addition

        params = await self.determine_musical_parameters(
            user_prompt=user_prompt_with_research,
            duration_bars=request.duration_bars
        )

        # --- Sanitize key and mode after LLM output ---
        sanitized_key, sanitized_mode = self._sanitize_key_and_mode(params.key, params.mode)
        if sanitized_key != params.key or sanitized_mode != params.mode:
            logger.info(f"Sanitized key/mode: '{params.key}'/'{params.mode}' -> '{sanitized_key}'/'{sanitized_mode}'")
            params.key = sanitized_key
            params.mode = sanitized_mode

        # 3. Select Instruments
        selected_instruments = await self.select_instruments(determined_params=params)

        # 3. Generate Chords and Send SSE
        await self._generate_chords_and_send_sse(params, selected_instruments, queue)

        # 4. Generate Melody (assuming for primary melody role for now)
        await self._generate_melody_and_send_sse(params, selected_instruments, queue)

        # 5. Select Drum Sounds (now with drum research context)
        selected_drum_sounds = await self.select_drum_sounds(
            determined_params=params, 
            drum_research_result=drum_research_result
        )
        
        # 6. Generate Drum Beat
        await self._generate_drum_beat_patterns_and_send_sse(params, selected_drum_sounds, queue, drum_research_result)
        
        logger.info(f"MusicGenerationAgent run finished. Title: {params.song_title}")

# Example of how this agent might be instantiated and used (conceptual)
# async def main():
#   from pydantic_ai_wrapper.chat_wrapper import ChatSession
#   tool_chat_session = ChatSession(
#       provider_name="openai", 
#       model_name="gpt-3.5-turbo",
#       # api_key="YOUR_KEY", # etc.
#   )
#   
#   music_agent = MusicGenerationAgent(chat_session=tool_chat_session)
#   
#   request = SongRequest(user_prompt="Create an epic cinematic orchestral piece for a movie trailer, 20 bars long.")
#   final_song = await music_agent.run(request)
#   logger.info("--- Final Song Composition ---")
#   logger.info(final_song.model_dump_json(indent=2))

# if __name__ == "__main__":
#   import asyncio
#   # asyncio.run(main()) # Requires async main and proper setup

music_agent = MusicGenerationAgent()