import json
from typing import Dict, List, Any, Optional, Tuple, Union
import os
import base64
import logging
import mido
from mido import Message, MidiFile, MidiTrack
from music21 import harmony

from services.music_gen_service.music_utils import get_root_note_midi

logger = logging.getLogger(__name__)

def transform_bars_to_instrument_format(data: Dict[str, Any], instrument: dict, key: str) -> Dict[str, Any]:
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
    starting_octave = data.get("starting_octave", 4)
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
                logger.warning(f"Invalid duration: {duration_str}, defaulting to quarter note")
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
                "start": current_time,
                "duration": note_duration,
                "velocity": velocity
            }
            
            # Add to notes array
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
        "name": instrument.name,
        "notes": midi_notes
    }
    
    print("RESULT:", result)
    
    return result

def transform_chord_progression_to_instrument_format(chord_progression: str, instrument, key: str) -> Dict[str, Any]:
    """
    Transform the structured chord progression data from Claude into the expected instrument format.
    
    Args:
        chord_progression: String of chord names separated by dashes (e.g. "Cm-Aaug-Dm")
        instrument: Dictionary containing instrument data
        key: The key to use for the chord progression
        
    Returns:
        Dictionary with formatted instrument data including MIDI notes
    """
    print("CHORD PROGRESSION:", chord_progression)
    print("INSTRUMENT:", instrument)
    print("KEY:", key)
    chord_progression_list = chord_progression.split("-")
    if len(chord_progression_list) == 0:
        return []
    
    # Initialize MIDI notes array
    midi_notes = []
    current_time = 0.0
    
    # Default duration for each chord (1 bar = 4 beats in 4/4 time)
    chord_duration = 4.0
    
    # Process each chord
    for chord_name in chord_progression_list:
        # Parse the chord name into MIDI notes
        try:
            chord_notes = _parse_chord_name(chord_name.strip(), key, octave=3)
            
            # Add each note in the chord
            for pitch in chord_notes:
                midi_note = {
                    "pitch": pitch,
                    "start": current_time,
                    "duration": chord_duration,
                    "velocity": 70  # Default velocity for chords
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
        "name": instrument.name,
        "notes": midi_notes
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
    chord_name = chord_name.replace('b', '-')
    chord = harmony.ChordSymbol(chord_name)
    return [note.midi for note in chord.pitches]



def _convert_duration_to_beats(duration_str, time_signature: List[int] = [4, 4]) -> float:
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
        "triplet": 1/3,
        "half triplet": 4/3,
        "quarter triplet": 2/3,
        "eighth triplet": 1/3,
        "sixteenth triplet": 1/6
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
            "instrument_name": track.get("instrument_name") or track.get("instrument", {}).get("name"),
            "storage_key": track.get("storage_key")
        }
        
        cleaned_tracks.append(cleaned_track)
        
    logger.info(f"Cleaned tracks: {len(cleaned_tracks)} valid tracks from {len(tracks_data)} original items")
    return cleaned_tracks


