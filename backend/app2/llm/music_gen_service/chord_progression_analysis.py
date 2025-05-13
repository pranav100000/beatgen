from decimal import Decimal
from music21 import pitch, key, harmony, roman


def analyze_chord_progression(chord_progression, key_str):
    """Analyze a chord progression and return information for melody generation"""
    # Parse the key
    if key_str.endswith("m"):
        # Handle 'Em' format
        k = key.Key(key_str[:-1], "minor")
    elif "m" in key_str:
        # Handle other minor formats like 'E minor'
        k = key.Key(key_str.split("m")[0], "minor")
    else:
        # Assume major
        k = key.Key(key_str)

    # Get key scale and notes
    key_scale = k.getScale()
    key_notes = [p.name for p in key_scale.getPitches()]

    # Standard chromatic scale
    chromatic_scale = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]

    # For minor keys, adjust some notes to use flats
    if k.mode == "minor":
        chromatic_scale = [
            "C",
            "Db",
            "D",
            "Eb",
            "E",
            "F",
            "F#",
            "G",
            "Ab",
            "A",
            "Bb",
            "B",
        ]

    melody_data = []

    for chord_str in chord_progression:
        # Use ChordSymbol for consistent parsing
        chord_obj = harmony.ChordSymbol(chord_str)

        # Get Roman numeral analysis for harmonic function
        rn = roman.romanNumeralFromChord(chord_obj, k)
        chord_function = determine_function_from_roman(rn)

        # Start with all chromatic notes
        available_notes = set(chromatic_scale)

        # Get basic chord notes
        chord_notes = [p.name for p in chord_obj.pitches]

        # Remove chord notes from available notes
        for note in chord_notes:
            # Find equivalent note in our chromatic scale (handling enharmonics)
            for chromatic_note in list(available_notes):
                if (
                    pitch.Pitch(note).pitchClass
                    == pitch.Pitch(chromatic_note).pitchClass
                ):
                    available_notes.discard(chromatic_note)

        # Get one extended chord note - the next logical extension based on chord type
        extended_chord_notes = get_one_extension(chord_obj, k, available_notes)

        # Remove extended note from available notes
        for note in extended_chord_notes:
            for chromatic_note in list(available_notes):
                if (
                    pitch.Pitch(note).pitchClass
                    == pitch.Pitch(chromatic_note).pitchClass
                ):
                    available_notes.discard(chromatic_note)

        # Get remaining key notes
        key_only_notes = []
        for note in key_notes:
            for chromatic_note in list(available_notes):
                if (
                    pitch.Pitch(note).pitchClass
                    == pitch.Pitch(chromatic_note).pitchClass
                ):
                    key_only_notes.append(chromatic_note)
                    available_notes.discard(chromatic_note)

        # Whatever is left are tension notes
        tension_notes = list(available_notes)

        # Initialize data structure
        chord_data = {
            "chord_name": chord_str,
            "roman_numeral": rn.figure,
            "chord_notes": chord_notes,
            "extended_chord_notes": extended_chord_notes,
            "key_notes": key_only_notes,
            "tension_notes": tension_notes,
            "note_weights": {},
        }

        # Calculate weights for all notes in the chromatic scale
        for note_name in chromatic_scale:
            note_p = pitch.Pitch(note_name)
            note_pc = note_p.pitchClass
            root_pc = chord_obj.root().pitchClass

            # Calculate position in chord
            interval_from_root = (note_pc - root_pc) % 12
            interval_name = get_interval_name(interval_from_root)

            # Calculate scale degree in the key
            scale_degree = get_scale_degree(note_p, k)

            # Categorize note
            is_chord_note = any(
                pitch.Pitch(n).pitchClass == note_pc for n in chord_notes
            )
            is_extended = any(
                pitch.Pitch(n).pitchClass == note_pc for n in extended_chord_notes
            )
            is_key_note = any(
                pitch.Pitch(n).pitchClass == note_pc for n in key_only_notes
            )

            # Calculate tension level
            if is_chord_note:
                tension_level = 1
            elif is_extended:
                tension_level = 3
            elif is_key_note:
                tension_level = 5
            else:
                tension_level = 8

            # Note properties for weight calculation
            note_properties = {
                "is_chord_tone": is_chord_note,
                "is_extended_chord": is_extended,
                "is_key_note": is_key_note,
                "interval_name": interval_name,
                "scale_degree": scale_degree,
                "tension_level": tension_level,
            }

            # Calculate weight
            weight = calculate_note_weight(note_properties, chord_function, rn)
            chord_data["note_weights"][note_name] = float(round(Decimal(weight), 4))

        melody_data.append(chord_data)

    return melody_data


