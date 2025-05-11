from pydantic import BaseModel, Field
from typing import List, Optional

# --- Tool Output Schemas ---

class DetermineMusicalParameters(BaseModel):
    """Schema for the determine_musical_parameters tool output."""
    chord_progression: str = Field(..., description="The chord progression (e.g. C-G-Am-F, Aaug7-Dm7-G7-Cmaj7). Actual notes, not just numbers.")
    key: str = Field(..., description="The key of the chord progression (e.g. C, Db, G#)")
    mode: str = Field(..., description="The mode of the chord progression (major or minor).")
    tempo: int = Field(..., description="The tempo in BPM (e.g. 120, 140, 160)")
    melody_instrument_suggestion: str = Field(..., description="Suggested *type* of instrument for the melody (e.g., 'Piano', 'Violin'). General type.")
    chords_instrument_suggestion: str = Field(..., description="Suggested *type* of instrument for the chords (e.g., 'Piano', 'Strings'). General type.")


class InstrumentSelectionItem(BaseModel):
    """Schema for a single selected instrument item."""
    instrument_name: str = Field(..., description="The name of the selected instrument (must be from the available list).")
    role: str = Field(..., description="The role this instrument will play.", examples=["melody", "chords", "countermelody"])
    explanation: str = Field(..., description="Explanation of why this instrument was selected for this role.")

class SelectInstruments(BaseModel):
    """Schema for the select_instruments tool output."""
    instrument_selections: List[InstrumentSelectionItem] = Field(..., description="List of instrument selections with their roles and explanations.")


class SelectDrumSounds(BaseModel):
    """Schema for the select_drum_sounds tool output."""
    drum_sounds: List[str] = Field(..., description="List of selected drum sound names (e.g., ['Metro Kick Drum', 'Snare Drum']).")


class DrumBeatPatternItem(BaseModel):
    """Schema for a single drum beat pattern."""
    drum_sound_id: str = Field(..., description="The ID of the drum sound this pattern is for.")
    pattern: List[bool] = Field(..., min_length=32, max_length=32, description="A list of exactly 32 booleans for 16th notes over 2 bars (True=hit, False=silence).")

class CreateDrumBeat(BaseModel):
    """Schema for the create_drum_beat tool output."""
    drum_beats: List[DrumBeatPatternItem] = Field(..., description="A list of drum beat patterns, one for each selected drum sound.")


class CreateMelodyToolOutput(BaseModel):
    """Schema for the create_melody tool output (describes the melody conceptually)."""
    instrument_name: str = Field(..., description="Name of the instrument intended for the melody.")
    description: str = Field(..., description="Detailed description of the melody's character.")
    mood: str = Field(..., description="Emotional quality (e.g., 'joyful', 'melancholic').")
    rhythm_type: str = Field(..., description="Type of rhythm (e.g., 'simple 4/4', 'swing').")
    musical_style: str = Field(..., description="Musical style or genre (e.g., 'classical', 'jazz').")
    melodic_character: str = Field(..., description="Character (e.g., 'flowing', 'staccato').")


# --- Direct LLM Response Schemas (Not necessarily tool outputs) ---

class Note(BaseModel):
    """Schema for a single musical note."""
    pitch: int = Field(..., description="MIDI pitch value (e.g., 60 for Middle C).")
    start_beat: float = Field(..., description="The beat within the bar where the note starts (0-indexed).")
    duration_beats: float = Field(..., description="How long the note lasts in terms of beats.")

class Bar(BaseModel):
    """Schema for a single bar of music containing notes."""
    bar: int = Field(..., description="The bar number (1-indexed).")
    notes: List[Note] = Field(..., description="List of notes within this bar.")

class MelodyData(BaseModel):
    """Schema for the structured melody data expected directly from the LLM."""
    bars: List[Bar] = Field(..., description="List of bars composing the melody.")
    # Add other top-level fields if the LLM is expected to produce them, e.g.:
    # total_duration_beats: Optional[float] = Field(None, description="Total duration of the melody in beats.") 


class ChordProgressionOutput(BaseModel):
    """Schema for the LLM to output a chord progression string and its reasoning."""
    chord_progression: str = Field(..., description="The chord progression as a string (e.g., C-G-Am-F, Am7-D7-Gmaj7). Use standard chord notation.")
    reasoning: Optional[str] = Field(None, description="Brief reasoning for choosing this chord progression based on the musical context.") 