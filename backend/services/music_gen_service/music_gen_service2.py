# import asyncio
# from dataclasses import dataclass, field
# import json
# import os
# import traceback
# from typing import Any, Dict, List, Optional
# import uuid
# from dotenv import load_dotenv
# from pydantic import ValidationError
# from app2.sse.sse_queue_manager import SSEQueueManager
# from app2.core.logging import get_api_logger
# from app2.types.assistant_actions import AssistantAction
# from app2.api.dependencies import (
#     get_drum_sample_service,
#     get_drum_sample_public_repository,
# )
# from app2.models.track_models.midi_track import MidiTrackRead
# from app2.models.public_models.instrument_file import InstrumentFileRead
# from app2.models.track_models.sampler_track import SamplerTrackRead
# from app2.models.track_models.drum_track import DrumTrackRead
# from app2.models.public_models.drum_samples import DrumSamplePublicRead
# from clients.instructor_client import get_instructor_client, InstructorAnthropicClient
# from services.music_gen_service.llm_schemas import (
#     DetermineMusicalParameters, 
#     SelectInstruments, 
#     SelectDrumSounds, 
#     CreateDrumBeat, 
#     MelodyData,
# )
# from services.music_gen_service.chord_progression_analysis import (
#     analyze_chord_progression,
# )
# from services.soundfont_service.soundfont_service import soundfont_service
# from services.music_gen_service.midi2 import (
#     transform_bars_to_instrument_format,
#     transform_chord_progression_to_instrument_format,
#     transform_drum_beats_to_midi_format,
# )
# from services.music_gen_service.music_utils import get_mode_intervals
# from services.music_gen_service.prompt_utils import (
#     get_ai_composer_agent_initial_system_prompt,
#     get_melody_create_prompt,
# )
# from services.music_gen_service.music_researcher import MusicResearcher
# import re
# from sqlmodel import Session
# from app2.core.config import settings

# load_dotenv()
# logger = get_api_logger("music_gen_service")


# @dataclass
# class Instrument:
#     id: str
#     name: str
#     description: str
#     soundfont_name: str
#     storage_key: str
#     role: str = ""  # For tracking the instrument's role in the composition (melody, chords, etc.)

#     def to_dict(self) -> Dict[str, Any]:
#         """Convert instrument to a dictionary for serialization"""
#         return {
#             "id": self.id,
#             "name": self.name,
#             "description": self.description,
#             "soundfont_name": self.soundfont_name,
#             "storage_key": self.storage_key,
#             "role": self.role,
#         }


# @dataclass
# class MusicalParams:
#     key: str = ""
#     mode: str = ""
#     chord_progression: str = ""
#     bpm: int = 0
#     allowed_intervals: List[int] = field(default_factory=list)
#     duration_beats: int = 16
#     duration_bars: int = 4
#     time_signature: List[int] = field(default_factory=lambda: [4, 4])
#     melody: Optional[Any] = None
#     counter_melody: Optional[Any] = None
#     chords: Optional[Any] = None
#     melody_instrument_suggestion: Optional[str] = None
#     chords_instrument_suggestion: Optional[str] = None
#     melody_instrument: Optional[Instrument] = None
#     chords_instrument: Optional[Instrument] = None
#     drum_sounds: Optional[List[DrumSamplePublicRead]] = None


# class MusicGenService2:
#     def __init__(self):
#         self.researcher = MusicResearcher()
#         self.llm_client: InstructorAnthropicClient = get_instructor_client()
#         self.musical_params = MusicalParams()
#         self.available_soundfonts: List[Dict[str, Any]] = []
#         self.selected_instruments: List[Instrument] = []
#         self.drum_sounds: List[DrumSamplePublicRead] = []
#         self.selected_drum_samples: List[DrumSamplePublicRead] = []

#     async def compose_music(
#         self, prompt: str, queue: SSEQueueManager, session: Session
#     ) -> Dict[str, Any]:
#         _drum_file_repository = get_drum_sample_public_repository(session)
#         drum_sample_service = get_drum_sample_service(_drum_file_repository)

#         await queue.stage(
#             "Researching...",
#             "Researching musical style and parameters...",
#         )
        
#         (
#             research_result,
#             chord_research_result,
#             self.available_soundfonts,
#             self.drum_sounds,
#         ) = await asyncio.gather(
#             self.researcher.enhance_description(prompt),
#             self.researcher.research_chord_progression(prompt),
#             soundfont_service.get_public_soundfonts(),
#             drum_sample_service.get_all_samples(),
#         )

#         await queue.stage(
#             "Determining Parameters...",
#             "Asking AI to determine key, tempo, chords...",
#         )
#         await self._determine_musical_parameters(
#             prompt, research_result, chord_research_result, queue
#         )
#         if not self.musical_params.key:
#              await queue.error("Failed to determine musical parameters.")
#              return {"error": "Failed to determine musical parameters."}


#         await queue.stage(
#             "Selecting Instruments...",
#             "Asking AI to select appropriate instruments...",
#         )
#         await self._select_instruments_via_llm(queue)
#         if not self.selected_instruments:
#              await queue.error("Failed to select instruments.")
#              return {"error": "Failed to select instruments."}


#         await self._generate_chords(queue)


#         await self._generate_melody(prompt, queue)

        
#         await queue.stage(
#             "Selecting Drums...",
#             "Asking AI to select appropriate drum sounds...",
#         )
#         drum_research_result = await self.researcher.research_drum_sounds(prompt)
#         logger.info(f"Drum research result: {drum_research_result}")
#         await self._select_drum_sounds(drum_research_result, queue)
#         if not self.selected_drum_samples:
#              logger.warning("No drum sounds were selected.")


#         await self._generate_drum_beat(queue) 

#         final_instruments = []
#         if self.musical_params.melody:
#             final_instruments.append(self.musical_params.melody) 
#         if self.musical_params.chords:
#             final_instruments.append(self.musical_params.chords)