class MIDIGenerator:
    """
    Handles the generation of MIDI files from music descriptions.
    """
    
    def __init__(self, output_dir: str = "output"):
        """
        Initialize the MIDI generator.
        
        Args:
            output_dir: Directory to save generated MIDI files
        """
        self.output_dir = output_dir
        os.makedirs(output_dir, exist_ok=True)
    
    async def generate_midi_separate(self, music_description: Dict[str, Any]) -> List[Dict[str, Any]]:
        """
        Generate separate MIDI files for each instrument in the description.
        
        Args:
            music_description: Complete description of the music to generate
            
        Returns:
            List of dictionaries, each with the generated MIDI data and metadata for one instrument
        """
        # Extract basic metadata
        title = music_description.get("title", "Untitled")
        tempo = music_description.get("tempo", 120)
        
        # Create a sub-directory for this composition
        composition_dir = os.path.join(self.output_dir, self._sanitize_filename(title))
        os.makedirs(composition_dir, exist_ok=True)
        
        results = []
        
        # Iterate through instruments and create a separate MIDI file for each
        for instrument in music_description.get("instruments", []):
            instrument_name = instrument.get("name", "Unknown")
            soundfont_name = instrument.get("soundfont_name", instrument_name)
            
            # Create a new MIDI file for this instrument
            midi_file = MidiFile()
            
            # Add the instrument track
            self._add_instrument_track(midi_file, instrument, tempo)
            
            # Generate a filename based on the soundfont
            file_name = f"{self._sanitize_filename(soundfont_name)}.mid"
            file_path = os.path.join(composition_dir, file_name)
            
            # Save to file
            midi_file.save(file_path)
            
            # Read file data for return
            with open(file_path, 'rb') as f:
                midi_data = base64.b64encode(f.read()).decode('utf-8')
            
            results.append({
                "title": title,
                "instrument_name": instrument_name,
                "soundfont_name": soundfont_name,
                "tempo": tempo,
                "file_path": file_path,
                "track_count": len(midi_file.tracks),
                "midi_data": midi_data
            })
        
        return results
    
    async def generate_midi(self, music_description: Dict[str, Any]) -> Dict[str, Any]:
        """
        Generate a single MIDI file from a music description.
        (Legacy method - combines all instruments into one file)
        
        Args:
            music_description: Complete description of the music to generate
            
        Returns:
            Dictionary with the generated MIDI data and metadata
        """
        # Extract basic metadata
        title = music_description.get("title", "Untitled")
        tempo = music_description.get("tempo", 120)
        
        # Create a new MIDI file with timing information
        midi_file = MidiFile()
        
        # Iterate through instruments and create tracks
        for instrument in music_description.get("instruments", []):
            self._add_instrument_track(midi_file, instrument, tempo)
        
        # Save to file
        file_path = os.path.join(self.output_dir, f"{self._sanitize_filename(title)}.mid")
        midi_file.save(file_path)
        
        # Read file data for return
        with open(file_path, 'rb') as f:
            midi_data = base64.b64encode(f.read()).decode('utf-8')
        
        return {
            "title": title,
            "tempo": tempo,
            "file_path": file_path,
            "track_count": len(midi_file.tracks),
            "midi_data": midi_data
        }
    
    def _add_instrument_track(self, 
                             midi_file: MidiFile, 
                             instrument: Dict[str, Any],
                             tempo: int) -> None:
        """
        Add an instrument track to the MIDI file.
        
        Args:
            midi_file: The MIDI file to add the track to
            instrument: Instrument data with patterns
            tempo: Tempo in BPM
        """
        track = MidiTrack()
        midi_file.tracks.append(track)
        
        # Add track name
        track.append(mido.MetaMessage('track_name', name=instrument.get("name", "Track"), time=0))
        
        # Convert BPM to MIDI tempo (microseconds per beat)
        tempo_us = mido.bpm2tempo(tempo)
        track.append(mido.MetaMessage('set_tempo', tempo=tempo_us, time=0))
        
        # Get the channel and program number
        channel = instrument.get("channel", 0)
        
        # Special case for percussion
        is_percussion = channel == 9 or instrument.get("program") == "percussion"
        
        # If not percussion, set the program number
        if not is_percussion:
            program = instrument.get("program", 0)
            if isinstance(program, str):
                program = self._get_program_number(program)
            track.append(Message('program_change', program=0, channel=channel, time=0))
        
        # Add notes from patterns
        for pattern in instrument.get("patterns", []):
            self._add_pattern_notes(track, pattern)
    
    def _add_pattern_notes(self, track: MidiTrack, pattern: Dict[str, Any]) -> None:
        """
        Add notes from a pattern to a track.
        
        Args:
            track: The MIDI track to add notes to
            pattern: Pattern data with notes
        """
        # Get the channel for this track
        # Look for a 'program_change' message to determine the channel
        channel = 0
        for msg in track:
            if msg.type == 'program_change':
                channel = msg.channel
                break
        
        # Sort notes by start time to ensure proper ordering
        notes = sorted(pattern.get("notes", []), key=lambda x: x["start"])
        
        # Create a list of all note events (both on and off)
        events = []
        
        # Process note events
        for note in notes:
            pitch = note["pitch"]
            start = note["start"]
            duration = note["duration"]
            velocity = note.get("velocity", 64)
            
            # Create note_on event
            events.append({
                "type": "note_on",
                "time": start,
                "pitch": pitch,
                "velocity": velocity
            })
            
            # Create note_off event
            events.append({
                "type": "note_off",
                "time": start + duration,
                "pitch": pitch,
                "velocity": 0  # Note-off velocity is typically 0
            })
        
        # Sort all events by time
        events.sort(key=lambda x: (x["time"], 0 if x["type"] == "note_off" else 1))
        
        # Process events in order
        current_time = 0
        for event in events:
            # Calculate delta time
            delta_time = int((event["time"] - current_time) * 480)  # 480 ticks per beat
            
            # Add event to track
            if event["type"] == "note_on":
                track.append(Message(
                    'note_on', 
                    note=event["pitch"], 
                    velocity=event["velocity"], 
                    channel=channel,
                    time=max(delta_time, 0)
                ))
            else:  # note_off
                track.append(Message(
                    'note_off',
                    note=event["pitch"],
                    velocity=event["velocity"],
                    channel=channel,
                    time=max(delta_time, 0)
                ))
            
            current_time = event["time"]
    
    def _sanitize_filename(self, filename: str) -> str:
        """
        Sanitize a filename to be safe for the filesystem.
        
        Args:
            filename: Original filename
            
        Returns:
            Sanitized filename
        """
        # Replace problematic characters
        return "".join([c for c in filename if c.isalnum() or c in " -_."]).strip()