import json
import re
from typing import Dict, List, Any, Optional, Union
import os
import base64
import logging
import mido
from mido import Message, MidiFile, MidiTrack
from music21 import harmony
from app2.core.config import settings

from app2.models.public_models.instrument_file import InstrumentFileRead
from app2.llm.agents.music_agent import IntervalMelodyOutput
from app2.llm.music_gen_service.llm_schemas import MelodyData, Note, Bar
from app2.llm.music_gen_service.music_utils import get_complete_scale_pitch_classes, get_key_root_midi, get_note_name
from app2.llm.music_gen_service.music_utils import get_root_note_midi

logger = logging.getLogger(__name__)

def get_chord_progression_from_key(key: str, chord_progression: str) -> str:
    """
    Get the chord progression for a given key.
    """
    return key


def transform_drum_beats_to_midi_format(drum_pattern: List[bool]) -> Dict[str, Any]:
    """
    Transform drum beat patterns into MIDI format compatible with the MIDIGenerator class.

    Args:
        drum_beat_data: Output from the create_drum_beat tool with boolean patterns
            {
                "drum_beats": [
                    {
                        "drum_sound_id": "string",
                        "pattern": [true, false, ...] # 32 booleans
                    },
                    ...
                ]
            }

    Returns:
        Dictionary formatted for use with MIDIGenerator class
    """
    # Initialize the result structure
    result = {
        "name": "Drums",
        "channel": 9,  # MIDI channel 9 is reserved for percussion
        "patterns": [{"notes": []}],
    }

    # Handle case where no drum beats are provided
    if not drum_pattern:
        return result

    notes = []
    sixteenth_duration = 0.25  # Duration of a 16th note in beats

    # Process each drum sound
    for i, hit in enumerate(drum_pattern):
        # Get pitch from mapping or use a default
        pitch = settings.audio.DEFAULT_SAMPLER_BASE_NOTE

        # Process the pattern (32 booleans representing 16th notes over 2 bars)
        if hit:
            # Calculate start time in beats (each 16th note is 0.25 beats in 4/4 time)
            start_time = i * sixteenth_duration

            # Create a note event
            note = {
                "pitch": pitch,
                "start": start_time * settings.audio.PPQ,  # Convert to ticks (480 ticks per beat)
                "duration": sixteenth_duration * settings.audio.PPQ,  # Duration in ticks
                "velocity": 0.8,  # Default velocity for drums
            }

            notes.append(note)

    return {"notes": notes}

def correct_notes_in_key(
    melody_data: MelodyData,
    key_name: str,
    mode_name: str,
    chord_analysis_data: Optional[Dict[str, Any]], # Result from analyze_chord_progression
    chord_progression_str: str,
    duration_bars: int
) -> MelodyData:
    if not chord_analysis_data:
        logger.info("Correction: Skipping note correction as chord analysis data is not available.")
        return melody_data

    parsed_chords = [c.strip() for c in re.split(r'[-,\s]+', chord_progression_str) if c.strip()]
    if not parsed_chords:
        logger.info("Correction: Skipping note correction as no chords found in progression.")
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
        logger.info(f"Correction: Allowed pitch classes for '{normalized_key_for_scale} {mode_name}': {allowed_pitch_classes}")
    except ValueError as e:
        logger.info(f"Correction: Cannot get scale pitch classes: {e}. Skipping correction.")
        return melody_data

    corrected_bars: List[Bar] = []
    for bar_item in melody_data.bars:
        new_notes_for_bar: List[Note] = []
        current_bar_start_beat = (bar_item.bar - 1) * 4 # Assuming 1-indexed bar numbers and 4 beats/bar

        for note in bar_item.notes:
            original_pitch = note.pitch
            original_pitch_class = original_pitch % 12

            if original_pitch_class not in allowed_pitch_classes:
                logger.info(f"Correction: Note {original_pitch} (class {original_pitch_class}) at beat {note.start_beat} in bar {bar_item.bar} is out of key.")

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
                        logger.info(f"Warning: note_weights for chord {current_chord_name} is not a dict: {type(note_weights)}. Value: {note_weights}")
                else:
                    logger.info(f"Warning: current_chord_specific_analysis for chord {current_chord_name} is not a dict: {type(current_chord_specific_analysis)}. Value: {current_chord_specific_analysis}")

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
                            candidate_note_name = get_note_name(candidate_pitch_class)
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
                        logger.info(f"Correction: Corrected to {best_corrected_pitch} (class {best_corrected_pitch % 12}). Original: {original_pitch}. Chord: {current_chord_name}. Details: {closest_candidates[0]}")
                        new_notes_for_bar.append(note.model_copy(update={'pitch': best_corrected_pitch}))
                    else:
                        # This case means the original note was already the best choice among in-key notes, 
                        # which contradicts it being out-of-key initially. This path should ideally not be taken if a note is truly out of key.
                        logger.info(f"Correction: Note {original_pitch} deemed best fit or no better in-key correction found. Keeping. (Check logic if note was initially out-of-key)")
                        new_notes_for_bar.append(note)
                else:
                    logger.info(f"Correction: Could not find any in-key correction for {original_pitch} in search window. Keeping original.")
                    new_notes_for_bar.append(note)
            else:
                new_notes_for_bar.append(note)
        
        if new_notes_for_bar:
                corrected_bars.append(Bar(bar=bar_item.bar, notes=new_notes_for_bar))
        elif melody_data.bars : # if original bar had notes but corrected has none, still add empty bar to maintain structure if needed, or decide to omit
            logger.info(f"Correction: Bar {bar_item.bar} became empty after attempting corrections. Original notes: {len(bar_item.notes)}")
            # corrected_bars.append(Bar(bar=bar_item.bar, notes=[])) # Option to keep empty bar

    return MelodyData(bars=corrected_bars)