#         return {
#             "tempo": self.musical_params.bpm,
#             "key": self.musical_params.key,
#             "mode": self.musical_params.mode,
#             "time_signature": self.musical_params.time_signature,
#             "instruments": final_instruments,
#             "chord_progression": self.musical_params.chord_progression,
#         }

#     async def _determine_musical_parameters(
#         self,
#         prompt: str,
#         research_result: str,
#         chord_research_result: str,
#         queue: SSEQueueManager,
#     ):
#         """Determines key, mode, BPM, chord progression, and suggests instrument types using LLM."""
#         logger.debug("Determining musical parameters using instructor (conditional streaming)...")
        
#         # System prompt for instructor (TOOL mode might inject hints)
#         system_prompt = get_ai_composer_agent_initial_system_prompt() + """\nYou are tasked with determining the core musical parameters for a piece based on a user description and research.
# Provide your reasoning for each choice (key, mode, tempo, chord progression, suggested melody/chord instrument types) in your text response.
# Then, provide the determined parameters accurately using the required structured format (`DetermineMusicalParameters`).
# """
#         self.llm_client.set_system_prompt(system_prompt)

#         message = f"""Based on the user's description: '{prompt}'

# And the following research:
# General Research: {research_result}
# Chord Research: {chord_research_result}

# Please determine the most suitable musical parameters. 

# Explain your reasoning first for:
# 1. Key and Mode (e.g., C major, A minor)
# 2. Tempo (BPM)
# 3. Chord Progression (using standard notation like C-G-Am-F or ii-V-I)
# 4. Suggested Melody Instrument Type (general category like 'Piano', 'Synth Lead', 'Flute')
# 5. Suggested Chords Instrument Type (general category like 'Strings', 'Pad', 'Guitar')

# After explaining your reasoning in text, provide the final parameters using the required structured format (`DetermineMusicalParameters`). Ensure the mode is strictly 'major' or 'minor'.
# """
        
#         try:
#             # Call the client, passing response_model. Client handles streaming conditionally.
#             text_response, params_model = await self.llm_client.send_message_async(
#                 message, 
#                 queue,
#                 response_model=DetermineMusicalParameters, # Pass the model again
#                 max_retries=2
#             )

#             # The text_response should contain the reasoning part.
#             # The params_model should be the validated Pydantic object if successful.

#             if not params_model:
#                 # This case should ideally be caught by exceptions below, 
#                 # but check just in case the client returns (text, None) without error.
#                 logger.error("Failed to get structured musical parameters from LLM (model is None).")
#                 raise ValueError("LLM did not return the expected musical parameters structure.")

#             # Log the reasoning part if needed (already sent to queue)
#             logger.info(f"LLM Reasoning (text received): {text_response[:200]}...") 
#             logger.info(f"Determined Musical Params (structured): {params_model}")

#             # Validate common issues (optional but good practice)
#             if params_model.mode.lower() not in ['major', 'minor']:
#                  logger.warning(f"LLM returned invalid mode '{params_model.mode}'. Defaulting to major/minor based on key/progression if possible, or major.")
#                  if 'm' in params_model.key or 'min' in params_model.chord_progression:
#                      params_model.mode = 'minor'
#                  else:
#                      params_model.mode = 'major'

#             # Update the internal state using the validated model
#             self._set_musical_params(
#                 key=params_model.key,
#                 mode=params_model.mode,
#                 chord_progression=params_model.chord_progression,
#                 bpm=params_model.tempo,
#                 melody_instrument_suggestion=params_model.melody_instrument_suggestion,
#                 chords_instrument_suggestion=params_model.chords_instrument_suggestion,
#             )
            
#             await queue.action(AssistantAction.change_bpm(value=self.musical_params.bpm))
#             # await queue.action(AssistantAction.change_key( 
#             #     value=self.musical_params.key
#             # ))

#         except ValidationError as e:
#              # This might now be raised directly by the client call if validation fails
#              logger.error(f"LLM response failed Pydantic validation for DetermineMusicalParameters: {e}", exc_info=True)
#              await queue.error("Failed to understand the musical parameters suggested by the AI.")
#              self.musical_params = MusicalParams() # Reset
#         except Exception as e:
#             # Catch other potential errors from the API call or processing
#             logger.error(f"Error determining musical parameters: {e}", exc_info=True)
#             await queue.error("An unexpected error occurred while determining musical parameters.")
#             self.musical_params = MusicalParams() # Reset

#     async def _select_drum_sounds(
#         self, drum_research_result: str, queue: SSEQueueManager
#     ):
#         """Selects specific drum sounds using an LLM based on available sounds and research."""
#         logger.debug("Selecting drum sounds using instructor...")
        
#         # Use self.drum_sounds (all available) and store selections in self.selected_drum_samples
#         if not self.drum_sounds or not isinstance(self.drum_sounds[0], DrumSamplePublicRead):
#             logger.error(
#                 "Cannot select drum sounds: Available drum sounds list is empty or contains invalid data."
#             )
#             await queue.error("No drum sounds available to select from.")
#             self.selected_drum_samples = [] # Ensure it's empty
#             return

#         # Prepare data for the prompt
#         drum_sample_details = [
#             {"id": str(ds.id), "name": ds.display_name} 
#             for ds in self.drum_sounds
#         ]
#         drum_sample_names = [ds["name"] for ds in drum_sample_details]
#         drum_sound_map = {ds.display_name: ds for ds in self.drum_sounds}

#         # System prompt (can be general or specific)
#         # self.llm_client.set_system_prompt("You are an expert drum sound selector...")

#         message = f"""We need to select specific drum sounds for the composition based on the desired style and provided research.

# Musical Context:
# Key: {self.musical_params.key} {self.musical_params.mode}
# Tempo: {self.musical_params.bpm} BPM
# Overall Style based on original prompt and instrument selections.

