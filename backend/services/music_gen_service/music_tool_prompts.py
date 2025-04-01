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
                    "items": {
                        "type": "string"
                    }
                }
            },
            "required": ["soundfont_names"]
        }
    }