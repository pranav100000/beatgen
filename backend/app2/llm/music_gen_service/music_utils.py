from music21 import scale, pitch, note, harmony
from typing import List, Optional

# Import MelodyData for type hinting in the new validation function
from app2.llm.music_gen_service.llm_schemas import MelodyData


def get_mode_intervals(mode_name: str) -> list[str]:
    """
    Get the allowed semitone intervals for a given musical mode.

    Parameters:
    - mode_name: String representing the mode (e.g., 'major', 'natural minor',
                'harmonic minor', 'dorian', etc.)

    Returns:
    - List of integers representing the allowed semitone intervals
    """
    # Create a scale using C as the reference tonic
    # For standard modes
    if mode_name.lower() == "major":
        sc = scale.MajorScale("C")
    elif mode_name.lower() == "natural minor" or mode_name.lower() == "minor":
        sc = scale.MinorScale("C")
    elif mode_name.lower() == "harmonic minor":
        sc = scale.HarmonicMinorScale("C")
    elif mode_name.lower() == "melodic minor":
        sc = scale.MelodicMinorScale("C")
    elif mode_name.lower() == "harmonic major":
        sc = scale.HarmonicMajorScale("C")
    elif mode_name.lower() == "mixolydian":
        sc = scale.MixolydianScale("C")
    elif mode_name.lower() == "lydian":
        sc = scale.LydianScale("C")
    elif mode_name.lower() == "phrygian":
        sc = scale.PhrygianScale("C")
    elif mode_name.lower() == "locrian":
        sc = scale.LocrianScale("C")
    elif mode_name.lower() == "aeolian":
        sc = scale.AeolianScale("C")
    elif mode_name.lower() == "dorian":
        sc = scale.DorianScale("C")
    elif mode_name.lower() == "ionian":
        sc = scale.IonianScale("C")
    else:
        # For other modes (dorian, phrygian, etc.)
        sc = scale.ConcreteScale(tonic=pitch.Pitch("C"), mode=mode_name)

    print("scale:", sc)
    # Get scale pitches
    scale_pitches = sc.getPitches()
    if not scale_pitches:
        return []

    print("scale_pitches:", scale_pitches)
    # Calculate intervals between all scale pitches
    intervals = []

    root = scale_pitches[0]
    print("root:", root)

    for p1 in scale_pitches:
        # Calculate semitone difference
        interval_size = root.midi - p1.midi
        intervals.append(interval_size)

    intervals.extend([abs(x) for x in intervals[1:]])

    # Sort and return
    return sorted(intervals)


def get_chord_midi_notes(chord_name: str, key: str) -> list[int]:
    """
    Get the MIDI note values for a given chord name and key.

    Args:
        chord_name: String of chord name (e.g. "C", "Cm", "Cmaj7", "C7", "C9", "C13")

    Returns:
        List of MIDI note values
    """
    chord = harmony.Chord(chord_name)
    chord.getChordScale()


def get_root_note_midi(key: str) -> int:
    """
    Get the MIDI number of the root note for a given key.

    Parameters:
    - key: String representing the key (e.g., 'C', 'C#', 'Db', 'D', etc.)

    Returns:
    - Integer representing the MIDI number of the root note
    """
    # Create a scale using C as the reference tonic
    key_note = note.Note(key + "3") if key >= "C" else note.Note(key + "3")
    print("KEY NOTE:", key_note)
    return key_note.pitch.midi


