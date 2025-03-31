import os
from typing import Dict, List, Any, Optional
import logging
import re
import json

logger = logging.getLogger(__name__)

# General MIDI Instrument Program Numbers
GM_INSTRUMENTS = {
    # Piano Family (0-7)
    0: "Acoustic Grand Piano",
    1: "Bright Acoustic Piano",
    2: "Electric Grand Piano",
    3: "Honky-tonk Piano",
    4: "Electric Piano 1",
    5: "Electric Piano 2",
    6: "Harpsichord",
    7: "Clavinet",
    
    # Chromatic Percussion Family (8-15)
    8: "Celesta",
    9: "Glockenspiel",
    10: "Music Box",
    11: "Vibraphone",
    12: "Marimba",
    13: "Xylophone",
    14: "Tubular Bells",
    15: "Dulcimer",
    
    # Organ Family (16-23)
    16: "Drawbar Organ",
    17: "Percussive Organ",
    18: "Rock Organ",
    19: "Church Organ",
    20: "Reed Organ",
    21: "Accordion",
    22: "Harmonica",
    23: "Tango Accordion",
    
    # Guitar Family (24-31)
    24: "Acoustic Guitar (nylon)",
    25: "Acoustic Guitar (steel)",
    26: "Electric Guitar (jazz)",
    27: "Electric Guitar (clean)",
    28: "Electric Guitar (muted)",
    29: "Overdriven Guitar",
    30: "Distortion Guitar",
    31: "Guitar Harmonics",
    
    # Bass Family (32-39)
    32: "Acoustic Bass",
    33: "Electric Bass (finger)",
    34: "Electric Bass (pick)",
    35: "Fretless Bass",
    36: "Slap Bass 1",
    37: "Slap Bass 2",
    38: "Synth Bass 1",
    39: "Synth Bass 2",
    
    # Strings Family (40-47)
    40: "Violin",
    41: "Viola",
    42: "Cello",
    43: "Contrabass",
    44: "Tremolo Strings",
    45: "Pizzicato Strings",
    46: "Orchestral Harp",
    47: "Timpani",
    
    # Ensemble Family (48-55)
    48: "String Ensemble 1",
    49: "String Ensemble 2",
    50: "Synth Strings 1",
    51: "Synth Strings 2",
    52: "Choir Aahs",
    53: "Voice Oohs",
    54: "Synth Voice",
    55: "Orchestra Hit",
    
    # Brass Family (56-63)
    56: "Trumpet",
    57: "Trombone",
    58: "Tuba",
    59: "Muted Trumpet",
    60: "French Horn",
    61: "Brass Section",
    62: "Synth Brass 1",
    63: "Synth Brass 2",
    
    # Reed Family (64-71)
    64: "Soprano Sax",
    65: "Alto Sax",
    66: "Tenor Sax",
    67: "Baritone Sax",
    68: "Oboe",
    69: "English Horn",
    70: "Bassoon",
    71: "Clarinet",
    
    # Pipe Family (72-79)
    72: "Piccolo",
    73: "Flute",
    74: "Recorder",
    75: "Pan Flute",
    76: "Blown Bottle",
    77: "Shakuhachi",
    78: "Whistle",
    79: "Ocarina",
    
    # Synth Lead Family (80-87)
    80: "Lead 1 (square)",
    81: "Lead 2 (sawtooth)",
    82: "Lead 3 (calliope)",
    83: "Lead 4 (chiff)",
    84: "Lead 5 (charang)",
    85: "Lead 6 (voice)",
    86: "Lead 7 (fifths)",
    87: "Lead 8 (bass + lead)",
    
    # Synth Pad Family (88-95)
    88: "Pad 1 (new age)",
    89: "Pad 2 (warm)",
    90: "Pad 3 (polysynth)",
    91: "Pad 4 (choir)",
    92: "Pad 5 (bowed)",
    93: "Pad 6 (metallic)",
    94: "Pad 7 (halo)",
    95: "Pad 8 (sweep)",
    
    # Synth Effects Family (96-103)
    96: "FX 1 (rain)",
    97: "FX 2 (soundtrack)",
    98: "FX 3 (crystal)",
    99: "FX 4 (atmosphere)",
    100: "FX 5 (brightness)",
    101: "FX 6 (goblins)",
    102: "FX 7 (echoes)",
    103: "FX 8 (sci-fi)",
    
    # Ethnic Family (104-111)
    104: "Sitar",
    105: "Banjo",
    106: "Shamisen",
    107: "Koto",
    108: "Kalimba",
    109: "Bag pipe",
    110: "Fiddle",
    111: "Shanai",
    
    # Percussive Family (112-119)
    112: "Tinkle Bell",
    113: "Agogo",
    114: "Steel Drums",
    115: "Woodblock",
    116: "Taiko Drum",
    117: "Melodic Tom",
    118: "Synth Drum",
    119: "Reverse Cymbal",
    
    # Sound Effects Family (120-127)
    120: "Guitar Fret Noise",
    121: "Breath Noise",
    122: "Seashore",
    123: "Bird Tweet",
    124: "Telephone Ring",
    125: "Helicopter",
    126: "Applause",
    127: "Gunshot"
}

