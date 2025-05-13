from pydantic import BaseModel, Field, model_validator
from typing import List, Optional, Any, Dict, Union, get_origin, Sequence, get_args

# --- Base Model for Coercion ---
class BaseCoerceModel(BaseModel):
    @model_validator(mode='before')
    @classmethod
    def coerce_values(cls, data: Any) -> Any: # Renamed for clarity
        if not isinstance(data, dict): # Operate only on dict inputs
            return data

        processed_data = {}
        for key, value in data.items():
            field_info = cls.model_fields.get(key)
            current_value = value # Start with the original value for this key

            # Step 1: Single-item list unwrapping (if applicable)
            if field_info and isinstance(current_value, list) and len(current_value) == 1:
                expected_annotation_for_list_check = field_info.annotation
                origin_type_for_list_check = get_origin(expected_annotation_for_list_check)
                is_field_expecting_list_like = origin_type_for_list_check in (
                    list, tuple, set, frozenset, Sequence
                )
                
                if not is_field_expecting_list_like:
                    # print(f"Coercing field '{key}' (list unwrap): from {current_value} to {current_value[0]} because field annotation '{expected_annotation_for_list_check}' is not list-like.")
                    current_value = current_value[0] # Update current_value with the unwrapped item
            
            # Step 2: Scalar type coercion (if applicable, using the potentially unwrapped current_value)
            if field_info:
                target_scalar_type = None
                expected_annotation = field_info.annotation
                origin_type = get_origin(expected_annotation)
                
                # Determine the target scalar type for coercion
                if origin_type is Union: # Handles Optional[T] (Union[T, NoneType]) and other Unions
                    union_args = get_args(expected_annotation)
                    scalar_args = [arg for arg in union_args if arg is not type(None) and arg in (str, int, float, bool)]
                    if len(scalar_args) > 0: # Take the first one found
                        target_scalar_type = scalar_args[0]
                elif expected_annotation in (str, int, float, bool): # Direct scalar type
                    target_scalar_type = expected_annotation

                if target_scalar_type and current_value is not None and not isinstance(current_value, target_scalar_type):
                    original_value_for_log = current_value
                    try:
                        if target_scalar_type is bool:
                            if isinstance(current_value, str):
                                val_lower = current_value.lower()
                                if val_lower == 'true':
                                    current_value = True
                                elif val_lower == 'false':
                                    current_value = False
                            elif isinstance(current_value, (int, float)):
                                current_value = bool(current_value)
                        elif target_scalar_type is str:
                             current_value = str(current_value)
                        elif target_scalar_type is int:
                            current_value = int(float(current_value)) # Handle "1.0" -> 1, or 1.0 -> 1
                        elif target_scalar_type is float:
                            current_value = float(current_value)
                        
                        if current_value != original_value_for_log: # Log only if a change happened
                           print(f"Coercing field '{key}' (type cast): from {original_value_for_log} (type {type(original_value_for_log).__name__}) to {current_value} (expected {target_scalar_type.__name__}).")
                    except (ValueError, TypeError) as e:
                        print(f"Warning: Could not cast field '{key}' value '{original_value_for_log}' to {target_scalar_type.__name__}: {e}. Leaving as is for Pydantic validation.")
                        current_value = original_value_for_log
            
            processed_data[key] = current_value
            
        return processed_data

# --- Tool Output Schemas ---

class DetermineMusicalParameters(BaseCoerceModel):
    """Schema for the determine_musical_parameters tool output."""
    chord_progression: str = Field(..., description="The chord progression (e.g. C-G-Am-F, Aaug7-Dm7-G7-Cmaj7). Actual notes, not just numbers.")
    key: str = Field(..., description="The key of the chord progression (e.g. C, Db, G#)")
    mode: str = Field(..., description="The mode of the chord progression (major or minor).")
    tempo: int = Field(..., description="The tempo in BPM (e.g. 120, 140, 160)")
    melody_instrument_suggestion: str = Field(..., description="Suggested *type* of instrument for the melody (e.g., 'Piano', 'Violin'). General type.")
    chords_instrument_suggestion: str = Field(..., description="Suggested *type* of instrument for the chords (e.g., 'Piano', 'Strings'). General type.")