# Research on Drum Sounds: {drum_research_result}

# Available Drum Sounds (select ONLY from this list):
# {json.dumps(drum_sample_names, indent=2)}

# Please select the most appropriate drum sounds (typically 4-6 sounds like kick, snare, hi-hat (closed/open), crash, percussion) that fit the context.

# First, provide a brief text explanation for your choices, describing why each selected sound contributes to the desired feel.

# Then, provide the final list of selected drum sound names using the required structured format (`SelectDrumSounds`). Ensure the names exactly match the ones in the provided list.
# """

#         try:
#             text_response, drum_sounds_model = await self.llm_client.send_message_async(
#                 message,
#                 queue,
#                 response_model=SelectDrumSounds,
#                 max_retries=2
#             )

#             if not drum_sounds_model or not drum_sounds_model.drum_sounds:
#                 logger.warning("LLM did not return any selected drum sounds in the structured response.")
#                 # Decide on behavior: fallback, error, or continue without drums?
#                 # For now, let's log and continue without drums.
#                 await queue.add_log("AI did not select any specific drum sounds.") # Inform user via log
#                 self.selected_drum_samples = []
#                 return 

#             logger.info(f"LLM Reasoning (text): {text_response[:200]}...")
#             logger.info(f"Selected Drum Sounds (structured): {drum_sounds_model}")

#             # Process the validated list of names
#             selected_names = drum_sounds_model.drum_sounds
#             processed_drums = []
#             for name in selected_names:
#                 if name in drum_sound_map:
#                     processed_drums.append(drum_sound_map[name])
#                     logger.info(f"Selected drum sound: {name}")
#                 else:
#                     logger.warning(
#                         f"LLM selected drum sound '{name}' which is not in the available list. Skipping."
#                     )
            
#             self.selected_drum_samples = processed_drums
#             logger.info(
#                 f"Final selected drums ({len(self.selected_drum_samples)}): {[ds.display_name for ds in self.selected_drum_samples]}"
#             )
            
#             # Optional: Add SSE log action about selected drums
#             if self.selected_drum_samples:
#                  await queue.add_chunk(f"Selected drum sounds: {', '.join([ds.display_name for ds in self.selected_drum_samples])}")

#         except ValidationError as e:
#              logger.error(f"LLM response failed Pydantic validation for SelectDrumSounds: {e}", exc_info=True)
#              await queue.error("Failed to understand the drum sounds suggested by the AI.")
#              self.selected_drum_samples = [] # Reset on validation error
#         except Exception as e:
#             logger.error(f"Error selecting drum sounds: {e}", exc_info=True)
#             await queue.error("An unexpected error occurred while selecting drum sounds.")
#             self.selected_drum_samples = [] # Reset on other errors


#     async def _generate_drum_beat(self, queue: SSEQueueManager):
#         """Generates the drum beat MIDI data."""
#         logger.debug("Generating drum beat...")
        
#         # Use the processed list of selected samples
#         selected_drums = self.selected_drum_samples 
#         if not selected_drums:
#             logger.warning("No drum sounds selected, skipping drum beat generation.")
#             # Don't send stage update if skipping
#             return 

#         await queue.stage(
#             "Generating Drum Beat...",
#             "Asking the AI composer to create drum patterns...",
#         )

#         # Prepare info for the prompt
#         drum_info = [
#             {"id": str(ds.id), "name": ds.display_name} for ds in selected_drums
#         ]
#         drum_names = [ds["name"] for ds in drum_info]

#         message = f"""We need to create drum patterns for the composition.
# Key: {self.musical_params.key} {self.musical_params.mode}
# Tempo: {self.musical_params.bpm} BPM
# Style based on original prompt and chosen instruments/sounds.

# Selected Drum Sounds (use these exact IDs in your response):
# {json.dumps(drum_info, indent=2)}

# For EACH of the drum sounds listed above, create a rhythmic pattern.
# Each pattern MUST be a JSON array of exactly 32 boolean values (true/false), representing 16th notes over 2 bars (in 4/4 time). 'true' means the drum hits, 'false' means silence.

# Describe the overall feel of the drum beat you are creating and explain the role of each drum sound's pattern (e.g., kick provides the main pulse, snare hits on 2 and 4, hi-hat provides 16th note rhythm).

# After your explanation, use the required structured format (`CreateDrumBeat`) to provide the patterns, ensuring each item has the correct `drum_sound_id` and a 32-boolean `pattern` list.
# """

#         try:
#             # Single call using response_model
#             text_response, drum_beat_model = await self.llm_client.send_message_async(
#                 message, 
#                 queue, 
#                 response_model=CreateDrumBeat,
#                 max_retries=2
#             )

#             if not drum_beat_model or not drum_beat_model.drum_beats:
#                 logger.error(
#                     "Failed to get valid drum beat patterns from LLM tool use."
#                 )
#                 raise ValueError(
#                     "LLM response did not contain valid JSON for drum beats using the tool."
#                 )

#             drum_patterns = drum_beat_model.drum_beats # Access the list directly from the model
#             logger.info(f"LLM Reasoning (text): {text_response[:200]}...")
#             logger.info(f"Received {len(drum_patterns)} structured drum patterns from LLM.")

#             # Create a map of string IDs to drum samples for easier lookup
#             drum_sound_map = {str(ds.id): ds for ds in selected_drums}

#             # logger.info(f"Drum patterns: {drum_patterns}") # Model object, maybe log model_dump()
#             logger.debug(f"Drum sound map keys: {list(drum_sound_map.keys())}")
            
#             drum_track_id = uuid.uuid4()
#             drum_track = DrumTrackRead(
#                 id=drum_track_id,
#                 name="Drum Track", # More descriptive name
#             )
            
#             # Process patterns from the Pydantic model
#             for beat_data in drum_patterns:
#                 drum_sound_id = beat_data.drum_sound_id # Access via attribute
#                 pattern = beat_data.pattern * 2 # Still duplicate for 4 bars?

