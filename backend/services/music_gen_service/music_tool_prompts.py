import random


def get_select_instruments_prompt(available_instruments: list[str]) -> dict:
    instrument_list_string = ", ".join(available_instruments)
    return {
        "name": "select_instruments",
        "description": f"Select soundfonts to use in the composition. Must be called before creating musical parts. You must select instruments out of the available instruments. These are the available instruments: {instrument_list_string}",
        "input_schema": {
            "type": "object",
            "properties": {
                "soundfont_names": {
                    "type": "array",
                    "description": f"List of soundfont names to use in the composition. You must select instruments out of the available instruments. These are the available instruments: {instrument_list_string}",
                    "items": {"type": "string"},
                }
            },
            "required": ["soundfont_names"],
        },
    }


def get_create_melody_prompt(available_instruments: list[str]) -> dict:
    instrument_list_string = ", ".join(available_instruments)
    if available_instruments:
        ", ".join(random.sample(available_instruments, len(available_instruments) // 2))
    else:
        pass
    return {
        "name": "create_melody",
        "description": f"Uses an AI agent to create a melodic pattern for a specified instrument. The instrument name you select must be one of the available instruments: {instrument_list_string}",
        "input_schema": {
            "type": "object",
            "properties": {
                "instrument_name": {
                    "type": "string",
                    "description": "Name of the instrument (e.g., 'Piano', 'Violin')",
                },
                "description": {
                    "type": "string",
                    "description": "Description of the melody character (e.g., 'cheerful', 'melancholic')",
                },
                # "duration_beats": {
                #     "type": "integer",
                #     "description": "Length of the melody in beats"
                # },
                # "note_names": {
                #     "type": "array",
                #     "description": f"REQUIRED: Array of note names like f{random_available_notes_string}. The notes you select must be from the available notes: {available_notes_string}",
                #     "items": {
                #         "type": "string"
                #     }
                # },
                # "note_durations": {
                #     "type": "array",
                #     "description": "REQUIRED: Array of note durations like ['quarter', 'eighth', 'half', etc.] or numeric values in beats",
                #     "items": {
                #         "type": "string"
                #     }
                # },
                # "note_velocities": {
                #     "type": "array",
                #     "description": "Optional: Array of note velocities (1-127, with 64-100 being typical). Default is 80 if not provided.",
                #     "items": {
                #         "type": "integer"
                #     }
                # }
            },
            "required": ["instrument_name", "description"],
        },
    }