def get_one_extension(chord_obj, k, available_notes):
    """Get one logical extension note for the chord"""
    root = chord_obj.root()
    chord_type = chord_obj.commonName

    # Convert available_notes to pitch classes for comparison
    available_pcs = [pitch.Pitch(n).pitchClass for n in available_notes]

    # Define possible extensions in order of preference
    if "minor" in chord_type.lower():
        # For minor chords: 9, 11, 13/b13
        extensions = [2, 5, 8]  # 9th, 11th, b13th
    elif "major" in chord_type.lower():
        # For major chords: 9, 13, #11
        extensions = [2, 9, 6]  # 9th, 13th, #11th
    elif "dominant" in chord_type.lower() or "7" in chord_type:
        # For dominant 7th chords: 9, 13, b9, #9, #11
        extensions = [2, 9, 1, 3, 6]  # 9th, 13th, b9th, #9th, #11th
    elif "diminished" in chord_type.lower():
        # For diminished chords: 9, 11
        extensions = [2, 5]  # 9th, 11th
    else:
        # Default extensions
        extensions = [2, 5, 9]  # 9th, 11th, 13th

    # Find the first available extension in the key
    key_pitches = k.getScale().getPitches()
    key_pcs = [p.pitchClass for p in key_pitches]

    for ext in extensions:
        ext_pc = (root.pitchClass + ext) % 12

        # Check if this extension is available and in key
        if ext_pc in available_pcs and ext_pc in key_pcs:
            # Find the note name in our available notes
            for note in available_notes:
                if pitch.Pitch(note).pitchClass == ext_pc:
                    return [note]

    # If no extension found in key, take first available extension
    for ext in extensions:
        ext_pc = (root.pitchClass + ext) % 12

        if ext_pc in available_pcs:
            # Find the note name in our available notes
            for note in available_notes:
                if pitch.Pitch(note).pitchClass == ext_pc:
                    return [note]

    # Return empty list if no extension found
    return []


def determine_function_from_roman(rn):
    """Determine harmonic function from Roman numeral analysis"""
    # Get the scale degree (handle potential AttributeError)
    try:
        degree = rn.scaleDegree
    except AttributeError:
        # Fallback if scaleDegree is not available
        # Extract scale degree from the figure (e.g., "V" -> 5)
        import re

        match = re.match(r"([ivIV]+)", rn.figure)
        if match:
            roman_numeral = match.group(1).upper()
            # Convert Roman numeral to integer
            roman_map = {"I": 1, "II": 2, "III": 3, "IV": 4, "V": 5, "VI": 6, "VII": 7}
            degree = roman_map.get(roman_numeral, 0)
        else:
            degree = 0

    # Tonic function: I, i, iii, III, vi, VI
    if degree in [1, 3, 6]:
        return "tonic"
    # Subdominant function: ii, IV, iv
    elif degree in [2, 4]:
        return "subdominant"
    # Dominant function: V, V7, vii°
    elif degree in [5, 7]:
        return "dominant"
    else:
        return "other"


def find_extended_notes(chord_obj, k):
    """Find extended chord notes (9, 11, 13) that are in the key"""
    # Get the chord's root note and basic chord tones
    root = chord_obj.root()
    [p.name for p in chord_obj.pitches]

    # Get the key scale
    key_scale = k.getScale()
    key_pitches = key_scale.getPitches()

    # For each scale degree, determine if it's an available extension
    extensions = []

    # Get scale degree of root
    root_degree = None
    for i, scale_pitch in enumerate(key_pitches):
        if root.pitchClass == scale_pitch.pitchClass:
            root_degree = i
            break

    if root_degree is None:
        # Root not in key, can't reliably find extensions
        return []

    # Define the scale degrees that would be extensions
    # For a triad: 9th (2nd), 11th (4th), 13th (6th)
    # For a 7th chord: 9th (2nd), 11th (4th), 13th (6th)
    extension_degrees = [1, 3, 5]  # indices in key scale (2nd, 4th, 6th from root)

    for degree_offset in extension_degrees:
        # Calculate scale degree index (circular)
        degree = (root_degree + degree_offset) % len(key_pitches)
        extension = key_pitches[degree]

        # Skip if extension is already in the chord
        if any(p.pitchClass == extension.pitchClass for p in chord_obj.pitches):
            continue

        # Check if extension is valid for this chord type
        if is_valid_extension_for_chord(chord_obj, extension):
            extensions.append(extension.name)

    return extensions