#                 # logger.info(f"Processing pattern for Drum sound ID: {drum_sound_id}")
#                 # logger.debug(f"Pattern (x2): {pattern}")

#                 # Basic validation (already done by Pydantic, but double check length after duplication)
#                 if len(pattern) != 64:
#                      logger.warning(f"Pattern length for {drum_sound_id} is not 64 after duplication. Skipping.")
#                      continue
                
#                 # Transform to MIDI notes
#                 try:
#                     notes = transform_drum_beats_to_midi_format(pattern)
#                     # logger.debug(f"Transformed notes: {notes}")
#                 except Exception as transform_err:
#                     logger.error(f"Failed to transform pattern for {drum_sound_id}: {transform_err}", exc_info=True)
#                     continue # Skip this pattern

#                 if drum_sound_id in drum_sound_map:
#                     drum_sample = drum_sound_map[drum_sound_id]
#                     logger.info(
#                         f"Adding sampler track for {drum_sample.display_name} (ID: {drum_sound_id})"
#                     )
#                     sampler_track_id = uuid.uuid4()
#                     try:
#                         sampler_track = SamplerTrackRead(
#                             id=sampler_track_id,
#                             name=drum_sample.display_name,
#                             audio_file_name=drum_sample.file_name,
#                             base_midi_note=settings.audio.DEFAULT_SAMPLER_BASE_NOTE,
#                             grain_size=settings.audio.DEFAULT_SAMPLER_GRAIN_SIZE,
#                             overlap=settings.audio.DEFAULT_SAMPLER_OVERLAP,
#                             audio_file_sample_rate=settings.audio.SAMPLE_RATE,
#                             audio_storage_key=drum_sample.storage_key,
#                             audio_file_format=drum_sample.file_format,
#                             audio_file_size=drum_sample.file_size,
#                             audio_file_duration=drum_sample.duration or 0,
#                             drum_track_id=drum_track_id,
#                             midi_notes_json=notes, # Use transformed notes
#                         )
#                         drum_track.sampler_tracks.append(sampler_track)
#                         drum_track.sampler_track_ids.append(sampler_track_id)
#                     except Exception as sampler_create_err:
#                          logger.error(f"Failed to create SamplerTrackRead for {drum_sample.display_name}: {sampler_create_err}", exc_info=True)
#                          # Continue to next pattern if one fails
#                 else:
#                     logger.warning(
#                         f"Drum sound ID '{drum_sound_id}' from LLM response not found in selected drums. Skipping pattern."
#                     )

#             # Only add drum track if it has any valid sampler tracks
#             if drum_track.sampler_tracks:
#                  logger.info(f"Successfully processed and adding DrumTrackRead via SSE: {drum_track.id} with {len(drum_track.sampler_tracks)} sampler tracks")
#                  await queue.action(AssistantAction.add_drum_track(track=drum_track))
#             else:
#                  logger.warning("No valid sampler tracks generated for the drum beat.")
#                  await queue.add_log("Could not generate any valid drum patterns.")

#         except ValidationError as e:
#              logger.error(f"LLM response failed Pydantic validation for CreateDrumBeat: {e}", exc_info=True)
#              await queue.error("Failed to understand the drum patterns suggested by the AI.")
#         except Exception as e:
#             logger.error(f"Error during drum beat generation: {str(e)}")
#             logger.error(f"Stack trace: {traceback.format_exc()}")
#             await queue.error("Failed to generate drum beat.")


#     async def _generate_melody(self, prompt: str, queue: SSEQueueManager):
#         """Generates the melody notes structure using an LLM and response_model."""
#         logger.debug("Generating melody using instructor...")

#         melody_instrument = self.musical_params.melody_instrument
#         if not melody_instrument:
#             logger.error("Cannot generate melody: No melody instrument assigned.")
#             await queue.error("Cannot generate melody because no instrument was selected.")
#             return

#         await queue.stage(
#             "Generating Melody...",
#             f"Asking AI to generate melody notes for {melody_instrument.name}..."
#         )

#         # Prepare context for the prompt
#         key = self.musical_params.key
#         mode = self.musical_params.mode
#         tempo = self.musical_params.bpm
#         chord_progression = self.musical_params.chord_progression
#         duration_bars = self.musical_params.duration_bars # Use value from params
#         duration_beats = self.musical_params.duration_beats

#         # --- Simplified System Prompt for Melody Generation --- 
#         # Focuses on constraints and output format, less on conversational tone
#         # get_melody_create_prompt might be too complex now
#         system_prompt = f"""You are an AI music composer specializing in creating melodies.
# Your task is to generate musical notes for a melody based on the provided context.

# Constraints:
# - Adhere strictly to the key of {key} {mode}.
# - The melody should rhythmically and harmonically follow the chord progression: {chord_progression}.
# - The melody should be suitable for the instrument: {melody_instrument.name}.
# - The melody should have a total duration of approximately {duration_bars} bars ({duration_beats} beats).
# - Ensure the rhythm is engaging and appropriate for the style implied by the description and context.
# - The rhythm should ideally be repetitive or loopable, suitable for electronic music or beat generation.
# - Output ONLY the valid JSON object matching the requested `MelodyData` structure. Do NOT include any other text, explanations, or markdown formatting.
# """
#         self.llm_client.set_system_prompt(system_prompt)
#         # self.llm_client.clear_messages() # Consider if message history is helpful here