class InstrumentSelectionItem(BaseCoerceModel):
    """Schema for a single selected instrument item."""
    instrument_name: str = Field(..., description="The name of the selected instrument (must be from the available list).")
    role: str = Field(..., description="The role this instrument will play.", examples=["melody", "chords", "countermelody"])
    explanation: str = Field(..., description="Explanation of why this instrument was selected for this role.")

class SelectInstruments(BaseCoerceModel):
    """Schema for the select_instruments tool output."""
    instrument_selections: List[InstrumentSelectionItem] = Field(..., description="List of instrument selections with their roles and explanations.")


class SelectDrumSounds(BaseCoerceModel):
    """Schema for the select_drum_sounds tool output."""
    drum_sounds: List[str] = Field(..., description="List of selected drum sound names (e.g., ['Metro Kick Drum', 'Snare Drum']).")


class DrumBeatPatternItem(BaseCoerceModel):
    """Schema for a single drum beat pattern."""
    drum_sound_id: str = Field(..., description="The ID of the drum sound this pattern is for.")
    pattern: List[bool] = Field(..., min_length=32, max_length=32, description="A list of exactly 32 booleans for 16th notes over 2 bars (True=hit, False=silence).")

class CreateDrumBeat(BaseCoerceModel):
    """Schema for the create_drum_beat tool output."""
    drum_beats: List[DrumBeatPatternItem] = Field(..., description="A list of drum beat patterns, one for each selected drum sound.")


class CreateMelodyToolOutput(BaseCoerceModel):
    """Schema for the create_melody tool output (describes the melody conceptually)."""
    instrument_name: str = Field(..., description="Name of the instrument intended for the melody.")
    description: str = Field(..., description="Detailed description of the melody's character.")
    mood: str = Field(..., description="Emotional quality (e.g., 'joyful', 'melancholic').")
    rhythm_type: str = Field(..., description="Type of rhythm (e.g., 'simple 4/4', 'swing').")
    musical_style: str = Field(..., description="Musical style or genre (e.g., 'classical', 'jazz').")
    melodic_character: str = Field(..., description="Character (e.g., 'flowing', 'staccato').")


# --- Direct LLM Response Schemas (Not necessarily tool outputs) ---

class Note(BaseCoerceModel):
    """Schema for a single musical note."""
    pitch: int = Field(..., description="MIDI pitch value (e.g., 60 for Middle C).")
    start_beat: float = Field(..., description="The beat within the bar where the note starts (0-indexed).")
    duration_beats: float = Field(..., description="How long the note lasts in terms of beats.")
    velocity: int = Field(..., description="Note velocity or volume (0-127)", ge=0, le=127)

class Bar(BaseCoerceModel):
    """Schema for a single bar of music containing notes."""
    bar: int = Field(..., description="The bar number (1-indexed).")
    notes: List[Note] = Field(..., description="List of notes within this bar.")

class MelodyData(BaseCoerceModel):
    """Schema for the structured melody data expected directly from the LLM."""
    bars: List[Bar] = Field(..., description="List of bars composing the melody.")
    # Add other top-level fields if the LLM is expected to produce them, e.g.:
    # total_duration_beats: Optional[float] = Field(None, description="Total duration of the melody in beats.") 


class ChordProgressionOutput(BaseCoerceModel):
    """Schema for the LLM to output a chord progression string and its reasoning."""
    chord_progression: str = Field(..., description="The chord progression as a string (e.g., C-G-Am-F, Am7-D7-Gmaj7). Use standard chord notation.")
    reasoning: Optional[str] = Field(None, description="Brief reasoning for choosing this chord progression based on the musical context.") 
    
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