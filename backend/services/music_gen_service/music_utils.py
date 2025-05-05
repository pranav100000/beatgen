from music21 import scale, pitch, note, harmony


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