#         # --- Chord Analysis (Optional but helpful for LLM) --- 
#         try:
#             chord_progression_list = re.split(r"[\s,-]+", chord_progression)
#             chord_progression_list = [chord.strip().replace("b", "-") for chord in chord_progression_list if chord.strip()]
#             note_probabilities = analyze_chord_progression(chord_progression_list, key)
#             note_probabilities_string = json.dumps(note_probabilities, indent=2)
#             logger.debug(f"Note probabilities calculated for chords: {chord_progression_list}")
#             probability_guidance = f"Use this note probability data derived from the chord progression '{chord_progression}' in {key} {mode} to guide note selection:\n{note_probabilities_string}"
#         except Exception as analysis_err:
#             logger.error(f"Failed to analyze chord progression for note probabilities: {analysis_err}", exc_info=True)
#             probability_guidance = "Note probability analysis failed, rely on key and chord progression directly."
#         # --- End Chord Analysis --- 

#         message = f"""Generate the musical notes for a melody based on the following:
# Original User Prompt: '{prompt}'
# Instrument: {melody_instrument.name}
# Key: {key} {mode}
# Tempo: {tempo} BPM
# Chord Progression: {chord_progression}
# Duration: {duration_bars} bars ({duration_beats} beats)

# {probability_guidance}

# Generate the melody notes and output them *only* as a valid JSON object conforming to the `MelodyData` schema (containing `bars`, each with `bar` number and a list of `notes`, where each `note` has `pitch`, `start_beat`, `duration_beats`).
# """

#         try:
#             # Request MelodyData directly using response_model
#             text_response, melody_data_model = await self.llm_client.send_message_async(
#                 message,
#                 queue,
#                 response_model=MelodyData, # Request the Pydantic model directly
#                 max_retries=2
#             )

#             # Log the raw text response (might contain reasoning if LLM didn't follow instructions)
#             if text_response:
#                  logger.info(f"LLM Text Response (Melody Gen): {text_response[:200]}...")
            
#             if not melody_data_model:
#                 logger.error("Failed to get structured melody data (MelodyData) from LLM.")
#                 # Attempt fallback or raise error? For now, log error and stop.
#                 await queue.error("Failed to generate melody notes from the AI.")
#                 return

#             logger.info(f"Successfully received structured MelodyData from LLM.")
#             # logger.debug(f"Melody Data: {melody_data_model.model_dump_json(indent=2)}")

#             # Process the received MelodyData model
#             await self._process_and_add_melody(melody_data_model, melody_instrument, queue)

#         except ValidationError as e:
#              logger.error(f"LLM response failed Pydantic validation for MelodyData: {e}", exc_info=True)
#              await queue.error("Failed to understand the melody notes suggested by the AI.")
#         except Exception as e:
#             logger.error(f"Error generating melody: {str(e)}", exc_info=True)
#             await queue.error(f"An unexpected error occurred while generating the melody: {e}")
#             self.musical_params.melody = None # Ensure reset on error


#     async def _process_and_add_melody(
#         self,
#         melody_data: MelodyData, 
#         melody_instrument: Instrument, 
#         queue: SSEQueueManager
#     ) -> None:
#         """
#         Processes the structured MelodyData, transforms it, and adds the MIDI track via SSE.
#         """
#         logger.info(f"Processing structured melody data for {melody_instrument.name}...")
#         key = self.musical_params.key # Needed for transformation?

#         try:
#             result = transform_bars_to_instrument_format(
#                 melody_data, # Pass the Pydantic model 
#                 key
#             )

#             if not result or "notes" not in result or not result["notes"]:
#                 logger.error("Melody transformation returned empty or invalid result.")
#                 await queue.error(f"Failed to process generated melody notes for {melody_instrument.name}.")
#                 return

#             # Create models for SSE action
#             track_id = uuid.uuid4()
#             instrument_file_model = InstrumentFileRead(
#                 id=melody_instrument.id,
#                 file_name=melody_instrument.soundfont_name,
#                 display_name=melody_instrument.name,
#                 storage_key=melody_instrument.storage_key,
#                 file_format="sf2", # TODO: Fix this later
#                 file_size=0, # TODO: Fix this later
#                 category="melody",
#                 is_public=True, # Assuming public
#                 description=melody_instrument.description, # Use selected instrument description
#             )
#             midi_track_model = MidiTrackRead(
#                 id=track_id,
#                 name=melody_instrument.name,
#                 instrument_id=melody_instrument.id,
#                 midi_notes_json=result,  # Assign the whole result dictionary
#                 instrument_file=instrument_file_model
#             )
            
#             # Add track via SSE
#             await queue.action(
#                  AssistantAction.add_midi_track(track=midi_track_model)
#             )

#             logger.info(f"Generated and added melody track '{melody_instrument.name}' via SSE with {len(result.get('notes', []))} notes.")
            
#             # Optionally store the processed result if needed elsewhere in the service
#             # self.musical_params.melody = result 

#         except Exception as e:
#             logger.error(f"Error during melody processing/transformation: {str(e)}")
#             logger.error(f"Stack trace: {traceback.format_exc()}")
#             await queue.error(f"Failed to process generated melody for {melody_instrument.name}: {e}")


#     async def _generate_chords(self, queue: SSEQueueManager):
#         """Generates the chord MIDI data using an LLM."""
#         logger.debug("Generating chords using instructor...")

#         await queue.stage(
#             "Generating Chords...",
#             "Asking AI to generate chord progression...",
#         )

#         # Prepare context for the prompt
#         key = self.musical_params.key
#         mode = self.musical_params.mode
#         chord_progression = self.musical_params.chord_progression

#         # --- Simplified System Prompt for Chord Generation --- 
#         # Focuses on constraints and output format, less on conversational tone
#         # get_melody_create_prompt might be too complex now
#         system_prompt = f"""You are an AI music composer specializing in creating chords.
# Your task is to generate a chord progression based on the provided context.

