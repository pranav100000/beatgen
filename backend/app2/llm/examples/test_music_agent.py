import asyncio
import json
import os # For API keys
from typing import Dict, Any, Optional, List, Type # Added List, Type

from dotenv import load_dotenv # For loading .env file

# Remove Pydantic AI specific graph node imports as MusicGenerationAgent is no longer a Pydantic AI Agent
# from pydantic_ai import Agent 
# from pydantic_ai.messages import ToolReturnPart 
# from pydantic_graph import End 

from llm.agents.music_agent import (
    MusicGenerationAgent,
    SongRequest,
    SongComposition # We primarily need SongRequest for input and SongComposition for output
    # Intermediate schemas are handled within MusicGenerationAgent
)
# MIDI transform functions and specific Pydantic schemas for intermediate steps
# are no longer directly used by this top-level test script logic if we're only calling run().

# The client-side assembly function is removed as MusicGenerationAgent.run() now handles full assembly.

# Import the new model definitions
from llm.available_models import ALL_MODELS, ModelInfo 

async def main():
    load_dotenv() # Load environment variables from .env
    
    # Remove old test_models list
    # Use ALL_MODELS from available_models.py

    # Remove initial ChatSession instantiation
    # ChatSession is now created inside MusicGenerationAgent.run

    print("Initializing MusicGenerationAgent...")
    # Agent now takes no parameters in constructor
    music_agent = MusicGenerationAgent()

    print("Preparing SongRequest...")
    song_request_obj = SongRequest(
        user_prompt="Create an epic cinematic orchestral piece for a movie trailer, 20 bars long.",
        duration_bars=4
    )

    # Loop through the model templates defined in available_models.py
    for model_template in ALL_MODELS:
        api_key = model_template.get_api_key() # Get key using the method
        if not api_key:
            print(f"Skipping {model_template.display_name} (missing API key: {model_template.api_key_env_var})")
            continue

        # Create the specific ModelInfo instance with the loaded key for this run
        model_info_for_run = ModelInfo(
            provider_name=model_template.provider_name,
            model_name=model_template.model_name,
            api_key=model_template.get_api_key(), # Use the retrieved key
            base_url=model_template.base_url,
            # Not strictly needed for run, but can keep for consistency/logging:
            display_name=model_template.display_name,
            api_key_env_var=model_template.api_key_env_var,
        )

        print(f"\n=== Testing with {model_info_for_run.display_name} ({model_info_for_run.provider_name}:{model_info_for_run.model_name}) ===")
        
        # Remove call to switch_internal_llm
        # music_agent.switch_internal_llm(...) 
        
        final_song_composition: Optional[SongComposition] = None
        try:
            # Pass the model_info_for_run object to the run method
            final_song_composition = await music_agent.run(song_request_obj, model_info=model_info_for_run)
            
            if final_song_composition:
                print("\n--- MusicGenerationAgent Run Completed ---")
                if final_song_composition.title:
                    print(f"Generated song titled: {final_song_composition.title}")
                if final_song_composition.instrument_tracks:
                    print(f"Generated {len(final_song_composition.instrument_tracks)} instrument tracks.")
                else:
                    print("No instrument tracks generated.")
                if final_song_composition.drum_track_data and final_song_composition.drum_track_data.patterns:
                    print(f"Generated {len(final_song_composition.drum_track_data.patterns)} drum patterns.")
                else:
                    print("No drum patterns generated.")
                print("Basic checks passed.")
            else:
                print("\nMusicGenerationAgent run completed but returned no composition.")
        except Exception as e:
            print(f"\n--- MusicGenerationAgent Run Errored ---")
            print(f"Error: {e}")
            import traceback
            traceback.print_exc()
        finally:
            print("\n--- Test Script Finished ---")
            if final_song_composition:
                print("Successfully received a SongComposition object.")
            else:
                print("Did not receive a SongComposition object.")

if __name__ == "__main__":
    asyncio.run(main()) 