def get_scale_pitch_classes(key_name: str, mode_name: str) -> set[int]:
    """Helper function to get the set of MIDI pitch classes for a given key and mode."""
    try:
        tonic_pitch_obj = pitch.Pitch(key_name)
    except Exception as e:
        raise ValueError(f"Invalid key_name: {key_name}. Error: {e}")

    mode_name_lower = mode_name.lower()
    sc = None

    # Map common mode names to music21 scale classes
    if mode_name_lower == "major" or mode_name_lower == "ionian":
        sc = scale.MajorScale(tonic_pitch_obj)
    elif mode_name_lower in ["minor", "natural minor", "aeolian"]:
        sc = scale.MinorScale(tonic_pitch_obj) # Natural Minor
    elif mode_name_lower == "harmonic minor":
        sc = scale.HarmonicMinorScale(tonic_pitch_obj)
    elif mode_name_lower == "melodic minor":
        sc = scale.MelodicMinorScale(tonic_pitch_obj)
    elif mode_name_lower == "dorian":
        sc = scale.DorianScale(tonic_pitch_obj)
    elif mode_name_lower == "phrygian":
        sc = scale.PhrygianScale(tonic_pitch_obj)
    elif mode_name_lower == "lydian":
        sc = scale.LydianScale(tonic_pitch_obj)
    elif mode_name_lower == "mixolydian":
        sc = scale.MixolydianScale(tonic_pitch_obj)
    elif mode_name_lower == "locrian":
        sc = scale.LocrianScale(tonic_pitch_obj)
    # Add other specific scales if needed, e.g., Blues, Pentatonic, etc.
    # elif mode_name_lower == "blues":
    #     sc = scale.MajorBluesScale(tonic_pitch_obj) # Or MinorBluesScale
    # elif mode_name_lower == "major pentatonic":
    #     sc = scale.MajorPentatonicScale(tonic_pitch_obj)
    else:
        # Fallback for modes that might be named differently or are less common
        try:
            sc = scale.ConcreteScale(tonic=tonic_pitch_obj, mode=mode_name_lower)
            # Check if this generic scale construction actually yields pitches
            if not sc.getPitches(tonic_pitch_obj, tonic_pitch_obj.transpose('P8')):
                sc = None # Invalidate if no pitches are found for a basic octave span
        except Exception:
            sc = None # Could not form a scale with the given mode name
    
    if not sc:
        raise ValueError(f"Unsupported or unrecognized mode: '{mode_name}' for key '{key_name}'.")

    # Get pitches for one octave to extract pitch classes
    # Transposing by a Perfect Octave (P8) should give the next octave of the tonic
    # Using tonic.transpose('P8') ensures correct interval regardless of current octave of tonic_pitch_obj
    octave_pitches = sc.getPitches(tonic_pitch_obj, tonic_pitch_obj.transpose('P8'))

    if not octave_pitches:
        # If the specific octave range failed, try getting all default pitches from the scale object
        print(f"Warning: sc.getPitches for an octave failed for {key_name} {mode_name}. Trying default getPitches(). Scale type: {type(sc)}")
        octave_pitches = sc.getPitches() # Get all available default pitches
        if not octave_pitches:
            raise ValueError(f"Could not retrieve any pitches for scale {key_name} {mode_name} using {type(sc)}.")

    allowed_pitch_classes = {p.pitchClass for p in octave_pitches}
    
    if not allowed_pitch_classes:
        raise ValueError(f"Derived an empty set of pitch classes for {key_name} {mode_name}. Scale object: {sc}")
        
    return allowed_pitch_classes


def validate_melody_in_key(melody_data: MelodyData, key_name: str, mode_name: str) -> bool:
    """
    Validates if all notes in the provided MelodyData are in the specified key and mode.

    Args:
        melody_data: The MelodyData object containing bars and notes.
        key_name: The key of the song (e.g., "C", "G#").
        mode_name: The mode of the song (e.g., "major", "minor").

    Returns:
        True if all notes are in key.

    Raises:
        ValueError: If any note is found to be out of key.
    """
    allowed_pitch_classes = get_complete_scale_pitch_classes(key_name, mode_name)
    print(f"Validating melody for {key_name} {mode_name}. Allowed pitch classes: {sorted(list(allowed_pitch_classes))}")

    for bar_index, bar in enumerate(melody_data.bars):
        for note_index, note_event in enumerate(bar.notes):
            midi_pitch = note_event.pitch
            pitch_class_of_note = midi_pitch % 12 # Get the pitch class (0-11) of the current note
            
            if pitch_class_of_note not in allowed_pitch_classes:
                raise ValueError(
                    f"Note out of key! Bar {bar.bar} (0-indexed bar in list: {bar_index}), "
                    f"Note {note_index} with MIDI pitch {midi_pitch} (pitch class {pitch_class_of_note}) "
                    f"is not in the scale of {key_name} {mode_name}. "
                    f"Allowed pitch classes: {sorted(list(allowed_pitch_classes))}."
                )
    print("Melody successfully validated: all notes are in key.")
    return True