# Constraints:
# - Adhere strictly to the key of {key} {mode}.
# - The chord progression should be suitable for the style implied by the description and context.
# - The chord progression should be suitable for the instrument: {self.musical_params.chords_instrument.name}.
# - The chord progression should have a total duration of approximately {self.musical_params.duration_bars} bars ({self.musical_params.duration_beats} beats).
# - Ensure the chord progression is engaging and appropriate for the style implied by the description and context.
# - The chord progression should ideally be repetitive or loopable, suitable for electronic music or beat generation.
# - Output ONLY the valid JSON object matching the requested `MelodyData` structure. Do NOT include any other text, explanations, or markdown formatting.
# """
#         self.llm_client.set_system_prompt(system_prompt)
#         # self.llm_client.clear_messages() # Consider if message history is helpful here

#         message = f"""Generate the musical notes for a chord progression based on the following:
# Original User Prompt: '{self.musical_params.chord_progression}'
# Instrument: {self.musical_params.chords_instrument.name}
# Key: {key} {mode}

# Generate the chord progression notes and output them *only* as a valid JSON object conforming to the `MelodyData` schema (containing `bars`, each with `bar` number and a list of `notes`, where each `note` has `pitch`, `start_beat`, `duration_beats`).
# """

#         try:
#             # Request MelodyData directly using response_model
#             text_response, melody_data_model = await self.llm_client.send_message_async(
#                 message,
#                 queue,
#                 response_model=MelodyData, # Request the Pydantic model directly
#                 max_retries=2
#             )

#             # Log the raw text response (might contain reasoning if LLM didn't follow instructions)
#             if text_response:
#                  logger.info(f"LLM Text Response (Chord Gen): {text_response[:200]}...")
            
#             if not melody_data_model:
#                 logger.error("Failed to get structured chord progression data (MelodyData) from LLM.")
#                 # Attempt fallback or raise error? For now, log error and stop.
#                 await queue.error("Failed to generate chord progression notes from the AI.")
#                 return

#             logger.info(f"Successfully received structured MelodyData from LLM.")
#             # logger.debug(f"Melody Data: {melody_data_model.model_dump_json(indent=2)}")

#             # Process the received MelodyData model
#             await self._process_and_add_chords(melody_data_model, self.musical_params.chords_instrument, queue)

#         except ValidationError as e:
#              logger.error(f"LLM response failed Pydantic validation for MelodyData: {e}", exc_info=True)
#              await queue.error("Failed to understand the chord progression notes suggested by the AI.")
#         except Exception as e:
#             logger.error(f"Error generating chord progression: {str(e)}", exc_info=True)
#             await queue.error(f"An unexpected error occurred while generating the chord progression: {e}")
#             self.musical_params.chords = None # Ensure reset on error


#     async def _process_and_add_chords(
#         self,
#         melody_data: MelodyData, 
#         chord_instrument: Instrument, 
#         queue: SSEQueueManager
#     ) -> None:
#         """
#         Processes the structured MelodyData, transforms it, and adds the MIDI track via SSE.
#         """
#         logger.info(f"Processing structured melody data for {chord_instrument.name}...")
#         key = self.musical_params.key # Needed for transformation?

#         try:
#             # Assuming transform_chord_progression_to_instrument_format also returns a dict like {"notes": ...}
#             # And that melody_data for chords context should actually be the chord_progression string or similar structure
#             # For now, we are passing melody_data which might be incorrect for chords if it implies melody structure.
#             # This needs to be verified based on how _generate_chords calls this.
#             # Let's assume for now it receives the correct data that transform_chord_progression_to_instrument_format can use.
            
#             # The _generate_chords method passes melody_data which is a MelodyData object.
#             # transform_chord_progression_to_instrument_format expects a chord_progression string.
#             # This is a mismatch. Let's get the chord progression from melody_data if it's there, or musical_params.
#             # This part of the logic seems to have a slight disconnect from the previous version.
#             # `_generate_chords` calls this with `melody_data_model` which IS `MelodyData`
#             # `transform_chord_progression_to_instrument_format` expects a string `chord_progression`

#             # Correct approach: _generate_chords should ideally get a MelodyData-like structure for chords, or
#             # _process_and_add_chords should use self.musical_params.chord_progression.
#             # Given the current structure of _generate_chords calling this with MelodyData:
#             # We need to adapt. If MelodyData is used for chords, its `bars` field would represent chord voicings over time.
#             # Let's assume `transform_chord_progression_to_instrument_format` is the correct one to call if we want to generate from a string.
#             # However, `_generate_chords` calls `_process_and_add_chords` with a `MelodyData` object. 
#             # This suggests `MelodyData` is being used as a generic container for note sequences.

#             # Re-evaluating: The `_generate_chords` method gets a `MelodyData` object from the LLM.
#             # This `MelodyData` object *should* contain the chord notes structured similarly to a melody.
#             # So, we should use `transform_bars_to_instrument_format` here as well, 
#             # assuming the LLM was prompted to put chord notes into the MelodyData.bars structure.
#             result = transform_bars_to_instrument_format(
#                 melody_data, # This is the MelodyData object containing chord notes
#                 key
#             )

#             if not result or "notes" not in result or not result["notes"]:
#                 logger.error("Chord transformation returned empty or invalid result.")
#                 await queue.error(f"Failed to process generated chord progression for {chord_instrument.name}.")
#                 return

#             # Create models for SSE action
#             track_id = uuid.uuid4()
#             instrument_file_model = InstrumentFileRead(
#                 id=chord_instrument.id,
#                 file_name=chord_instrument.soundfont_name,
#                 display_name=chord_instrument.name,
#                 storage_key=chord_instrument.storage_key,
#                 file_format="sf2", # Assuming soundfont, get dynamically if possible
#                 file_size=0,  # TODO: Get actual size if possible
#                 category="chords",
#                 is_public=True, # Assuming public soundfonts
#                 description=chord_instrument.description, # Use description from selection
#             )
#             midi_track_model = MidiTrackRead(
#                 id=track_id,
#                 name=chord_instrument.name,
#                 instrument_id=chord_instrument.id,
#                 midi_notes_json=result,  # Assign the whole result dictionary
#                 instrument_file=instrument_file_model,
#             )

