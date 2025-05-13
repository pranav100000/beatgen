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
    SelectInstruments, 
    InstrumentSelectionItem,
    MelodyData, 
    Note, 
    Bar,
    SelectDrumSounds,
    CreateDrumBeat,
    DrumBeatPatternItem,
    ChordProgressionOutput,
    BaseCoerceModel
)
# Utilities from music_gen_service
from app2.llm.music_gen_service.music_researcher import MusicResearcher
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
    transform_chord_progression_to_instrument_format,
    transform_drum_beats_to_midi_format 
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

# --- Input and Output Schemas for the Main Agent Tool ---

class SongRequest(BaseModel):
    """Input schema for the music composition request."""
    user_prompt: str = Field(..., description="The user'''s description of the song they want to create (e.g., 'a sad lo-fi song for studying').")
    duration_bars: int = Field(default=4, description="Desired duration of the song in bars. Default is 16 bars.")
    # We can add more parameters like specific genre, mood, instruments if user wants to override LLM choices

class InstrumentTrack(BaseModel):
    """Represents a single instrument track in the final composition."""
    name: str
    role: str # e.g., melody, chords, bass
    soundfont_name: str
    notes: List[Note] # Using the Note schema from llm_schemas

class DrumTrackData(BaseModel): # Changed from DrumTrack to avoid confusion with a potential future tool
    patterns: List[DrumBeatPatternItem]

class SongComposition(BaseModel):
    """Output schema for the composed song."""
    title: Optional[str] = Field(None, description="A title for the song, suggested by the LLM.")
    key: str
    mode: str
    tempo: int
    chord_progression_str: str = Field(description="The determined chord progression, e.g., 'C-G-Am-F'.")
    instrument_tracks: List[InstrumentTrack] = Field(default_factory=list)
    drum_track_data: Optional[DrumTrackData] = None
    composition_summary: Optional[str] = None

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

# Simpler model for the LLM to target in the first tool
class LLMDeterminedMusicalParameters(BaseModel):
    chord_progression: str = Field(description="The chord progression (e.g. C-G-Am-F). Provide actual notes.")
    key: str = Field(description="The key of the chord progression (e.g. C, Db, G#)")
    mode: str = Field(description="The mode (major or minor).", pattern="^(major|minor|Major|Minor)$")
    tempo: int = Field(description="The tempo in BPM (e.g. 120, 140, 160)")
    melody_instrument_suggestion: str = Field(description="Suggested instrument for the melody (e.g., 'Piano').")
    chords_instrument_suggestion: str = Field(description="Suggested instrument for the chords (e.g., 'Strings').")
    song_title: Optional[str] = Field(None, description="A suitable title for the song.")

# FullMusicalParameters now assembled by Python code using LLMDeterminedMusicalParameters + direct tool inputs
class FullMusicalParameters(LLMDeterminedMusicalParameters): # Inherits from the simpler model
    original_user_prompt: str = Field(description="The original user prompt that led to these parameters.")
    duration_bars: int = Field(description="The requested duration of the song in bars.")

# This model bundles all inputs for the finalize_song_composition tool
class FinalCompositionParams(BaseModel):
    determined_params: FullMusicalParameters
    selected_instruments_data: SelectInstruments
    melody_data: MelodyData
    selected_drums_data: SelectDrumSounds
    drum_beat_data: Dict[str, Any]
    original_user_prompt: str
    duration_bars: int

# --- New Schemas for Interval-Based Melody Generation (as per prompt_utils.py) ---

class IntervalNoteItem(BaseCoerceModel):
    interval: str = Field(description="The semitone difference FROM THE PREVIOUS NOTE (or root note if it's the first note) (e.g., [0, +1, -2, +3]) OR 'R' for a rest in STRING FORMAT.")
    duration: str = Field(description="Note duration as a string (e.g., \"sixteenth\", \"eighth\")") # Assuming single string, not list
    velocity: int = Field(description="Note velocity or volume (0-127)", ge=0, le=127)
    explanation: Optional[str] = Field(None, description="A short explanation of why these values were picked for this interval.")
    cumulative_sum: Optional[int] = Field(None, description="The cumulative sum of the intervals.")
    cumulative_duration: Optional[str] = Field(None, description="The cumulative duration of the notes' durations as a string fraction e.g. '1/4'.") # Kept as string for now
    is_in_key: Optional[bool] = Field(None, description="Whether the cumulative sum is in the allowed cumulative intervals.")

class IntervalBarItem(BaseCoerceModel):
    bar_number: int = Field(description="The bar number associated with this bar of the melody.")
    musical_intention: Optional[str] = Field(None, description="The musical intention for this bar of the melody.")
    notes: List[IntervalNoteItem]

class IntervalMelodyOutput(BaseCoerceModel):
    starting_octave: int = Field(description="The octave to start on (3-5)", ge=3, le=5)
    bars: List[IntervalBarItem]

# --- Music Generation Agent (No longer a Pydantic AI Agent) ---

# Remove Pydantic AI TestModel and default settings
# default_model = TestModel() 
# default_model_settings: Dict[str, Any] = {}