def get_complete_scale_pitch_classes(key_name: str, mode_name: str) -> set[int]:
    """
    Helper function to get the complete set of scale pitch classes for a given key and mode.
    This is a more reliable implementation that directly calculates scale degrees
    based on music theory, used specifically for melody correction and validation.
    
    Args:
        key_name: The key name (e.g., "C", "Cm", "F#", "Bb")
        mode_name: The mode name (e.g., "major", "minor")
        
    Returns:
        A set of integers representing the pitch classes (0-11) in the scale
    """
    # Handle key names with trailing 'm' for minor keys (e.g., "Cm", "Am")
    normalized_key_name = key_name
    if normalized_key_name.endswith('m') and mode_name.lower() == 'minor':
        normalized_key_name = normalized_key_name[:-1]  # Remove trailing 'm'
    
    try:
        tonic_pitch_obj = pitch.Pitch(normalized_key_name)
        tonic_pc = tonic_pitch_obj.pitchClass
    except Exception as e:
        raise ValueError(f"Invalid key_name: {key_name} (normalized to {normalized_key_name}). Error: {e}")

    mode_name_lower = mode_name.lower()
    
    # Define scale degrees for common scales directly
    if mode_name_lower == "major" or mode_name_lower == "ionian":
        scale_degrees = [0, 2, 4, 5, 7, 9, 11]  # Major scale: W-W-H-W-W-W-H
    elif mode_name_lower in ["minor", "natural minor", "aeolian"]:
        scale_degrees = [0, 2, 3, 5, 7, 8, 10]  # Natural minor: W-H-W-W-H-W-W
    elif mode_name_lower == "harmonic minor":
        scale_degrees = [0, 2, 3, 5, 7, 8, 11]  # Harmonic minor: W-H-W-W-H-WH-H
    elif mode_name_lower == "melodic minor":
        scale_degrees = [0, 2, 3, 5, 7, 9, 11]  # Melodic minor (ascending): W-H-W-W-W-W-H
    elif mode_name_lower == "dorian":
        scale_degrees = [0, 2, 3, 5, 7, 9, 10]  # Dorian: W-H-W-W-W-H-W
    elif mode_name_lower == "phrygian":
        scale_degrees = [0, 1, 3, 5, 7, 8, 10]  # Phrygian: H-W-W-W-H-W-W
    elif mode_name_lower == "lydian":
        scale_degrees = [0, 2, 4, 6, 7, 9, 11]  # Lydian: W-W-W-H-W-W-H
    elif mode_name_lower == "mixolydian":
        scale_degrees = [0, 2, 4, 5, 7, 9, 10]  # Mixolydian: W-W-H-W-W-H-W
    elif mode_name_lower == "locrian":
        scale_degrees = [0, 1, 3, 5, 6, 8, 10]  # Locrian: H-W-W-H-W-W-W
    else:
        raise ValueError(f"Unsupported mode for melody correction: {mode_name}")
    
    # Adjust scale degrees based on the tonic pitch class
    allowed_pitch_classes = {(tonic_pc + degree) % 12 for degree in scale_degrees}
    
    # Debug output
    print(f"Complete scale pitch classes for {key_name} {mode_name}: {sorted(list(allowed_pitch_classes))}")
    
    return allowed_pitch_classes
