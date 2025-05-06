DETERMINE_MUSICAL_PARAMETERS_TOOL = {
    "name": "determine_musical_parameters",
    "description": """
        This tool will set the musical parameters for the composition. Every other tool will use these parameters.
        Based on the research you were provided, determine appropriate musical parameters: (MOST IMPORTANT) chord progression (e.g. C-G-Am-F),  key (e.g. C, Db, G#), tempo (in BPM), and mode (e.g. major, minor, harmonic minor, etc.) for a given music description.
        Most important is the chord progression. The key and mode should be based on the chord progression. The tempo should be based on the chord progression and the description.
        IMPORTANT: if the description provided (not the research) provides a tempo, key, mode, or chord progression
        """,
    "input_schema": {
        "type": "object",
        "properties": {
            "chord_progression": {
                "type": "string",
                "description": "The chord progression (e.g. C-G-Am-F, Aaug7-Dm7-G7-Cmaj7) IMPORTANT: Make sure you provide the chord progression with actual notes, not just numbers.",
            },
            "key": {
                "type": "string",
                "description": "The key of the chord progression (e.g. C, Db, G#)",
            },
            "mode": {
                "type": "string",
                "description": "The mode of the chord progression, MUST be either major or minor. DO NOT use any other mode.",
            },
            "tempo": {
                "type": "integer",
                "description": "The tempo in BPM (e.g. 120, 140, 160)",
            },
            "melody_instrument": {
                "type": "string",
                "description": "The instrument that will play the melody (e.g. 'Piano', 'Violin') IMPORTANT: The instrument you select must be out of the list of available instruments.",
            },
            "chords_instrument": {
                "type": "string",
                "description": "The instrument that will play the chords (e.g. 'Piano', 'Violin') IMPORTANT: The instrument you select must be out of the list of available instruments.    ",
            },
        },
        "required": [
            "chord_progression",
            "key",
            "mode",
            "tempo",
            "melody_instrument",
            "chords_instrument",
        ],
    },
}

CREATE_CHORDS_TOOL = {
    "name": "create_chords",
    "description": "Creates a chord progression based on the description. Uses AI to generate a chord progression that's appropriate for the key.",
    "input_schema": {
        "type": "object",
    },
}

CREATE_MELODY_TOOL = {
    "name": "create_melody",
    "description": "Creates a melodic pattern based on description with the instrument. Uses AI to generate interval-based melody that's appropriate for the key.",
    "input_schema": {
        "type": "object",
        "properties": {
            "instrument_name": {
                "type": "string",
                "description": "Name of the instrument (e.g., 'Piano', 'Violin')",
            },
            "description": {
                "type": "string",
                "description": "Detailed description of the melody's character (e.g., 'uplifting and energetic', 'melancholic with moments of hope')",
            },
            "mood": {
                "type": "string",
                "description": "Emotional quality of the melody (e.g., 'joyful', 'melancholic', 'suspenseful', 'serene')",
            },
            "rhythm_type": {
                "type": "string",
                "description": "Type of rhythm (e.g., 'simple 4/4', 'swing', 'waltz 3/4', 'march', 'syncopated')",
            },
            "musical_style": {
                "type": "string",
                "description": "Musical style or genre (e.g., 'classical', 'jazz', 'folk', 'pop')",
            },
            "melodic_character": {
                "type": "string",
                "description": "Character of the melody (e.g., 'flowing', 'staccato', 'legato', 'jumpy', 'smooth')",
            },
        },
        "required": [
            "instrument_name",
            "description",
            "mood",
            "rhythm_type",
            "musical_style",
            "melodic_character",
        ],
    },
}

SELECT_INSTRUMENTS_TOOL = {
    "name": "select_instruments",
    "description": "Selects the instruments that fit the beat we are trying to make. These instruments will be used to create melody, chords, and countermelody. Select the instruments that most accurately fit the description. IMPORTANT: The instruments you select must be out of the list of available instruments.",
    "input_schema": {
        "type": "object",
        "properties": {
            "instrument_selections": {
                "type": "array",
                "description": "List of instrument selections with their roles and explanations",
                "items": {
                    "type": "object",
                    "properties": {
                        "instrument_name": {
                            "type": "string",
                            "description": "The name of the instrument (must be from the list of available instruments)",
                        },
                        "role": {
                            "type": "string",
                            "description": "The role this instrument will play (e.g., 'melody', 'chords', 'countermelody')",
                            "enum": ["melody", "chords", "countermelody"],
                        },
                        "explanation": {
                            "type": "string",
                            "description": "Explanation of why this instrument was selected for this role",
                        },
                    },
                    "required": ["instrument_name", "role", "explanation"],
                },
            }
        },
        "required": ["instrument_selections"],
    },
}

SELECT_DRUM_SOUNDS_TOOL = {
    "name": "select_drum_sounds",
    "description": "Selects the drum sounds that fit the beat we are trying to make. These drum sounds will be used to create the beat. Select the drum sounds that most accurately fit the description. You should select 4-5 drum sounds. IMPORTANT: The drum sounds you select must be out of the list of available drum sounds.",
    "input_schema": {
        "type": "object",
        "properties": {
            "drum_sounds": {
                "type": "array",
                "description": "List of drum sounds (e.g., ['Metro Kick Drum', 'Snare Drum'])",
            }
        },
        "required": ["drum_sounds"],
    },
}

CREATE_DRUM_BEAT_TOOL = {
    "name": "create_drum_beat",
    "description": "Creates drum beat patterns for selected drum sounds. Each pattern should be a list of 32 booleans representing 16th notes over 2 bars (4/4 time).",
    "input_schema": {
        "type": "object",
        "properties": {
            "drum_beats": {
                "type": "array",
                "description": "A list of drum beat patterns, one for each selected drum sound.",
                "items": {
                    "type": "object",
                    "properties": {
                        "drum_sound_id": {
                            "type": "string",
                            "description": "The ID of the drum sound this pattern is for.",
                        },
                        "pattern": {
                            "type": "array",
                            "description": "A list of 32 booleans. True means the drum hits on that 16th note, False means silence. This covers 2 bars.",
                            "items": {"type": "boolean"},
                            "minItems": 32,
                            "maxItems": 32,
                        },
                    },
                    "required": ["drum_sound_id", "pattern"],
                },
            }
        },
        "required": ["drum_beats"],
    },
}