class MusicGenerationAgent:
    _music_researcher: MusicResearcher

    def __init__(self):
        #self._init_mock_data()
        self._music_researcher = MusicResearcher()

    # def _init_mock_data(self):
    #     # This method is called once during agent initialization.
    #     self._available_soundfonts = [
    #         {"id": "sf1", "name": "Grand Piano", "storage_key": "path/to/piano.sf2"},
    #         {"id": "sf2", "name": "String Ensemble", "storage_key": "path/to/strings.sf2"},
    #         {"id": "sf3", "name": "Acoustic Guitar", "storage_key": "path/to/guitar.sf2"},
    #         {"id": "sf4", "name": "Synth Bass", "storage_key": "path/to/bass.sf2"},
    #         {"id": "sf5", "name": "Flute", "storage_key": "path/to/flute.sf2"},
    #         # Adding more instruments based on LLM suggestions and common needs
    #         {"id": "sf6", "name": "Violin", "storage_key": "path/to/violin.sf2"},
    #         {"id": "sf7", "name": "Brass Section", "storage_key": "path/to/brass_section.sf2"},
    #         {"id": "sf8", "name": "Orchestral Strings", "storage_key": "path/to/orchestral_strings.sf2"}, # More generic than String Ensemble
    #         {"id": "sf9", "name": "Synth Lead", "storage_key": "path/to/synth_lead.sf2"},
    #         {"id": "sf10", "name": "Electric Guitar", "storage_key": "path/to/electric_guitar.sf2"},
    #         {"id": "sf11", "name": "Choir Aahs", "storage_key": "path/to/choir_aahs.sf2"},
    #         {"id": "sf12", "name": "Music Box", "storage_key": "path/to/music_box.sf2"},
    #         # Adding instruments based on recent LLM suggestions
    #         {"id": "sf13", "name": "French Horns", "storage_key": "path/to/french_horns.sf2"},
    #         {"id": "sf14", "name": "Full Orchestra", "storage_key": "path/to/full_orchestra.sf2"}, # Or a more specific ensemble name
    #         {"id": "sf15", "name": "Cello", "storage_key": "path/to/cello.sf2"}
    #     ]
    #     self._soundfont_map = {sf["name"]: sf for sf in self._available_soundfonts}

    #     self._available_drum_samples = [
    #         {"id": "drum1", "name": "Kick Drum 808", "storage_key": "path/kick808.wav"},
    #         {"id": "drum2", "name": "Snare Acoustic", "storage_key": "path/snare_acoustic.wav"},
    #         {"id": "drum3", "name": "Hi-Hat Closed 909", "storage_key": "path/hh_closed909.wav"},
    #         {"id": "drum4", "name": "Crash Cymbal", "storage_key": "path/crash.wav"},
    #         {"id": "drum5", "name": "Clap", "storage_key": "path/clap.wav"}
    #     ]
    #     self._drum_sample_map = {ds["name"]: ds for ds in self._available_drum_samples}
        
    async def _init_real_data(self, session: Session):
        _drum_file_repository = get_drum_sample_public_repository(session)
        drum_sample_service = get_drum_sample_service(_drum_file_repository)
        self._available_soundfonts = await soundfont_service.get_public_soundfonts()
        self._available_drum_samples = await drum_sample_service.get_all_samples()
        self._soundfont_map = {sf["name"]: sf for sf in self._available_soundfonts}
        self._drum_sample_map = {ds.display_name: ds for ds in self._available_drum_samples}

    # --- Helper for Focused LLM Calls (No longer uses RunContext) ---
    async def _focused_llm_call(self, prompt: str, output_type: Type[BaseModel]) -> BaseModel:
        """Helper to make an isolated LLM call for structured output using ChatSession."""
        print(f"DEBUG: _focused_llm_call using self.chat_session for schema: {output_type.__name__}")
        
        llm_call_model_settings: Dict[str, Any] = {}
        max_retries = 1 # Max number of retries (so 1 retry means 2 attempts total)
        if output_type is IntervalMelodyOutput: # More retries for complex melody generation
            max_retries = 2

        llm_output_obj: Optional[BaseModel] = None
        last_error: Optional[Exception] = None
        current_prompt = prompt

        for attempt in range(max_retries + 1):
            print(f"Attempt {attempt + 1} for {output_type.__name__}...")
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
                                        print(f"ChatSession parse: Truncating drum pattern for {item_dict.get('drum_sound_id', 'N/A')} from {len(pat)} to {expected_len}.")
                                        item_dict['pattern'] = pat[:expected_len]
                                    elif len(pat) < expected_len:
                                        print(f"ChatSession parse: Padding drum pattern for {item_dict.get('drum_sound_id', 'N/A')} from {len(pat)} to {expected_len}.")
                                        item_dict['pattern'].extend([False] * (expected_len - len(pat)))
                    
                    llm_output_obj = output_type(**parsed_json_data)
                    print(f"Successfully parsed and validated output for {output_type.__name__} on attempt {attempt + 1}.")
                    break # Successful parse and validation, exit retry loop
                
                elif isinstance(response_data, output_type):
                    llm_output_obj = response_data
                    print(f"Warning: ChatSession unexpectedly returned a parsed Pydantic object of type {type(response_data)}.")
                    break # Exit loop as we got a directly usable object
                else:
                    last_error = TypeError(f"ChatSession returned unexpected data type: {type(response_data)}. Content: {str(response_data)[:200]}...")
                    print(f"Error on attempt {attempt + 1}: {last_error}")

            except json.JSONDecodeError as jde:
                last_error = jde
                print(f"ERROR on attempt {attempt + 1} (JSONDecodeError) for {output_type.__name__}: {jde}. Raw: '{raw_llm_output_data_str if raw_llm_output_data_str else 'N/A'}...'")
            except Exception as e_pydantic: # Catches Pydantic validation errors or others
                last_error = e_pydantic
                parsed_json_for_error_msg = raw_llm_output_data_str if raw_llm_output_data_str else 'N/A (no raw string)'
                if 'parsed_json_data' in locals() and isinstance(parsed_json_data, dict):
                    parsed_json_for_error_msg = str(parsed_json_data)
                print(f"ERROR on attempt {attempt + 1} (Pydantic/Validation Error) for {output_type.__name__}: {e_pydantic}. Data: {parsed_json_for_error_msg}...")
            
            if llm_output_obj: # Should have broken if successful
                break

            # If not the last attempt and an error occurred, prepare for retry
            if attempt < max_retries and last_error:
                print(f"Preparing for retry attempt {attempt + 2} for {output_type.__name__}...")
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
                print(f"All {max_retries + 1} attempts failed for {output_type.__name__}. Last error: {last_error}")
        
        if not llm_output_obj: 
            print(f"Warning: All attempts for {output_type.__name__} failed. Constructing fallback.")
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
                
                print(f"Successfully constructed fallback for {output_type.__name__}.")
            except Exception as e_constr_fallback: 
                # If even fallback construction fails, then we must raise an error.
                print(f"Fatal: Failed to construct fallback for {output_type.__name__} after ChatSession failure: {e_constr_fallback}."); 
                raise # Re-raise the construction error for the fallback
        
        return llm_output_obj # Return the validated object or the successfully constructed fallback

    # --- Music Generation Steps (formerly tools, now regular methods) ---

    async def determine_musical_parameters(self, user_prompt: str, duration_bars: int) -> FullMusicalParameters:
        """Determines core musical parameters via LLM call."""
        print(f"Step 'determine_musical_parameters' called with user_prompt: '{user_prompt}', duration_bars: {duration_bars}")
        
        schema_example_for_focused_call = json.dumps(LLMDeterminedMusicalParameters.model_json_schema())
        focused_prompt_for_llm = (
            f"Based on the user request: '{user_prompt}' for a song of {duration_bars} bars, determine the core musical parameters. "
            f"The response MUST be a valid JSON object precisely matching the 'LLMDeterminedMusicalParameters' schema. "
            f"Schema to follow: {schema_example_for_focused_call}. "
            f"Ensure you populate: 'chord_progression', 'key', 'mode' (major/minor), 'tempo', 'melody_instrument_suggestion', 'chords_instrument_suggestion', and 'song_title' (can be null). "
            f"Output only the JSON object."
        )
        
        llm_simple_params = await self._focused_llm_call(focused_prompt_for_llm, LLMDeterminedMusicalParameters)

        if not isinstance(llm_simple_params, LLMDeterminedMusicalParameters):
            print(f"ERROR: _focused_llm_call for determine_musical_parameters did not return LLMDeterminedMusicalParameters. Got {type(llm_simple_params)}. Falling back.")
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
            print(f"Error assembling FullMusicalParameters: {e}. Using fallback.")
            full_params = FullMusicalParameters(
                chord_progression="C-G-Am-F", key="C", mode="major", tempo=120,
                melody_instrument_suggestion="Piano", chords_instrument_suggestion="Strings",
                song_title="Fallback Assembled Title",
                original_user_prompt=user_prompt, 
                duration_bars=duration_bars
            )

        print(f"Step 'determine_musical_parameters' returning: {full_params.model_dump_json(indent=2)}")
        return full_params

    async def select_instruments(self, determined_params: FullMusicalParameters) -> SelectInstruments:
        """Selects specific instruments based on previously determined musical parameters."""
        print(f"Step 'select_instruments' called for song: {determined_params.song_title if determined_params.song_title else 'Untitled'}")
        soundfont_names_list = [sf["name"] for sf in self._available_soundfonts]
        focused_prompt = f"""
        Musical Context: Title: '{determined_params.song_title}', Key: {determined_params.key} {determined_params.mode}, Tempo: {determined_params.tempo} BPM.
        User prompt: '{determined_params.original_user_prompt}'. Duration: {determined_params.duration_bars} bars.
        Suggested Melody Instrument Type: {determined_params.melody_instrument_suggestion}
        Suggested Chords Instrument Type: {determined_params.chords_instrument_suggestion}
        Available Soundfonts (choose from this list only): {json.dumps(soundfont_names_list)}

        Select specific soundfonts for 'melody' and 'chords' roles. You can also suggest for 'bass' if appropriate.
        Provide your response *only* in the 'SelectInstruments' structure (a JSON object with an 'instrument_selections' list).
        Ensure instrument_name in each selection exactly matches a name from the Available Soundfonts list.
        Include a brief explanation for each choice.
        Example: {json.dumps(SelectInstruments.model_json_schema())}
        """
        instrument_selections_raw = await self._focused_llm_call(focused_prompt, SelectInstruments)
        instrument_selections = SelectInstruments(instrument_selections=[]) 
        if hasattr(instrument_selections_raw, 'instrument_selections') and instrument_selections_raw.instrument_selections is not None:
            instrument_selections = SelectInstruments(instrument_selections=instrument_selections_raw.instrument_selections)
        print(f"LLM selected instruments: {instrument_selections.model_dump_json()}")
        validated_selections = []
        if instrument_selections.instrument_selections: 
            for item in instrument_selections.instrument_selections:
                if item.instrument_name in self._soundfont_map:
                    validated_selections.append(item)
                else:
                    print(f"Warning: LLM selected unknown instrument '{item.instrument_name}'. Ignoring.")
        else:
            print("Warning: No instrument selections returned or in unexpected format from focused LLM call.")
        return SelectInstruments(instrument_selections=validated_selections)

    async def _generate_chords_and_send_sse(self, params: FullMusicalParameters, selected_instruments: SelectInstruments, queue: SSEQueueManager):
        """Finds chord instrument, generates notes, and sends add_midi_track SSE action."""
        print("Starting chord generation...")
        chord_instrument_selection = next((
            item for item in selected_instruments.instrument_selections 
            if item.role.lower() == "chords"
        ), None)

        if chord_instrument_selection:
            chord_instrument_name = chord_instrument_selection.instrument_name
            if chord_instrument_name in self._soundfont_map:
                chord_instrument_details = self._soundfont_map[chord_instrument_name]
                print(f"Found chords instrument: {chord_instrument_name}")

                try:
                    if isinstance(params.chord_progression, str):
                        processed_chord_progression = re.sub(
                            r"[,\s]+", "-", params.chord_progression
                        ).strip("-")
                    else:
                        print(f"Warning: Invalid chord progression format: {params.chord_progression}, skipping chord generation.")
                        processed_chord_progression = None

                    if processed_chord_progression:
                        print(f"Generating notes for chord progression: '{processed_chord_progression}' in {params.key} {params.mode} using {chord_instrument_name}")
                        
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
                            print(
                                f"Chord transformation returned empty or invalid result for progression '{processed_chord_progression}'"
                            )
                        else:
                            print(f"Generated {len(chord_notes_data.get('notes', []))} chord notes.")
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
                            
                            print(f"Sending add_midi_track action for chords: {chord_track.name}")
                            await queue.action(AssistantAction.add_midi_track(track=chord_track))

                except Exception as e:
                    print(f"Error during chord generation/SSE: {str(e)}")
                    # Optionally send an error via queue?
                    # await queue.error("Failed to generate chords.")
            else:
                print(f"Warning: Selected chords instrument '{chord_instrument_name}' not found in soundfont map.")
        else:
            print("Warning: No instrument with role 'chords' selected. Skipping chord generation.")

    async def generate_melody_notes(self, current_params: FullMusicalParameters, selected_instruments: SelectInstruments) -> MelodyData:
        """Generates melody notes. This tool now uses a detailed interval-based prompt and converts the result to absolute notes."""
        print(f"Step 'generate_melody_notes' for song: {current_params.song_title if current_params and current_params.song_title else 'Untitled'}")
        
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

            print(f"Analyzing chord progression: {chord_progression_list} in key: {key_for_analysis}")

            analysis_result = analyze_chord_progression(chord_progression_list, key_for_analysis) # Assume this returns a dict or None
            
            if analysis_result:
                actual_chord_analysis_data = analysis_result
                note_analysis_json_str = json.dumps(analysis_result, indent=2)
                print(f"Chord analysis generated: {note_analysis_json_str}...")
            else:
                print("Warning: Chord analysis returned no data.")
        except Exception as e_analysis:
            print(f"Warning: Failed to analyze chord progression '{chord_progression_str}' for key '{key}' {mode}: {e_analysis}. Proceeding without detailed note weights.")
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

        print(f"DEBUG: Creating fresh ChatSession for melody generation...")
        
        # Clone settings from the agent's main chat session
        melody_chat_session = ChatSession(
            provider_name=self.chat_session.current_provider_name,
            model_name=self.chat_session.current_model_name,
            queue=self.chat_session.queue,
            api_key=self.chat_session.current_api_key,
            base_url=self.chat_session.current_base_url,
            **self.chat_session.current_provider_kwargs
        )
        
        print(f"DEBUG: Prompting for IntervalMelodyOutput with fresh context. Prompt length: {len(interval_prompt)} chars.")
        print(f"DEBUG: Prompt start: {interval_prompt[:200]}...")
        
        # Direct LLM call with fresh context instead of using _focused_llm_call
        max_retries = 2
        interval_melody_output_raw = None
        
        for attempt in range(max_retries + 1):
            try:
                print(f"Melody generation attempt {attempt + 1}...")
                response_data = await melody_chat_session.send_message_async(
                    user_prompt_content=interval_prompt,
                    stream=False,
                    model_settings={},
                    expect_json=True
                )
                
                if isinstance(response_data, str):
                    parsed_json_data = json.loads(response_data)
                    print(f"Parsed JSON data: {parsed_json_data}")
                    interval_melody_output_raw = IntervalMelodyOutput(**parsed_json_data)
                    print(f"Successfully parsed melody on attempt {attempt + 1}.")
                    break
                elif isinstance(response_data, IntervalMelodyOutput):
                    interval_melody_output_raw = response_data
                    print(f"ChatSession directly returned IntervalMelodyOutput on attempt {attempt + 1}.")
                    break
                else:
                    print(f"Unexpected response type on attempt {attempt + 1}: {type(response_data)}")
            except json.JSONDecodeError as jde:
                print(f"JSON decode error on attempt {attempt + 1}: {jde}")
            except Exception as e:
                print(f"Error on melody generation attempt {attempt + 1}: {e}")
            
            if attempt < max_retries:
                retry_prompt = f"Previous attempt failed. Please provide a valid IntervalMelodyOutput JSON.\nSchema: {IntervalMelodyOutput.model_json_schema()}\nOriginal request: {interval_prompt[:300]}..."
                interval_prompt = retry_prompt
                
        # Fall back if all attempts failed
        if not interval_melody_output_raw:
            print("All melody generation attempts failed. Using empty fallback.")
            interval_melody_output_raw = IntervalMelodyOutput(starting_octave=3, bars=[])
        
        interval_melody_output = interval_melody_output_raw
        print(f"LLM returned interval melody: {interval_melody_output.model_dump_json(indent=2)}...")

        final_melody_data_from_intervals = self._convert_interval_melody_to_absolute_melody(
            interval_melody=interval_melody_output,
            key_name=key,
            mode_name=mode # mode_name might be useful for determining actual scale for the root note
        )
        print(f"Converted to absolute melody: {final_melody_data_from_intervals.model_dump_json(indent=2)}...")

        # Correct notes if analysis is available
        final_melody_data: MelodyData
        if actual_chord_analysis_data: # This is the dict from analyze_chord_progression
            print("Attempting to correct out-of-key notes using chord analysis...")
            # Note: _correct_notes_in_key is synchronous, so no await here
            corrected_melody_data = self._correct_notes_in_key(
                melody_data=final_melody_data_from_intervals,
                key_name=key,
                mode_name=mode,
                chord_analysis_data=actual_chord_analysis_data, 
                chord_progression_str=chord_progression_str,
                duration_bars=duration_bars
            )
            final_melody_data = corrected_melody_data
        else:
            print("Chord analysis data not available or failed, skipping note correction.")
            final_melody_data = final_melody_data_from_intervals
        
        print(f"Melody after potential correction: {final_melody_data.model_dump_json(indent=2)}...")

        # Validate the generated melody right after conversion/correction
        try:
            # Normalize key for music21 (remove trailing 'm' if present)
            normalized_key = key
            if mode.lower() == "minor" and key.endswith("m"):
                normalized_key = key[:-1]  # Remove trailing 'm' from 'Cm', 'Am', etc.
            
            print(f"Validating melody with normalized key: {normalized_key} {mode}")
            # Use our new robust validation function
            validate_melody_in_key(melody_data=final_melody_data, key_name=normalized_key, mode_name=mode)
            print("Melody successfully validated by generate_melody_notes.")
        except ValueError as e_validation:
            print(f"Melody validation failed: {e_validation}")
            # Propagate the validation error
            raise e_validation

        return final_melody_data

    def _duration_str_to_beats(self, duration_str: str, tempo: int) -> float:
        duration_map = {
            "whole": 4.0, "half": 2.0, "dotted half": 3.0,
            "quarter": 1.0, "dotted quarter": 1.5,
            "eighth": 0.5, "dotted eighth": 0.75,
            "sixteenth": 0.25, "thirtysecond": 0.125,
            "quarter triplet": 2.0 / 3.0, "eighth triplet": 1.0 / 3.0, "sixteenth triplet": 0.5 / 3.0
        }
        return duration_map.get(duration_str.lower().replace("-", " "), 1.0) # Handle hyphens, default to 1 beat

    def _get_key_root_midi(self, key_name: str, octave: int) -> int:
        note_map = {'C': 0, 'C#': 1, 'DB': 1, 'D': 2, 'D#': 3, 'EB': 3, 'E': 4, 'F': 5, 
                    'F#': 6, 'GB': 6, 'G': 7, 'G#': 8, 'AB': 8, 'A': 9, 'A#': 10, 'BB': 10, 'B': 11}
        base_midi_for_octave = {3: 48, 4: 60, 5: 72}
        note_offset = note_map.get(key_name.upper(), 0)
        return base_midi_for_octave.get(octave, 60) + note_offset

    def _convert_interval_melody_to_absolute_melody(self, interval_melody: IntervalMelodyOutput, key_name: str, mode_name: str) -> MelodyData:
        absolute_melody_bars: List[Bar] = []
        current_midi_note = self._get_key_root_midi(key_name, interval_melody.starting_octave)
        initial_midi_note_for_bar_start = current_midi_note # Keep track of the first note for the entire melody
        
        # The first note's interval is relative to this initial_midi_note_for_bar_start if it's the very first note overall.
        # Subsequent notes are relative to the *previous sounding note*.
        # A rest ("R") means the previous note's pitch is held in `current_midi_note` but no new note is added.

        first_note_overall = True

        for im_bar in interval_melody.bars:
            absolute_notes_for_bar: List[Note] = []
            current_beat_in_bar = 0.0
            # current_midi_note for this bar should ideally reset or be handled carefully if melodies across bars are independent
            # For now, assume continuous melody line, so current_midi_note carries over.

            for i_note in im_bar.notes:
                duration_beats = self._duration_str_to_beats(i_note.duration, 120) 
                pitch_to_play = current_midi_note 
                is_rest = False

                if i_note.interval.upper() == 'R':
                    is_rest = True
                else:
                    try:
                        interval_val = int(i_note.interval)
                        if first_note_overall:
                            # The very first sounding note establishes the pitch based on its interval from the chosen root.
                            pitch_to_play = initial_midi_note_for_bar_start + interval_val
                            first_note_overall = False
                        else:
                            pitch_to_play = current_midi_note + interval_val
                        
                        current_midi_note = max(0, min(127, pitch_to_play)) # Update current_midi_note to the new sounding pitch
                        pitch_to_play = current_midi_note # Ensure clamped value is used

                    except ValueError:
                        print(f"Warning: Could not parse interval '{i_note.interval}'. Treating as hold/same note as previous.")
                        pitch_to_play = current_midi_note 
                
                if not is_rest:
                    absolute_notes_for_bar.append(
                        Note(
                            pitch=pitch_to_play,
                            start_beat=current_beat_in_bar,
                            duration_beats=duration_beats,
                        )
                    )
                    # Only update current_midi_note if a note was actually sounded and parsed
                    # If it was a rest, current_midi_note remains the pitch of the *previous* note.
                    # If it was an unparsable interval, current_midi_note also remains as pitch of *previous* note.
                    # This was already handled by `current_midi_note = max(0, min(127, pitch_to_play))` if not rest and parsable.
                
                current_beat_in_bar += duration_beats
            
            if absolute_notes_for_bar:
                absolute_melody_bars.append(Bar(bar=im_bar.bar_number, notes=absolute_notes_for_bar))
        
        return MelodyData(bars=absolute_melody_bars)

    def _get_note_name(self, pitch_class: int) -> str:
        # Helper to convert pitch class (0-11) to note name (C, C#, D, etc.)
        note_names = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]
        return note_names[pitch_class % 12]

    def _correct_notes_in_key(
        self,
        melody_data: MelodyData,
        key_name: str,
        mode_name: str,
        chord_analysis_data: Optional[Dict[str, Any]], # Result from analyze_chord_progression
        chord_progression_str: str,
        duration_bars: int
    ) -> MelodyData:
        if not chord_analysis_data:
            print("Correction: Skipping note correction as chord analysis data is not available.")
            return melody_data

        parsed_chords = [c.strip() for c in re.split(r'[-,\s]+', chord_progression_str) if c.strip()]
        if not parsed_chords:
            print("Correction: Skipping note correction as no chords found in progression.")
            return melody_data

        total_beats = duration_bars * 4 # Assuming 4/4 time
        # Ensure beats_per_chord_segment is at least 1 to avoid division by zero if total_beats < len(parsed_chords)
        beats_per_chord_segment = max(1.0, total_beats / len(parsed_chords)) 

        try:
            normalized_key_for_scale = key_name
            if mode_name.lower() == "minor" and key_name.endswith("m"):
                normalized_key_for_scale = key_name[:-1]
            
            # Use our more reliable function to get the complete set of scale pitch classes
            allowed_pitch_classes = get_complete_scale_pitch_classes(normalized_key_for_scale, mode_name)
            print(f"Correction: Allowed pitch classes for '{normalized_key_for_scale} {mode_name}': {allowed_pitch_classes}")
        except ValueError as e:
            print(f"Correction: Cannot get scale pitch classes: {e}. Skipping correction.")
            return melody_data

        corrected_bars: List[Bar] = []
        for bar_item in melody_data.bars:
            new_notes_for_bar: List[Note] = []
            current_bar_start_beat = (bar_item.bar - 1) * 4 # Assuming 1-indexed bar numbers and 4 beats/bar

            for note in bar_item.notes:
                original_pitch = note.pitch
                original_pitch_class = original_pitch % 12

                if original_pitch_class not in allowed_pitch_classes:
                    print(f"Correction: Note {original_pitch} (class {original_pitch_class}) at beat {note.start_beat} in bar {bar_item.bar} is out of key.")

                    current_note_absolute_beat = current_bar_start_beat + note.start_beat
                    chord_segment_index = int(current_note_absolute_beat / beats_per_chord_segment)
                    chord_segment_index = min(chord_segment_index, len(parsed_chords) - 1)
                    current_chord_name = parsed_chords[chord_segment_index]
                    
                    # Find the analysis dict for the current chord in the list
                    current_chord_specific_analysis = next(
                        (item for item in chord_analysis_data if item.get("chord_name") == current_chord_name),
                        {}
                    )
                    current_chord_note_weights = {}
                    if isinstance(current_chord_specific_analysis, dict):
                        note_weights = current_chord_specific_analysis.get("note_weights")
                        if isinstance(note_weights, dict):
                            current_chord_note_weights = note_weights
                        else:
                            print(f"Warning: note_weights for chord {current_chord_name} is not a dict: {type(note_weights)}. Value: {note_weights}")
                    else:
                        print(f"Warning: current_chord_specific_analysis for chord {current_chord_name} is not a dict: {type(current_chord_specific_analysis)}. Value: {current_chord_specific_analysis}")

                    possible_corrections = []

                    for offset in range(-6, 7): # Search a tritone up/down
                        candidate_pitch = original_pitch + offset
                        if not (0 <= candidate_pitch <= 127):
                            continue
                        
                        candidate_pitch_class = candidate_pitch % 12
                        if candidate_pitch_class in allowed_pitch_classes:
                            distance = abs(candidate_pitch - original_pitch)
                            
                            harmonic_weight = 0.1 # Default low weight
                            if current_chord_note_weights and isinstance(current_chord_note_weights, dict):
                                candidate_note_name = self._get_note_name(candidate_pitch_class)
                                harmonic_weight = current_chord_note_weights.get(candidate_note_name, 0.1)
                            
                            possible_corrections.append({
                                "pitch": candidate_pitch,
                                "distance": distance,
                                "harmonic_weight": harmonic_weight
                            })

                    if possible_corrections:
                        # First, sort by distance (ascending)
                        possible_corrections.sort(key=lambda x: x["distance"])
                        
                        # Find all candidates with the minimum distance
                        min_distance = possible_corrections[0]["distance"]
                        closest_candidates = [c for c in possible_corrections if c["distance"] == min_distance]
                        
                        # If there are multiple candidates with the same distance
                        if len(closest_candidates) > 1:
                            # Group candidates by direction (above and below)
                            above_candidates = [c for c in closest_candidates if c["pitch"] > original_pitch]
                            below_candidates = [c for c in closest_candidates if c["pitch"] < original_pitch]
                            
                            if above_candidates and below_candidates:
                                # In Western music theory, resolution direction depends on:
                                # 1. Context of the tonality and chord
                                # 2. The relative harmonic weight of the destination notes
                                # 3. Standard voice leading rules
                                
                                # First, identify which scale tones are closest to our out-of-key note
                                scale_tones_above = [p for p in sorted(allowed_pitch_classes) 
                                                     if p > original_pitch_class % 12]
                                scale_tones_below = [p for p in sorted(allowed_pitch_classes) 
                                                     if p < original_pitch_class % 12]
                                
                                # Handle edge cases by wrapping around octave
                                if not scale_tones_above:
                                    scale_tones_above = [min(allowed_pitch_classes)]
                                if not scale_tones_below:
                                    scale_tones_below = [max(allowed_pitch_classes)]
                                
                                closest_above = min(scale_tones_above)
                                closest_below = max(scale_tones_below)
                                
                                # Check if this is a leading tone pattern (semitone below a scale tone)
                                is_leading_tone = (closest_above - original_pitch_class % 12) % 12 == 1
                                
                                # Check if this is a descending pattern (semitone above a scale tone)
                                is_descending_tone = (original_pitch_class % 12 - closest_below) % 12 == 1

                                # Get the best candidates in each direction by harmonic weight
                                best_above = max(above_candidates, key=lambda x: x["harmonic_weight"])
                                best_below = max(below_candidates, key=lambda x: x["harmonic_weight"])
                                
                                # If both are semitone relations, we need to make a contextual decision
                                if is_leading_tone and is_descending_tone:
                                    # If harmonic weights are significantly different, use that as the primary factor
                                    # This handles cases like G# in C major, where G has much higher harmonic weight
                                    harmonic_weight_ratio = best_below["harmonic_weight"] / max(best_above["harmonic_weight"], 0.1)
                                    
                                    if harmonic_weight_ratio > 5.0:  # If below is 5x stronger
                                        # The note below has much stronger harmonic weight
                                        closest_candidates = [best_below]
                                    elif 1.0 / harmonic_weight_ratio > 5.0:  # If above is 5x stronger
                                        # The note above has much stronger harmonic weight
                                        closest_candidates = [best_above]
                                    else:
                                        # If harmonic weights are comparable, apply standard principles:
                                        # - Accidentals between two natural notes typically resolve to the closest
                                        #   chord tone
                                        above_is_chord_tone = best_above["harmonic_weight"] > 40.0  # Threshold for chord tones
                                        below_is_chord_tone = best_below["harmonic_weight"] > 40.0
                                        
                                        if above_is_chord_tone and not below_is_chord_tone:
                                            closest_candidates = [best_above]
                                        elif below_is_chord_tone and not above_is_chord_tone:
                                            closest_candidates = [best_below]
                                        else:
                                            # If both or neither are chord tones, use the stronger harmonic connection
                                            if best_above["harmonic_weight"] >= best_below["harmonic_weight"]:
                                                closest_candidates = [best_above]
                                            else:
                                                closest_candidates = [best_below]
                                elif is_leading_tone:
                                    # Leading tones typically resolve upward
                                    closest_candidates = [best_above]
                                elif is_descending_tone:
                                    # Descending chromatic tones typically resolve downward
                                    closest_candidates = [best_below]
                                else:
                                    # For other interval relationships, prefer the stronger harmonic connection
                                    if best_above["harmonic_weight"] >= best_below["harmonic_weight"]:
                                        closest_candidates = [best_above]
                                    else:
                                        closest_candidates = [best_below]
                            
                            # If we only have candidates in one direction, keep those
                            
                            # Final tiebreaker: sort by harmonic weight if still multiple options
                            if len(closest_candidates) > 1:
                                closest_candidates.sort(key=lambda x: -x["harmonic_weight"])
                        
                        best_corrected_pitch = closest_candidates[0]["pitch"]

                        if best_corrected_pitch != original_pitch:
                            print(f"Correction: Corrected to {best_corrected_pitch} (class {best_corrected_pitch % 12}). Original: {original_pitch}. Chord: {current_chord_name}. Details: {closest_candidates[0]}")
                            new_notes_for_bar.append(note.model_copy(update={'pitch': best_corrected_pitch}))
                        else:
                            # This case means the original note was already the best choice among in-key notes, 
                            # which contradicts it being out-of-key initially. This path should ideally not be taken if a note is truly out of key.
                            print(f"Correction: Note {original_pitch} deemed best fit or no better in-key correction found. Keeping. (Check logic if note was initially out-of-key)")
                            new_notes_for_bar.append(note)
                    else:
                        print(f"Correction: Could not find any in-key correction for {original_pitch} in search window. Keeping original.")
                        new_notes_for_bar.append(note)
                else:
                    new_notes_for_bar.append(note)
            
            if new_notes_for_bar:
                 corrected_bars.append(Bar(bar=bar_item.bar, notes=new_notes_for_bar))
            elif melody_data.bars : # if original bar had notes but corrected has none, still add empty bar to maintain structure if needed, or decide to omit
                print(f"Correction: Bar {bar_item.bar} became empty after attempting corrections. Original notes: {len(bar_item.notes)}")
                # corrected_bars.append(Bar(bar=bar_item.bar, notes=[])) # Option to keep empty bar

        return MelodyData(bars=corrected_bars)

    async def select_drum_sounds(self, determined_params: FullMusicalParameters) -> SelectDrumSounds:
        """Selects drum sounds based on previously determined musical parameters."""
        print(f"Step 'select_drum_sounds' called for song: {determined_params.song_title if determined_params.song_title else 'Untitled'}")
        drum_sample_names = [ds.display_name for ds in self._available_drum_samples]
        focused_prompt = f"""
        For a song in {determined_params.key} {determined_params.mode} at {determined_params.tempo} BPM, with style hints from the title '{determined_params.song_title}', user prompt '{determined_params.original_user_prompt}', and chord progression '{determined_params.chord_progression}'.
        Available Drum Samples (choose from this list only): {json.dumps(drum_sample_names)}
        Select 4-5 appropriate drum sounds (e.g., kick, snare, hi-hat).
        Provide your response *only* in the 'SelectDrumSounds' structure (a JSON object with a 'drum_sounds' list of strings).
        <CRITICAL_INSTRUCTION>The sounds you choose MUST be in the list of available drum samples.</CRITICAL_INSTRUCTION>
        <CRITICAL_INSTRUCTION>Any sounds not appearing in the available drum samples list will be rejected.</CRITICAL_INSTRUCTION>
        <CRITICAL_INSTRUCTION>Remember, you MUST choose from THESE SAMPLES ONLY: {json.dumps(drum_sample_names)}</CRITICAL_INSTRUCTION>
        <CRITICAL_INSTRUCTION>DO NOT choose sounds from the research provided, that is only meant to assist you in choosing from this list: {json.dumps(drum_sample_names)}</CRITICAL_INSTRUCTION>
        Example: {json.dumps(SelectDrumSounds.model_json_schema())}
        """
        drum_sound_selections_raw = await self._focused_llm_call(focused_prompt, SelectDrumSounds)
        drum_sound_selections = SelectDrumSounds(drum_sounds=[]) 
        if hasattr(drum_sound_selections_raw, 'drum_sounds') and drum_sound_selections_raw.drum_sounds is not None:
            drum_sound_selections = SelectDrumSounds(drum_sounds=drum_sound_selections_raw.drum_sounds)
        print(f"LLM selected drum sounds: {drum_sound_selections.model_dump_json()}")
        validated_drums = []
        if drum_sound_selections.drum_sounds:
            for name in drum_sound_selections.drum_sounds:
                if name in self._drum_sample_map:
                    validated_drums.append(name)
                else:
                    print(f"Warning: LLM selected unknown drum sound '{name}'. Ignoring.")
                    print(f"Available drum samples: {self._drum_sample_map.keys()}")
        else:
            print("Warning: No drum sounds returned or in unexpected format from focused LLM call.")
        return SelectDrumSounds(drum_sounds=validated_drums)

    async def generate_drum_beat_patterns(self, determined_params: FullMusicalParameters, selected_drums_data: SelectDrumSounds) -> CreateDrumBeat:
        """Generates drum beat patterns based on musical parameters and selected drum sounds."""
        print(f"Step 'generate_drum_beat_patterns' for song: {determined_params.song_title if determined_params.song_title else 'Untitled'}")
        drum_info_for_prompt = []
        if hasattr(selected_drums_data, 'drum_sounds') and selected_drums_data.drum_sounds:
            for name in selected_drums_data.drum_sounds:
                if name in self._drum_sample_map:
                    drum_info_for_prompt.append({"id": str(self._drum_sample_map[name].id), "name": name})
        if not drum_info_for_prompt:
            print("No valid selected drum sounds to generate patterns for. Returning empty patterns.")
            return CreateDrumBeat(drum_beats=[])
        focused_prompt = f"""
        Create drum beat patterns for a {determined_params.duration_bars}-bar song in {determined_params.key} {determined_params.mode} at {determined_params.tempo} BPM.
        User prompt for style: '{determined_params.original_user_prompt}'.
        Use these selected drum sounds (provide patterns for these IDs): {json.dumps(drum_info_for_prompt)}.
        Each pattern MUST be a list of EXACTLY 32 booleans (representing 16th notes over 2 bars). Do NOT exceed 32 items in any pattern list.
        Output *only* in the 'CreateDrumBeat' structure (a JSON object with a 'drum_beats' list).
        Example: {json.dumps(CreateDrumBeat.model_json_schema())}
        """
        drum_beat_data = await self._focused_llm_call(focused_prompt, CreateDrumBeat)
        if not isinstance(drum_beat_data, CreateDrumBeat):
            print(f"Warning: _focused_llm_call did not return CreateDrumBeat. Got {type(drum_beat_data)}. Returning empty.")
            return CreateDrumBeat(drum_beats=[])
        print(f"LLM generated and processed drum patterns: {drum_beat_data.model_dump_json()}")
        return drum_beat_data

    def _sanitize_key_and_mode(self, key: str, mode: str) -> tuple[str, str]:
        """If key is like 'A minor' or 'C major', split it. Always return (tonic, mode)."""
        if key and isinstance(key, str) and " " in key:
            parts = key.strip().split()
            if len(parts) == 2 and parts[1].lower() in ("major", "minor"):
                return parts[0], parts[1].lower()
        return key, mode.lower() if mode else "major"

    # --- Main Orchestration Method ---
    async def run(self, request: SongRequest, model_info: ModelInfo, queue: SSEQueueManager, session: Session) -> SongComposition:
        """Orchestrates the music generation process and returns the final composition. Requires model_info for ChatSession."""
        self.chat_session = ChatSession(
            provider_name=model_info.provider_name,
            model_name=model_info.model_name,
            queue=queue,
            api_key=model_info.api_key,
            base_url=model_info.base_url
        )
        
        await self._init_real_data(session)
        
        print(f"MusicGenerationAgent run started for prompt: '{request.user_prompt}', duration: {request.duration_bars} bars")
        print(f"Available soundfonts length: {len(self._available_soundfonts)}")
        print(f"Available drum samples length: {len(self._available_drum_samples)}")
        
        await queue.add_chunk(f"MusicGenerationAgent run started for prompt: '{request.user_prompt}', duration: {request.duration_bars} bars")
        # Pass chat_session to all internal methods that need it
        # ... update all internal calls to use chat_session ...
        # For brevity, only show the start of the method here. The rest of the method and all internal calls must be updated to use chat_session as needed.
        print(f"MusicGenerationAgent run started for prompt: '{request.user_prompt}', duration: {request.duration_bars} bars")
        self._initial_song_request = request # Store for potential use by helper methods if ever needed

        # --- 1. Research Step (NEW, like music_gen_service.py) ---
        print("Starting research using MusicResearcher...")
        
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
            print(f"Sanitized key/mode: '{params.key}'/'{params.mode}' -> '{sanitized_key}'/'{sanitized_mode}'")
            params.key = sanitized_key
            params.mode = sanitized_mode

        # 3. Select Instruments
        selected_instruments = await self.select_instruments(determined_params=params)

        # 3. Generate Chords and Send SSE
        await self._generate_chords_and_send_sse(params, selected_instruments, queue)

        # 4. Generate Melody (assuming for primary melody role for now)
        melody_data = await self.generate_melody_notes(
            current_params=params,
            selected_instruments=selected_instruments
        )

        # 5. Select Drum Sounds (now with drum research context)
        drum_research_addition = ""
        if drum_research_result:
            drum_research_addition = f"\n\nDrum sound research:\n{drum_research_result}"
        # Patch: temporarily pass drum research as part of the song title for context, or modify select_drum_sounds to accept extra context
        params_with_drum_research = params.model_copy()
        if hasattr(params_with_drum_research, 'song_title') and params_with_drum_research.song_title:
            params_with_drum_research.song_title += drum_research_addition
        else:
            params_with_drum_research.song_title = drum_research_addition
        selected_drum_sounds = await self.select_drum_sounds(determined_params=params_with_drum_research)

        # 6. Generate Drum Beat
        drum_beat_patterns = await self.generate_drum_beat_patterns(
            determined_params=params,
            selected_drums_data=selected_drum_sounds
        )

        # 7. Assemble SongComposition
        instrument_tracks: List[InstrumentTrack] = []
        # Attempt to find the instrument selected for the "melody" role
        melody_instrument_selection = next((
            item for item in selected_instruments.instrument_selections 
            if item.role.lower() == "melody"
        ), None)

        if melody_instrument_selection and melody_data.bars:
            all_melody_notes: List[Note] = []
            for bar_item in melody_data.bars:
                all_melody_notes.extend(bar_item.notes)
            
            instrument_tracks.append(
                InstrumentTrack(
                    name=melody_instrument_selection.instrument_name, 
                    role="melody",
                    soundfont_name=melody_instrument_selection.instrument_name, # Assuming this is the soundfont name
                    notes=all_melody_notes
                )
            )
        # TODO: Future: Handle other instrument roles (e.g., chords, bass) if note generation logic is expanded.

        drum_track_data_for_composition: Optional[DrumTrackData] = None
        if drum_beat_patterns and drum_beat_patterns.drum_beats:
            drum_track_data_for_composition = DrumTrackData(patterns=drum_beat_patterns.drum_beats)

        composition_summary_parts = [
            f"Title: {params.song_title if params.song_title else 'Untitled'}",
            f"Key: {params.key} {params.mode}",
            f"Tempo: {params.tempo} BPM",
            f"Duration: {params.duration_bars} bars",
            f"Chord Progression: {params.chord_progression}"
        ]
        if melody_instrument_selection:
            composition_summary_parts.append(f"Melody Instrument: {melody_instrument_selection.instrument_name}")
        if selected_drum_sounds.drum_sounds:
            composition_summary_parts.append(f"Drum Sounds: {', '.join(selected_drum_sounds.drum_sounds)}")
        
        final_composition_summary = ". ".join(composition_summary_parts) + "."

        song_composition = SongComposition(
            title=params.song_title,
            key=params.key,
            mode=params.mode,
            tempo=params.tempo,
            chord_progression_str=params.chord_progression,
            instrument_tracks=instrument_tracks,
            drum_track_data=drum_track_data_for_composition,
            composition_summary=final_composition_summary
        )
        
        print(f"MusicGenerationAgent run finished. Title: {song_composition.title}")
        return song_composition

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
#   print("--- Final Song Composition ---")
#   print(final_song.model_dump_json(indent=2))

# if __name__ == "__main__":
#   import asyncio
#   # asyncio.run(main()) # Requires async main and proper setup

music_agent = MusicGenerationAgent()