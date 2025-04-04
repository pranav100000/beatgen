"""
Test script for the create_melody2 function in music_tools.py
"""
import os
import asyncio
import json
from dotenv import load_dotenv
from services.music_gen_service.music_tools import music_tools_service

# Load environment variables
load_dotenv()

async def test_create_melody2():
    """Test the create_melody2 function with various descriptions."""
    
    # Parameters for testing
    test_cases = [
        {
            "instrument_name": "Piano",
            "description": "A dark, evil sounding melody",
            "mood": "dark",
            "tempo_character": "moderate",
            "rhythm_type": "simple 4/4",
            "musical_style": "hiphop",
            "melodic_character": "flowing"
        }
    ]
    
    # Set key and tempo for testing
    key = "Eb minor"
    tempo = 120
    
    # Initialize soundfonts for testing
    print("Initializing soundfonts for testing...")
    music_tools_service.selected_instruments = {
        "Piano": {
            "storage_key": "test_piano_key",
            "id": "test_piano_id"
        }
    }
    
    # Run tests
    for i, test_case in enumerate(test_cases):
        print(f"\n--- Test Case {i+1}: {test_case['description']} ---")
        try:
            result = await music_tools_service._handle_create_melody2(test_case, tempo, key)
            
            print(result)
            # Print basic info about the melody
            print(f"Created melody with {len(result['instrument']['patterns'][0]['notes'])} notes")
            
            # Output the first few notes
            notes = result['instrument']['patterns'][0]['notes']
            print("\nFirst 5 notes:")
            for j, note in enumerate(notes[:5]):
                print(f"Note {j+1}: Pitch {note['pitch']} (MIDI), Start: {note['start']}, Duration: {note['duration']}")
            
            # Save the result to a JSON file for inspection
            with open(f"melody2_test_{i+1}.json", "w") as f:
                json.dump(result, f, indent=2)
            print(f"\nFull result saved to melody2_test_{i+1}.json")
            
        except Exception as e:
            print(f"Error testing create_melody2: {str(e)}")
            import traceback
            print(traceback.format_exc())
    
    print("\nAll tests completed.")

if __name__ == "__main__":
    asyncio.run(test_create_melody2())