def duration_str_to_beats(duration_str: str, tempo: int) -> float:
    duration_map = {
        "whole": 4.0, "half": 2.0, "dotted half": 3.0,
        "quarter": 1.0, "dotted quarter": 1.5,
        "eighth": 0.5, "dotted eighth": 0.75,
        "sixteenth": 0.25, "thirtysecond": 0.125,
        "quarter triplet": 2.0 / 3.0, "eighth triplet": 1.0 / 3.0, "sixteenth triplet": 0.5 / 3.0
    }
    return duration_map.get(duration_str.lower().replace("-", " "), 1.0) # Handle hyphens, default to 1 beat

def convert_interval_melody_to_absolute_melody(interval_melody: "IntervalMelodyOutput", key_name: str, mode_name: str) -> "MelodyData":
    absolute_melody_bars: List[Bar] = []
    current_midi_note = get_key_root_midi(key_name, interval_melody.starting_octave)
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
            duration_beats = duration_str_to_beats(i_note.duration, 120) 
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
                    logger.info(f"Warning: Could not parse interval '{i_note.interval}'. Treating as hold/same note as previous.")
                    pitch_to_play = current_midi_note 
            
            if not is_rest:
                absolute_notes_for_bar.append(
                    Note(
                        pitch=pitch_to_play,
                        start_beat=current_beat_in_bar,
                        duration_beats=duration_beats,
                        velocity=i_note.velocity,
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

def transform_melody_data_to_instrument_format(melody_data: MelodyData, beats_per_bar: int = 4) -> Dict[str, Any]:
    notes_list = []
    
    processed_bars = list(melody_data.bars) # Start with a mutable copy

    # Calculate total duration of actual notes for the duplication logic
    # This calculation of total_duration_beats might not be what's intended for the "8 beats" rule,
    # as it sums durations rather than checking the span of the melody.
    # However, retaining the original condition's spirit with a sum of durations:
    total_note_duration_beats = sum(note.duration_beats for bar in melody_data.bars for note in bar.notes)

    # if melody_data.bars and total_note_duration_beats > 0 and total_note_duration_beats <= 8: # Ensure there are bars and notes
    #     logger.info(f"Melody total note duration {total_note_duration_beats} <= 8 beats, duplicating bars.")
    #     original_bars_to_duplicate = list(melody_data.bars) # Make a copy to iterate over
    #     num_original_bars = len(original_bars_to_duplicate)
        
    #     if num_original_bars > 0:
    #         duplicated_part = []
    #         for bar_to_copy in original_bars_to_duplicate:
    #             # Create new Bar objects with adjusted bar numbers for the duplicated part
    #             new_bar_number = bar_to_copy.bar + num_original_bars
    #             # Deep copy notes to avoid modifying original data if Note objects are mutable in ways not shown
    #             copied_notes = [note.model_copy() for note in bar_to_copy.notes]
    #             duplicated_part.append(Bar(bar=new_bar_number, notes=copied_notes))
    #         processed_bars.extend(duplicated_part)
    #     else:
    #         logger.info("No bars to duplicate.")
    
    for bar_item in processed_bars:
        bar_start_offset_beats = (bar_item.bar - 1) * beats_per_bar
        for note in bar_item.notes:
            absolute_note_start_beat = bar_start_offset_beats + note.start_beat
            notes_list.append({
                "pitch": note.pitch,
                "start": absolute_note_start_beat * settings.audio.PPQ,
                "duration": note.duration_beats * settings.audio.PPQ,
                "velocity": note.velocity,
            })
            # No longer using a cumulative current_time here, as absolute_note_start_beat provides the correct timing.

    return {
        "notes": notes_list,
    }

def transform_bars_to_instrument_format(
    data: Dict[str, Any], instrument: InstrumentFileRead, key: str
) -> Dict[str, Any]:
    """
    Transform the structured bars data from Claude into the expected instrument format.

    Args:
        data: Dictionary with bars data from Claude
        instrument_id: ID of the instrument

    Returns:
        Formatted data in the expected output structure
    """

    print("INSTRUMENT:", instrument)
    root_note_midi = get_root_note_midi(key)
    print("ROOT NOTE MIDI:", root_note_midi)
    # Extract bars data
    data.get("starting_octave", 4)
    bars = data.get("bars", [])

    # Prepare MIDI notes array
    midi_notes = []
    current_time = 0.0
    current_pitch = root_note_midi  # Start at root note

    # Get the root note from the key and mode

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
                    interval = 0  # Rest - keep same pitch but may have velocity 0
                else:
                    interval = int(interval_str)
            else:
                interval = int(interval_str)

            # Get duration and velocity
            duration_str = note.get("duration")
            velocity = note.get("velocity", 64)  # Default velocity if not specified

            # Convert duration string to beats
            try:
                note_duration = _convert_duration_to_beats(duration_str)
            except ValueError:
                logger.warning(
                    f"Invalid duration: {duration_str}, defaulting to quarter note"
                )
                note_duration = 1.0  # Default to quarter note

            # Calculate new pitch based on interval
            if interval_str.startswith("R"):
                # For rests, keep the same pitch but set velocity to 0
                velocity = 0
            else:
                current_pitch += interval

            # Create MIDI note
            midi_note = {
                "pitch": current_pitch,
                "start": current_time * 480,
                "duration": note_duration * 480,
                "velocity": velocity,
            }

            # Add to notes array
            if velocity > 0:
                midi_notes.append(midi_note)

            # Update current time
            current_time += note_duration

    # Create the full result structure

    print("INSTRUMENT:", instrument)

    # Map from the instrument object to the correct field names
    # Handle both possible formats for compatibility
    result = {
        "instrument_id": instrument.id,
        "storage_key": instrument.storage_key,
        "name": instrument.display_name,
        "notes": {"notes": midi_notes},
    }

    print("RESULT:", result)

    return result


def transform_chord_progression_to_instrument_format(
    chord_progression: str, instrument: InstrumentFileRead, key: str
) -> Dict[str, Any]:
    """
    Transform the structured chord progression data from Claude into the expected instrument format.

    Args:
        chord_progression: String of chord names separated by dashes (e.g. "Cm-Aaug-Dm")
        instrument: Dictionary containing instrument data
        key: The key to use for the chord progression

    Returns:
        Dictionary with formatted instrument data including MIDI notes
    """
    print("INSTRUMENT:", instrument)
    print("KEY:", key)

    # Define common arrow or separator strings that are not chords
    NON_CHORD_TOKENS = ["→", "->", "->>", "-->", "=>", "==>", "&", "|"]

    raw_items_from_split = chord_progression.split('-')
    
    parsed_chord_list = []
    for item in raw_items_from_split:
        stripped_item = item.strip()
        if stripped_item and stripped_item not in NON_CHORD_TOKENS:
            parsed_chord_list.append(stripped_item)
    
    chord_progression_list = parsed_chord_list # Assign to the variable name used below

    print("CHORD PROGRESSION (raw input):", chord_progression)
    print("CHORD PROGRESSION LIST (cleaned and before length adjustment):", chord_progression_list)

    if not chord_progression_list:
        logger.warning(f"No valid chords found in progression string: '{chord_progression}' after filtering. Returning empty instrument notes.")
        return {
            "instrument_id": instrument.id,
            "storage_key": instrument.storage_key,
            "name": instrument.display_name,
            "notes": {"notes": []},  # Consistent return type
        }

    # Adjust list length if necessary (e.g., for 1, 2, 3 chords)
    # This logic now operates on the cleaned chord_progression_list
    if len(chord_progression_list) == 1:
        # Repeat the single chord 4 times
        chord_progression_list = [chord_progression_list[0]] * 4
    elif len(chord_progression_list) == 2:
        # Form a list: [c1, c1, c2, c2]
        chord_progression_list = [chord_progression_list[0]] * 2 + [chord_progression_list[1]] * 2
    elif len(chord_progression_list) == 3:
        # Form a list: [c1, c2, c3, c2]
        chord_progression_list = [chord_progression_list[0]] + [chord_progression_list[1]] + [chord_progression_list[2]] + [chord_progression_list[1]]
    elif len(chord_progression_list) > 4:
        chord_progression_list = chord_progression_list[:4]
    
    print("CHORD PROGRESSION LIST (after length adjustment):", chord_progression_list)
        

    # Initialize MIDI notes array
    midi_notes = []
    current_time = 0.0

    # Default duration for each chord (1 bar = 4 beats in 4/4 time)
    chord_duration = 4.0

    # Process each chord
    # No longer need: filtered_chord_progression_list = [chord for chord in chord_progression_list if chord]
    for chord_name in chord_progression_list: # Iterate directly over the cleaned and length-adjusted list
        # Parse the chord name into MIDI notes
        try:
            # chord_name is already stripped from the cleaning process
            chord_notes = _parse_chord_name(chord_name, key, octave=3)

            # Add each note in the chord
            for pitch in chord_notes:
                midi_note = {
                    "pitch": pitch,
                    "start": current_time * 480,
                    "duration": chord_duration * 480,
                    "velocity": 70,  # Default velocity for chords
                }
                midi_notes.append(midi_note)

            # Move to next chord
            current_time += chord_duration

        except ValueError as e:
            logger.warning(f"Skipping invalid chord {chord_name}: {str(e)}")
            continue

    # Create the full result structure
    # Map from the instrument object to the correct field names
    # Handle both possible formats for compatibility
    result = {
        "instrument_id": instrument.id,
        "storage_key": instrument.storage_key,
        "name": instrument.display_name,
        "notes": {"notes": midi_notes},
    }

    return result


def _parse_chord_name(chord_name: str, key: str, octave: int = 4) -> List[int]:
    """
    Parse a chord name into its MIDI note values.

    Args:
        chord_name: String of chord name (e.g. "C", "Cm", "Cmaj7", "C7", "C9", "C13")
        key: String of key (e.g. "C", "Db", "G#")
        octave: Integer of octave to use (default is 4)

    Returns:
        List of MIDI note values
    """
    logger.info(f"Parsing chord name: {chord_name}")
    # Convert 'b' flats to '-' for music21
    chord_name = chord_name.replace("b", "-")
    chord_name = chord_name.replace("♭", "-")
    chord = harmony.ChordSymbol(chord_name)
    return [note.midi for note in chord.pitches]


def _convert_duration_to_beats(
    duration_str, time_signature: List[int] = [4, 4]
) -> float:
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
        "triplet": 1 / 3,
        "half triplet": 4 / 3,
        "quarter triplet": 2 / 3,
        "eighth triplet": 1 / 3,
        "sixteenth triplet": 1 / 6,
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


def get_clean_track_data(tracks_data: Union[List, Dict, Any]) -> List[Dict[str, Any]]:
    """
    Clean track data by removing None values and ensuring proper formatting.
    Extracts all notes from patterns and formats according to TrackData schema.

    Args:
        tracks_data: List of track data that might contain None values or strings "None"

    Returns:
        Cleaned list of track data dictionaries formatted for TrackData schema
    """
    # Handle case where tracks_data is a string (e.g., JSON string)
    if isinstance(tracks_data, str):
        try:
            tracks_data = json.loads(tracks_data)
        except json.JSONDecodeError:
            logger.error(f"Failed to parse tracks_data as JSON: {tracks_data[:100]}...")
            return []

    # If it's not a list, return empty list
    if not isinstance(tracks_data, list):
        logger.warning(f"tracks_data is not a list: {type(tracks_data)}")
        return []

    # Filter out None values, "None" strings, and non-dict values
    cleaned_tracks = []
    for track in tracks_data:
        # Skip explicit None values
        if track is None:
            logger.warning(f"Skipping None track: {track}")
            continue

        # Skip "None" string values
        if track == "None" or track == '"None"':
            logger.warning(f"Skipping None string track: {track}")
            continue

        # Ensure track is a dictionary
        if not isinstance(track, dict):
            logger.warning(f"Skipping non-dict track: {track}")
            continue

        # Extract all notes from patterns
        all_notes = []
        if "instrument" in track and "patterns" in track["instrument"]:
            for pattern in track["instrument"]["patterns"]:
                if "notes" in pattern:
                    all_notes.extend(pattern["notes"])

        # Create cleaned track data in TrackData format
        cleaned_track = {
            "notes": all_notes,
            "instrument_name": track.get("instrument_name")
            or track.get("instrument", {}).get("name"),
            "storage_key": track.get("storage_key"),
        }

        cleaned_tracks.append(cleaned_track)

    logger.info(
        f"Cleaned tracks: {len(cleaned_tracks)} valid tracks from {len(tracks_data)} original items"
    )
    return cleaned_tracks