# Instrument families
GM_FAMILIES = {
    "piano": range(0, 8),
    "chromatic_percussion": range(8, 16),
    "organ": range(16, 24),
    "guitar": range(24, 32),
    "bass": range(32, 40),
    "strings": range(40, 48),
    "ensemble": range(48, 56),
    "brass": range(56, 64),
    "reed": range(64, 72),
    "pipe": range(72, 80),
    "synth_lead": range(80, 88),
    "synth_pad": range(88, 96),
    "synth_effects": range(96, 104),
    "ethnic": range(104, 112),
    "percussive": range(112, 120),
    "sound_effects": range(120, 128)
}

class SoundfontManager:
    """
    Manages soundfont files and instrument selection.
    """
    
    def __init__(self, soundfont_dir: str = "soundfonts"):
        """
        Initialize the soundfont manager.
        
        Args:
            soundfont_dir: Directory containing soundfont files
        """
        self.soundfont_dir = soundfont_dir
        self.soundfont_files = []
        self.instrument_catalog = {}
        
        # Scan available soundfonts
        self._scan_soundfonts()
    
    def _scan_soundfonts(self):
        """
        Scan the soundfont directory for .sf2 files.
        """
        if not os.path.exists(self.soundfont_dir):
            logger.warning(f"Soundfont directory {self.soundfont_dir} does not exist")
            return
        
        # Walk through directory recursively
        for root, _, files in os.walk(self.soundfont_dir):
            for file in files:
                if file.lower().endswith('.sf2'):
                    file_path = os.path.join(root, file)
                    relative_path = os.path.relpath(file_path, self.soundfont_dir)
                    
                    # Basic metadata
                    sf_info = {
                        "file_path": file_path,
                        "relative_path": relative_path,
                        "name": os.path.splitext(file)[0],
                        "size_bytes": os.path.getsize(file_path),
                        "inferred_type": self._infer_instrument_type(file)
                    }
                    
                    self.soundfont_files.append(sf_info)
                    
                    # Add to catalog by inferred type
                    instrument_type = sf_info["inferred_type"]["type"]
                    if instrument_type not in self.instrument_catalog:
                        self.instrument_catalog[instrument_type] = []
                    
                    self.instrument_catalog[instrument_type].append(sf_info)
        
        logger.info(f"Found {len(self.soundfont_files)} soundfont files")
    
    def _infer_instrument_type(self, filename: str) -> Dict[str, Any]:
        """
        Infer the instrument type from the filename.
        
        Args:
            filename: Soundfont filename
            
        Returns:
            Dictionary with inferred type information
        """
        name_lower = filename.lower()
        
        # Initialize with defaults
        result = {
            "type": "unknown",
            "family": "unknown",
            "gm_program": None
        }
        
        # Try to match with GM instrument names
        for program, instrument_name in GM_INSTRUMENTS.items():
            if instrument_name.lower() in name_lower:
                result["type"] = instrument_name.lower().split()[0]
                result["gm_program"] = program
                
                # Find the family
                for family, range_ids in GM_FAMILIES.items():
                    if program in range_ids:
                        result["family"] = family
                        break
                
                return result
        
        # If no direct match, try keyword matching
        keywords = {
            "piano": ["piano", "grand", "upright"],
            "guitar": ["guitar", "acoustic", "electric"],
            "bass": ["bass", "double bass", "contrabass"],
            "strings": ["violin", "viola", "cello", "string"],
            "brass": ["trumpet", "trombone", "horn", "tuba"],
            "woodwind": ["flute", "sax", "saxophone", "clarinet", "oboe"],
            "percussion": ["drum", "kit", "percussion"],
            "synth": ["synth", "pad", "lead"]
        }
        
        for instrument_type, type_keywords in keywords.items():
            for keyword in type_keywords:
                if keyword in name_lower:
                    result["type"] = instrument_type
                    
                    # Guess a GM program based on type
                    if instrument_type == "piano":
                        result["gm_program"] = 0
                    elif instrument_type == "guitar":
                        result["gm_program"] = 24
                    elif instrument_type == "bass":
                        result["gm_program"] = 32
                    elif instrument_type == "strings":
                        result["gm_program"] = 40
                    elif instrument_type == "brass":
                        result["gm_program"] = 56
                    elif instrument_type == "woodwind":
                        result["gm_program"] = 73
                    elif instrument_type == "percussion":
                        result["gm_program"] = 118
                    elif instrument_type == "synth":
                        result["gm_program"] = 80
                    
                    return result
        
        return result
    
    def get_all_soundfonts(self) -> List[Dict[str, Any]]:
        """
        Get all available soundfont files.
        
        Returns:
            List of soundfont dictionaries
        """
        return self.soundfont_files
    
    def get_available_instrument_types(self) -> List[str]:
        """
        Get a list of available instrument types.
        
        Returns:
            List of instrument type strings
        """
        return list(self.instrument_catalog.keys())
    
    def get_soundfonts_by_type(self, instrument_type: str) -> List[Dict[str, Any]]:
        """
        Get soundfonts of a specific instrument type.
        
        Args:
            instrument_type: Type of instrument to get
            
        Returns:
            List of matching soundfont dictionaries
        """
        return self.instrument_catalog.get(instrument_type, [])
    
    def find_soundfonts(self, query: str) -> List[Dict[str, Any]]:
        """
        Find soundfonts matching a search query.
        
        Args:
            query: Search query
            
        Returns:
            List of matching soundfont dictionaries
        """
        query_lower = query.lower()
        results = []
        
        for sf in self.soundfont_files:
            if (query_lower in sf["name"].lower() or 
                query_lower in sf["inferred_type"]["type"]):
                results.append(sf)
        
        return results
    
    def get_instrument_metadata(self) -> Dict[str, Any]:
        """
        Get metadata about available instruments.
        
        Returns:
            Dictionary with instrument metadata
        """
        return {
            "total_soundfonts": len(self.soundfont_files),
            "instrument_types": list(self.instrument_catalog.keys()),
            "gm_instruments": GM_INSTRUMENTS,
            "gm_families": {k: list(v) for k, v in GM_FAMILIES.items()}
        }

# Create a singleton instance
soundfont_manager = SoundfontManager()

# Export functions for easier access
get_all_soundfonts = soundfont_manager.get_all_soundfonts
get_available_instrument_types = soundfont_manager.get_available_instrument_types
get_soundfonts_by_type = soundfont_manager.get_soundfonts_by_type
find_soundfonts = soundfont_manager.find_soundfonts
get_instrument_metadata = soundfont_manager.get_instrument_metadata