def is_valid_extension_for_chord(chord_obj, extension_pitch):
    """Determine if an extension is valid for a given chord type"""
    # Get basic chord properties
    root = chord_obj.root()
    chord_type = chord_obj.commonName
    any(
        p
        for p in chord_obj.pitches
        if (p.pitchClass - root.pitchClass) % 12 in [10, 11]
    )

    # Calculate the interval from root to extension
    from music21 import interval

    int_obj = interval.Interval(noteStart=root, noteEnd=extension_pitch)
    semitones = int_obj.semitones % 12

    # 9th (2nd): Almost always valid
    if semitones == 2:
        return True

    # 11th (4th): Often clashes with major 3rd
    elif semitones == 5:
        # Check if chord has a major 3rd
        has_major_third = any(
            p for p in chord_obj.pitches if (p.pitchClass - root.pitchClass) % 12 == 4
        )

        # Major chords + perfect 4th = clash
        # However, sus4 chords or minor chords can handle it
        if has_major_third and (
            "major" in chord_type.lower() or "dominant" in chord_type.lower()
        ):
            return False
        return True

    # 13th (6th): Generally okay except in some diminished contexts
    elif semitones == 9:
        return "diminished" not in chord_type.lower()

    # Other extensions are not standard
    return False


def find_available_tensions(chord_obj, k):
    """Find available tension notes - chromatic notes that create harmonic tension"""
    # Get chord tones and key notes
    chord_notes = [p.name for p in chord_obj.pitches]
    key_notes = [p.name for p in k.getScale().getPitches()]

    # Standard chromatic scale with correct enharmonics
    chromatic_scale = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]

    # For minor keys, adjust the chromatic notes to use flats where appropriate
    # Based on standard music theory practice
    if k.mode == "minor":
        chromatic_scale = [
            "C",
            "Db",
            "D",
            "Eb",
            "E",
            "F",
            "F#",
            "G",
            "Ab",
            "A",
            "Bb",
            "B",
        ]

    # Filter out notes that are already in the chord or key
    tension_notes = []
    for note in chromatic_scale:
        note_pc = pitch.Pitch(note).pitchClass

        # Check if this pitch class is already in the chord or key
        # using pitch class comparison for enharmonic equivalence
        is_in_chord = any(pitch.Pitch(n).pitchClass == note_pc for n in chord_notes)
        is_in_key = any(pitch.Pitch(n).pitchClass == note_pc for n in key_notes)

        # Tension notes are NOT in the chord and NOT in the key
        if not is_in_chord and not is_in_key:
            tension_notes.append(note)

    return tension_notes


def get_interval_name(semitones):
    """Get interval name based on semitones"""
    # Use a more direct mapping without relying on music21 methods
    interval_map = {
        0: "root",
        1: "b9",
        2: "9",
        3: "b3",
        4: "3",
        5: "11",
        6: "b5",
        7: "5",
        8: "#5",
        9: "13",
        10: "7",
        11: "maj7",
    }
    return interval_map.get(semitones, "unknown")


def get_scale_degree(pitch_obj, k):
    """Get scale degree of a pitch in a key"""
    key_scale = k.getScale()
    key_pitches = key_scale.getPitches()

    # Convert to pitch class for comparison
    pitch_pc = pitch_obj.pitchClass
    key_pcs = [p.pitchClass for p in key_pitches]

    if pitch_pc in key_pcs:
        return key_pcs.index(pitch_pc) + 1
    return None


def calculate_tension_level(pitch_obj, chord_obj, k):
    """Calculate tension level using music21 interval methods"""
    # Check if note is in chord
    if pitch_obj.name in [p.name for p in chord_obj.pitches]:
        return 1  # Lowest tension

    # Check if note is an extension
    root = chord_obj.root()
    for ext in [14, 17, 21]:  # 9th, 11th, 13th
        ext_pitch = root.transpose(ext)
        if pitch_obj.pitchClass == ext_pitch.pitchClass:
            return 3

    # Check if note is in key
    if pitch_obj.name in [p.name for p in k.getScale().getPitches()]:
        return 5

    # Calculate tension based on interval sizes
    from music21 import interval

    tensions = []
    for chord_pitch in chord_obj.pitches:
        # Create interval between chord note and the pitch
        int_obj = interval.Interval(noteStart=chord_pitch, noteEnd=pitch_obj)

        # Map common intervals to tension values (smaller = more consonant)
        # Unison/Octave: 0, Perfect 5th: 1, Major/Minor 3rd: 2
        # Perfect 4th: 3, Major/Minor 6th: 4, Major/Minor 2nd: 6, Tritone: 8
        semitones = int_obj.semitones % 12

        if semitones == 0:  # Unison/Octave
            tensions.append(0)
        elif semitones == 7:  # Perfect 5th
            tensions.append(1)
        elif semitones in [3, 4]:  # Major/Minor 3rd
            tensions.append(2)
        elif semitones == 5:  # Perfect 4th
            tensions.append(3)
        elif semitones in [8, 9]:  # Major/Minor 6th
            tensions.append(4)
        elif semitones in [1, 2]:  # Major/Minor 2nd
            tensions.append(6)
        elif semitones == 6:  # Tritone
            tensions.append(8)
        else:
            tensions.append(7)

    # Average tension value (if no intervals, default to high tension)
    if tensions:
        avg_tension = sum(tensions) / len(tensions)
        # Scale to range 1-10
        return min(10, max(6, int(avg_tension) + 2))

    return 8  # Default high tension


