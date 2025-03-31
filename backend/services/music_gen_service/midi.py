from typing import Dict, List, Any, Optional, Tuple
import os
import base64
import logging
import mido
from mido import Message, MidiFile, MidiTrack

logger = logging.getLogger(__name__)

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
            track.append(Message('program_change', program=program, channel=channel, time=0))
        
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
    
    def _get_program_number(self, instrument_id: str) -> int:
        """
        Map instrument ID to MIDI program number.
        
        Args:
            instrument_id: ID of the instrument
            
        Returns:
            MIDI program number (0-127)
        """
        # This is a simplified mapping; a real implementation would have a more complete map
        instrument_map = {
            "piano": 0,  # Acoustic Grand Piano
            "electric_piano": 4,  # Electric Piano
            "guitar_acoustic": 24,  # Acoustic Guitar (nylon)
            "guitar_electric": 27,  # Electric Guitar (clean)
            "bass": 33,  # Electric Bass (finger)
            "violin": 40,  # Violin
            "cello": 42,  # Cello
            "trumpet": 56,  # Trumpet
            "saxophone": 66,  # Tenor Sax
            "flute": 73,  # Flute
            "synth_lead": 80,  # Lead 1 (square)
            "synth_pad": 88,  # Pad 1 (new age)
            "drums": 0  # Special case, will use channel 9 (10 in MIDI)
        }
        
        return instrument_map.get(instrument_id, 0)
    
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