#             await queue.action(
#                 AssistantAction.add_midi_track(track=midi_track_model)
#             )

#             logger.info(
#                 f"Generated and added chord track '{chord_instrument.name}' via SSE with {len(result.get('notes', []))} notes"
#             )
            
#             # Optionally store the processed result if needed elsewhere in the service
#             # self.musical_params.chords = result 

#         except Exception as e:
#             logger.error(f"Error during chord processing/transformation: {str(e)}")
#             logger.error(f"Stack trace: {traceback.format_exc()}")
#             await queue.error(f"Failed to process generated chord progression for {chord_instrument.name}: {e}")


#     def _set_musical_params(
#         self,
#         key,
#         mode,
#         chord_progression,
#         bpm,
#         melody_instrument_suggestion,
#         chords_instrument_suggestion,
#     ):
#         """Sets the core musical parameters AND the instrument suggestions."""
#         self.musical_params.key = key or "C"
#         self.musical_params.mode = mode.lower() if mode else "major" # Ensure lowercase
#         self.musical_params.chord_progression = chord_progression or "I-V-vi-IV"
#         try:
#             self.musical_params.bpm = int(bpm) if bpm else 120
#         except (ValueError, TypeError):
#             logger.warning(f"Invalid BPM value received: {bpm}. Defaulting to 120.")
#             self.musical_params.bpm = 120

#         # Ensure mode is valid after potential modifications
#         if self.musical_params.mode not in ['major', 'minor']:
#             logger.warning(f"Final mode '{self.musical_params.mode}' is invalid. Defaulting to major.")
#             self.musical_params.mode = 'major'

#         try:
#             self.musical_params.allowed_intervals = get_mode_intervals(
#                 self.musical_params.mode
#             )
#         except ValueError as e:
#             logger.warning(
#                 f"Could not determine intervals for mode '{self.musical_params.mode}': {e}. Using major scale intervals."
#             )
#             self.musical_params.allowed_intervals = get_mode_intervals("major")

#         # Set the instrument suggestions
#         self.musical_params.melody_instrument_suggestion = melody_instrument_suggestion
#         self.musical_params.chords_instrument_suggestion = chords_instrument_suggestion

#         # Reset dependent parts when core params change
#         self.musical_params.melody = None
#         self.musical_params.chords = None
#         self.musical_params.counter_melody = None
#         self.selected_instruments = [] # Clear selected instruments as suggestions might change selection criteria
#         self.musical_params.melody_instrument = None
#         self.musical_params.chords_instrument = None

#     async def _select_instruments_via_llm(self, queue: SSEQueueManager):
#         """Selects specific soundfonts using an LLM based on available soundfonts and suggestions."""
#         logger.debug("Selecting instruments via LLM using instructor...")

#         if not self.available_soundfonts:
#             logger.error("Cannot select instruments: No available soundfonts.")
#             await queue.error("No instruments available to select from.")
#             return

#         soundfont_names = [sf["name"] for sf in self.available_soundfonts]
#         melody_suggestion_text = (
#             f"The suggested melody instrument type is: {self.musical_params.melody_instrument_suggestion}."
#             if self.musical_params.melody_instrument_suggestion
#             else "No specific melody instrument type was suggested. Please choose a suitable one."
#         )
#         chords_suggestion_text = (
#             f"The suggested chords instrument type is: {self.musical_params.chords_instrument_suggestion}."
#             if self.musical_params.chords_instrument_suggestion
#             else "No specific chords instrument type was suggested. Please choose a suitable one."
#         )

#         # System prompt can be general or more specific for this task
#         # self.llm_client.set_system_prompt("You are an expert instrument selector...")

#         message = f"""We need to select specific instruments (soundfonts) for the composition.
# Context:
# Key: {self.musical_params.key} {self.musical_params.mode}
# Tempo: {self.musical_params.bpm} BPM
# {melody_suggestion_text}
# {chords_suggestion_text}

# Available Soundfonts (select ONLY from this list):
# {json.dumps(soundfont_names, indent=2)}

# Please select at least one instrument for the 'melody' role and one for the 'chords' role. You can also suggest instruments for other roles like 'bass' or 'countermelody' if appropriate for the style.

# First, provide a brief text explanation for your choices, describing why each selected instrument and its assigned role fits the musical context and how they complement each other.

# Then, provide the final list of selected instruments, their roles, and your explanations using the required structured format (`SelectInstruments`). Ensure instrument names exactly match those in the provided list.
# """

#         try:
#             text_response, instruments_model = await self.llm_client.send_message_async(
#                 message,
#                 queue,
#                 response_model=SelectInstruments,
#                 max_retries=2
#             )

#             if not instruments_model or not instruments_model.instrument_selections:
#                 logger.warning("LLM did not return any instrument selections in the structured response.")
#                 await queue.add_log("AI did not select any instruments. Using fallbacks if possible.")
#                 # Trigger fallback processing with empty selections
#                 self._process_instrument_selections([])
#                 return

#             logger.info(f"LLM Reasoning (Instruments text): {text_response[:200]}...")
#             logger.info(f"Selected Instruments (structured): {instruments_model}")

#             # Process the validated list of InstrumentSelectionItem
#             self._process_instrument_selections(instruments_model.instrument_selections)

#         except ValidationError as e:
#             logger.error(f"LLM response failed Pydantic validation for SelectInstruments: {e}", exc_info=True)
#             await queue.error("Failed to understand the instrument selections suggested by the AI.")
#             self._process_instrument_selections([]) # Attempt fallback
#         except Exception as e:
#             logger.error(f"Error selecting instruments: {e}", exc_info=True)
#             await queue.error("An unexpected error occurred while selecting instruments.")
#             self._process_instrument_selections([]) # Attempt fallback