def calculate_note_weight(note_properties, chord_function, roman_numeral):
    """Calculate the probability weight for a note using sophisticated rules"""
    # Base weights - increase extended chord weight
    if note_properties["is_chord_tone"]:
        base_weight = 100
    elif note_properties["is_extended_chord"]:
        base_weight = 65  # Increased from 50
    elif note_properties["is_key_note"]:
        base_weight = 25  # Slightly increased
    else:
        base_weight = 8  # Slightly increased for more tension options

    # Apply position modifiers - make third/fifth more equal
    interval_name = note_properties["interval_name"]
    position_modifiers = {
        "root": 1.0,
        "3": 0.95,  # Slightly reduced from 0.9
        "b3": 0.95,  # Slightly reduced from 0.9
        "5": 0.85,  # Slightly increased from 0.8
        "7": 0.75,  # Slightly increased from 0.7
        "maj7": 0.75,  # Slightly increased from 0.7
        "9": 0.65,  # Increased from 0.6
        "11": 0.55,  # Increased from 0.5
        "13": 0.55,  # Increased from 0.5
        "b9": 0.5,  # New - specifically for dominant chords
        "#11": 0.5,  # New - specifically for jazz contexts
    }

    modifier = position_modifiers.get(interval_name, 0.4)
    weight = base_weight * modifier

    # Apply scale degree modifiers
    scale_degree = note_properties["scale_degree"]

    # Apply function-specific modifiers - increase leading tone emphasis
    if chord_function == "dominant":
        # Emphasize leading tone in dominant chords
        if scale_degree == 7:
            weight *= 1.4  # Increased from 1.3
        # Emphasize tension notes that resolve
        if interval_name in ["7", "b9", "#9"]:
            weight *= 1.3  # Increased from 1.2
    elif chord_function == "tonic":
        # Emphasize tonic note in tonic chords
        if scale_degree == 1:
            weight *= 1.2
        # De-emphasize tendency tones
        if scale_degree == 7:
            weight *= (
                0.6  # Reduced from 0.7 - even less emphasis on leading tone in tonic
            )
    elif chord_function == "subdominant":
        # Emphasize 4th scale degree
        if scale_degree == 4:
            weight *= 1.2  # Increased from 1.1

    # Apply chord-specific modifiers based on Roman numeral
    try:
        if hasattr(roman_numeral, "quality") and roman_numeral.quality == "major":
            # Major chords favor major scale runs
            if scale_degree in [1, 3, 5]:
                weight *= 1.1
        elif hasattr(roman_numeral, "quality") and roman_numeral.quality == "minor":
            # Minor chords favor minor scale runs
            if scale_degree in [1, 3, 5]:
                weight *= 1.1
        # Fallback to checking the chord object instead
        elif chord_function == "dominant":
            # Additional emphasis on certain chord tones for dominant
            if interval_name in ["3", "7"]:
                weight *= 1.15  # New - emphasize guide tones in dominant chords
        elif "minor" in str(roman_numeral).lower():
            if scale_degree in [1, 3, 5]:
                weight *= 1.1
    except (AttributeError, TypeError):
        # If we can't determine quality, just skip this modifier
        pass

    return weight

    return weight


# Example usage
if __name__ == "__main__":
    chord_progression = ["Em", "C", "Am", "B7"]
    key_str = "Em"  # E minor

    analysis = analyze_chord_progression(chord_progression, key_str)

    # Print results
    for chord_data in analysis:
        print(f"\nChord: {chord_data['chord_name']} ({chord_data['roman_numeral']})")
        print(f"Chord Notes: {chord_data['chord_notes']}")
        print(f"Extended Chord Notes: {chord_data['extended_chord_notes']}")
        print(f"Key Notes: {chord_data['key_notes']}")
        print(f"Tension Notes: {chord_data['tension_notes']}")

        # Print top notes by weight
        sorted_notes = sorted(
            chord_data["note_weights"].items(), key=lambda x: x[1], reverse=True
        )
        print("\nTop melody notes for this chord (with weights):")
        for note_name, weight in sorted_notes[:5]:
            print(f"{note_name}: {weight:.2f}")

    print(analysis)