#     def _add_selected_instrument(
#         self, soundfont_data: Dict[str, Any], role: str, description: str
#     ):
#         """Adds a selected instrument to the list, avoiding duplicates by name for a given role."""
#         # Check if an instrument with the same name and role is already selected
#         # Or, if an instrument with same name is selected, maybe update its role/description if new role is more primary?
#         # For now, simpler: if name exists, update role if new role is primary (e.g. melody over existing other)
#         # This logic might need refinement based on desired behavior for multi-role instruments.
        
#         # A simpler rule: don't add if name + role combo exists.
#         # Or even simpler: if name exists, don't add again if it already has a primary role.
#         existing_instrument = next((inst for inst in self.selected_instruments if inst.name == soundfont_data["name"]), None)
#         if existing_instrument:
#             # If exists, maybe update its role if the new role is more specific or important
#             # For now, let's prevent adding the same soundfont multiple times, first role assigned wins,
#             # unless a more primary role (melody/chords) is suggested later.
#             # This logic is complex, for now, let's just avoid direct name duplicates in self.selected_instruments list.
#             # The roles will be assigned by the LLM.
#             is_duplicate = any(inst.name == soundfont_data["name"] for inst in self.selected_instruments)
#             if is_duplicate:
#                  logger.debug(f"Instrument '{soundfont_data['name']}' (or a version of it) already selected. Current roles: {[i.role for i in self.selected_instruments if i.name == soundfont_data['name']]}. New role suggested: {role}. Skipping duplicate add for now.")
#                  # Potentially, we could allow an instrument to have multiple roles, but that complicates `self.selected_instruments` structure.
#                  # The LLM should ideally pick one main role per selected soundfont in its list.
#                  return

#         instrument = Instrument(
#             id=soundfont_data["id"], # This ID is from the soundfont service (InstrumentFile.id)
#             name=soundfont_data["name"],
#             description=description, # LLM explanation for this choice/role
#             soundfont_name=soundfont_data["name"], # Redundant, but keeps Instrument structure
#             storage_key=soundfont_data["storage_key"],
#             role=role.lower(), # Ensure role is lowercase for consistency
#         )
#         self.selected_instruments.append(instrument)
#         logger.info(f"Added instrument: {instrument.name} with role: {instrument.role}")

#     def _process_instrument_selections(self, llm_selections: List[Any]): # Argument is List[InstrumentSelectionItem]
#         """Processes the instrument selections from the LLM (List[InstrumentSelectionItem])."""
#         self.selected_instruments = [] # Reset before processing new selections

#         if not llm_selections:
#             logger.warning("LLM did not select any instruments or input was empty. Attempting fallback.")
#         else:
#             soundfont_map = {sf["name"]: sf for sf in self.available_soundfonts}
#             for selection_item in llm_selections:
#                 # selection_item is an InstrumentSelectionItem instance
#                 instrument_name = selection_item.instrument_name
#                 role = selection_item.role
#                 explanation = selection_item.explanation

#                 if instrument_name in soundfont_map:
#                     soundfont_data = soundfont_map[instrument_name]
#                     self._add_selected_instrument(soundfont_data, role, explanation)
#                 else:
#                     logger.warning(
#                         f"LLM selected instrument '{instrument_name}' not found in available soundfonts. Skipping."
#                     )
        
#         # Fallback logic if crucial roles are missing
#         has_melody = any(inst.role == "melody" for inst in self.selected_instruments)
#         has_chords = any(inst.role == "chords" for inst in self.selected_instruments)

#         if not has_melody and self.available_soundfonts:
#             logger.warning("No melody instrument selected by LLM, assigning fallback.")
#             # Try to pick a fallback not already used for chords
#             fallback_melody_sf = next((
#                 sf for sf in self.available_soundfonts 
#                 if not any(si.name == sf["name"] and si.role == "chords" for si in self.selected_instruments)
#             ), self.available_soundfonts[0])
#             self._add_selected_instrument(fallback_melody_sf, "melody", "Fallback for missing melody role")

#         if not has_chords and self.available_soundfonts:
#             # Ensure we don't pick the same soundfont if only one is available and used for melody fallback
#             available_for_chords_fallback = [sf for sf in self.available_soundfonts if not any(si.name == sf["name"] and si.role == "melody" for si in self.selected_instruments)]
#             if available_for_chords_fallback:
#                 logger.warning("No chords instrument selected by LLM, assigning fallback.")
#                 fallback_chords_sf = available_for_chords_fallback[0]
#                 self._add_selected_instrument(fallback_chords_sf, "chords", "Fallback for missing chords role")
#             elif len(self.available_soundfonts) > 1 and not has_melody: # If only one sf and it became melody
#                  logger.warning("Only one soundfont available and used as melody fallback, cannot assign different chords fallback.")
#             elif not self.available_soundfonts:
#                  logger.warning("No soundfonts available for fallback chords instrument.")


#         # After processing and fallbacks, assign to MusicalParams
#         self.musical_params.melody_instrument = next((inst for inst in self.selected_instruments if inst.role == "melody"), None)
#         self.musical_params.chords_instrument = next((inst for inst in self.selected_instruments if inst.role == "chords"), None)

#         if self.musical_params.melody_instrument:
#             logger.info(f"Final Melody Instrument: {self.musical_params.melody_instrument.name}")
#         else:
#             logger.warning("No melody instrument could be finalized.")
        
#         if self.musical_params.chords_instrument:
#             logger.info(f"Final Chords Instrument: {self.musical_params.chords_instrument.name}")
#         else:
#             logger.warning("No chords instrument could be finalized.")

#         # Log all selected instruments for clarity
#         if self.selected_instruments:
#             log_msg = "Final selected instruments with roles: " + ", ".join([f"{inst.name} ({inst.role})" for inst in self.selected_instruments])
#             logger.info(log_msg)
#             # Consider sending this as a log to SSE queue as well
#             # await queue.add_log(log_msg) # Requires queue to be passed or accessible


# music_gen_service2 = MusicGenService2()
