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

# # Assuming your instructor client setup is in this path
# from services.soundfont_service.soundfont_service import soundfont_service
# from clients.pydantic_ai_client2 import PydanticAgentWrapper

# from services.music_gen_service.llm_schemas import (
#     DetermineMusicalParameters, 
#     SelectInstruments, 
#     SelectDrumSounds, 
#     CreateDrumBeat, 
#     MelodyData,
#     ChordProgressionOutput # New schema
# )
# # Assuming midi2.py contains the most up-to-date MIDI transformations
# from services.music_gen_service.midi2 import (
#     transform_bars_to_instrument_format,
#     transform_chord_progression_to_instrument_format, # For programmatic chord note generation
#     transform_drum_beats_to_midi_format,
# )
# from services.music_gen_service.music_utils import get_mode_intervals
# from services.music_gen_service.prompt_utils import (
#     get_ai_composer_agent_initial_system_prompt, # Might need updates
#     # get_melody_create_prompt, # Review if still needed or if prompts are inline
# )
# from services.music_gen_service.music_researcher import MusicResearcher
# import re
# from sqlmodel import Session
# from app2.core.config import settings

# load_dotenv()
# logger = get_api_logger("music_gen_service3") # New logger name


# @dataclass
# class Instrument:
#     id: str # From InstrumentFile.id (soundfont service)
#     name: str
#     description: str # LLM explanation for choosing this instrument for the role
#     soundfont_name: str # Name of the soundfont file
#     storage_key: str
#     role: str = "" 


# @dataclass
# class MusicalParams:
#     key: str = "C"
#     mode: str = "major"
#     chord_progression_str: str = "I-V-vi-IV" # LLM will provide this string
#     bpm: int = 120
#     time_signature: List[int] = field(default_factory=lambda: [4, 4])
#     duration_bars: int = 4 # Default, can be influenced by LLM or prompt
#     duration_beats: int = 16 # Calculated from bars and time signature typically

#     # Suggestions from LLM (DetermineMusicalParameters)
#     melody_instrument_suggestion: Optional[str] = None
#     chords_instrument_suggestion: Optional[str] = None

#     # Processed data for music generation
#     # These will hold the actual Instrument objects
#     melody_instrument: Optional[Instrument] = None
#     chords_instrument: Optional[Instrument] = None
#     # selected_drum_samples will be stored in the service class directly
    
#     # These will hold the generated MIDI data structures for SSE actions
#     melody_track_data: Optional[Dict[str, Any]] = None 
#     chords_track_data: Optional[Dict[str, Any]] = None
#     # drum_track_data will be generated and sent directly


# class MusicGenService3:
#     def __init__(self):
#         self.researcher = MusicResearcher()
#         self.llm_client: PydanticAgentWrapper = PydanticAgentWrapper(
#             model_id="anthropic:claude-3-opus-20240229" 
#             # Add other llm_init_kwargs if needed, e.g., temperature
#         )
#         self.musical_params = MusicalParams()
        
#         # State managed by the service instance
#         self.available_soundfonts: List[Dict[str, Any]] = []
#         self.selected_instruments: List[Instrument] = [] # All instruments LLM selected with roles
#         self.available_drum_samples: List[DrumSamplePublicRead] = []
#         self.selected_drum_samples: List[DrumSamplePublicRead] = []

#         logger.info("MusicGenService3 initialized.")

#     async def compose_music(
#         self, user_prompt: str, queue: SSEQueueManager, db_session: Session
#     ) -> Dict[str, Any]:
#         """Main orchestration method for music composition."""
#         logger.info(f"MusicGenService3 starting composition for prompt: '{user_prompt[:50]}...'")
#         self.musical_params = MusicalParams() # Reset params for new composition
#         self.selected_instruments = []
#         self.selected_drum_samples = []
        
#         try:
#             # 1. Initial Research & Data Fetching
#             await queue.stage("Initializing Composer...", "Gathering musical knowledge and assets...")
#             await self._fetch_initial_data(user_prompt, db_session)

#             # 2. Determine Core Musical Parameters (Key, Mode, Tempo, Instrument Type Suggestions)
#             # This step will also get the chord_progression_str from the LLM as part of DetermineMusicalParameters.
#             await queue.stage("Conceptualizing Music...", "AI is determining key, tempo, and style...")
#             success_params = await self._determine_core_musical_parameters(user_prompt, queue)
#             if not success_params:
#                 await queue.error("Failed to establish core musical parameters.")
#                 return {"error": "Failed to establish core musical parameters."}

#             # 3. Select Specific Instruments (Soundfonts)
#             await queue.stage("Selecting Instruments...", "AI is choosing specific soundfonts...")
#             success_instruments = await self._select_instruments(queue)
#             if not success_instruments:
#                 await queue.error("Failed to select instruments for melody and chords.")
#                 return {"error": "Failed to select instruments for melody and chords."}

#             # 4. Generate Chord Notes (Programmatically, based on LLM's chord_progression_str)
#             await queue.stage("Building Harmony...", "Generating chord notes...")
#             success_chords = await self._generate_chord_sequence_notes(queue)
#             if not success_chords:
#                 # Non-fatal, music might proceed without chords if melody is primary
#                 await queue.add_chunk("Could not generate chord sequence. Proceeding without chords.")

#             # 5. Generate Melody Notes (LLM-driven, structured as MelodyData)
#             await queue.stage("Crafting Melody...", "AI is composing the melody...")
#             success_melody = await self._generate_melody_sequence_notes(user_prompt, queue)
#             if not success_melody:
#                 # Potentially fatal if no melody can be made
#                 await queue.error("Failed to generate melody.")
#                 return {"error": "Failed to generate melody."}

#             # 6. Select Specific Drum Sounds
#             await queue.stage("Choosing Drums...", "AI is selecting drum samples...")
#             success_drum_selection = await self._select_drum_samples(user_prompt, queue)
#             # Music can proceed without drums, so this is not fatal if it fails.

#             # 7. Generate Drum Beat Patterns (LLM-driven, structured as CreateDrumBeat)
#             if self.selected_drum_samples: # Only if drums were selected
#                 await queue.stage("Creating Rhythm...", "AI is designing the drum beat...")
#                 await self._generate_drum_beat_patterns(queue)
#             else:
#                 await queue.add_chunk("Skipping drum beat generation as no drum sounds were selected.")

#             await queue.stage("Finalizing Composition...", "Preparing the musical pieces...")
#             logger.info("Music composition process completed.")
#             # Assemble final output for the client
#             # This might involve sending final track data through SSE or returning a summary
#             final_composition_data = self._package_composition_result()
#             await queue.complete(final_composition_data)
#             return final_composition_data

#         except Exception as e:
#             logger.error(f"Unhandled error in compose_music: {e}", exc_info=True)
#             await queue.error(f"A critical error occurred during music generation: {str(e)}")
#             return {"error": f"A critical error occurred: {str(e)}"}

#     async def _fetch_initial_data(self, user_prompt: str, db_session: Session):
#         """Fetches soundfonts, drum samples, and performs initial research."""
#         _drum_file_repository = get_drum_sample_public_repository(db_session)
#         drum_sample_service = get_drum_sample_service(_drum_file_repository)
        
#         # In parallel, fetch soundfonts, all drum samples, and do text-based research
#         (soundfonts, drum_samples, research_results_dict) = await asyncio.gather(
#             soundfont_service.get_public_soundfonts(),
#             drum_sample_service.get_all_samples(),
#             self.researcher.enhance_description(user_prompt) # General research, returns a Dict
#         )
#         self.available_soundfonts = soundfonts
#         self.available_drum_samples = drum_samples
        
#         # Store the relevant research text string (e.g., prompt_addition or enhanced)
#         # Default to an empty string if the expected key is missing or research failed
#         self._general_research_text = research_results_dict.get("prompt_addition", "") 
        
#         logger.info(f"Fetched {len(self.available_soundfonts)} soundfonts and {len(self.available_drum_samples)} drum samples.")
#         # Now slicing the string should work
#         logger.info(f"Initial research for prompt completed: {self._general_research_text[:100]}...")


#     async def _determine_core_musical_parameters(self, user_prompt: str, queue: SSEQueueManager) -> bool:
#         """Determines key, mode, BPM, chord progression string, and instrument type suggestions using LLM."""
#         logger.info("Determining core musical parameters...")
        
#         # System prompt guiding the LLM for this specific task
#         system_prompt = get_ai_composer_agent_initial_system_prompt() + "\n" + \
#                         "You are analyzing a user request to determine the foundational musical parameters. " \
#                         "Provide clear reasoning for each parameter (key, mode, tempo, chord progression, melody/chord instrument suggestions) in your text response. " \
#                         "Then, output these parameters precisely using the required `DetermineMusicalParameters` format. " \
#                         "The chord progression should be represented as a standard string (e.g., C-G-Am-F). " \
#                         "Ensure the mode is strictly 'major' or 'minor'."
#         self.llm_client.set_system_prompt(system_prompt)

#         # Construct the user message, including research context
#         message = f"""Analyze the following user request to determine musical parameters:
# User Request: '{user_prompt}'

# General Research Context: {getattr(self, '_general_research_text', 'No research available')}

# Please determine the following:
# 1.  **Key and Mode**: What is the most suitable key and mode (major/minor)?
# 2.  **Tempo**: What tempo (BPM) fits the description?
# 3.  **Chord Progression**: Suggest a chord progression string (e.g., C-G-Am-F or ii-V-I) suitable for the key/mode/style.
# 4.  **Melody Instrument Suggestion**: Suggest a general type of instrument for the melody (e.g., Piano, Synth Lead).
# 5.  **Chords Instrument Suggestion**: Suggest a general type of instrument for the chords (e.g., Strings, Pad).

# First, explain your reasoning for each choice in detail. Then, provide the final parameters using the `DetermineMusicalParameters` structure.
# """

#         try:
#             # Use the PydanticAgentWrapper client. Text response is streamed to the queue.
#             params_model = await self.llm_client.send_message_async(
#                 message=message,
#                 queue=queue, # Pass queue for streaming text response
#                 response_model=DetermineMusicalParameters,
#                 stream=True, # Enable streaming for text to queue
#                 llm_run_kwargs={"retries": 1} # Map max_retries
#             )

#             if not params_model:
#                 logger.error("LLM failed to return DetermineMusicalParameters structure.")
#                 await queue.error("AI could not determine the core musical parameters.")
#                 return False

#             # Text response (reasoning) is streamed to the queue by PydanticAgentWrapper
#             # logger.info(f"LLM Reasoning for Parameters: {text_response[:200]}...") # This was removed
#             logger.info(f"Received Parameters: {params_model}")

#             # Validate and sanitize mode
#             validated_mode = params_model.mode.lower()
#             if validated_mode not in ['major', 'minor']:
#                 logger.warning(f"LLM returned invalid mode '{params_model.mode}'. Defaulting based on key/progression or to major.")
#                 # Basic fallback logic (can be improved)
#                 if 'm' in params_model.key or any(c in params_model.chord_progression for c in ['m', 'dim', 'min']):
#                     validated_mode = 'minor'
#                 else:
#                     validated_mode = 'major'
            
#             # Update musical parameters state
#             self.musical_params.key = params_model.key
#             self.musical_params.mode = validated_mode
#             self.musical_params.bpm = params_model.tempo
#             # Store the chord progression STRING from the LLM
#             self.musical_params.chord_progression_str = params_model.chord_progression 
#             self.musical_params.melody_instrument_suggestion = params_model.melody_instrument_suggestion
#             self.musical_params.chords_instrument_suggestion = params_model.chords_instrument_suggestion
#             # Calculate duration beats based on bars and time signature
#             beats_per_bar = self.musical_params.time_signature[0] * (4 / self.musical_params.time_signature[1])
#             self.musical_params.duration_beats = int(beats_per_bar * self.musical_params.duration_bars)

#             logger.info(f"Updated Musical Parameters: Key={self.musical_params.key}, Mode={self.musical_params.mode}, BPM={self.musical_params.bpm}, Chord Str='{self.musical_params.chord_progression_str}'")

#             # Send updates via SSE
#             await queue.action(AssistantAction.change_bpm(value=self.musical_params.bpm))
#             await queue.action(AssistantAction.change_key(
#                 value=self.musical_params.key + " " + self.musical_params.mode.capitalize()
#             ))
#             await queue.add_chunk(f"Set Key: {self.musical_params.key} {self.musical_params.mode}, Tempo: {self.musical_params.bpm} BPM, Chord Progression: {self.musical_params.chord_progression_str}")
            
#             return True

#         except ValidationError as e:
#             logger.error(f"LLM response failed Pydantic validation for DetermineMusicalParameters: {e}", exc_info=True)
#             await queue.error("AI provided invalid musical parameters. Cannot proceed.")
#             return False
#         except Exception as e:
#             logger.error(f"Error determining musical parameters: {e}", exc_info=True)
#             await queue.error(f"An error occurred while determining musical parameters: {str(e)}")
#             return False

#     async def _select_instruments(self, queue: SSEQueueManager) -> bool:
#         """Selects specific soundfonts using LLM based on available soundfonts and suggestions."""
#         logger.info("Selecting specific instruments...")

#         if not self.available_soundfonts:
#             logger.error("Cannot select instruments: No available soundfonts.")
#             await queue.error("No instruments available to select from.")
#             return False

#         soundfont_names = [sf.get("name", "Unknown") for sf in self.available_soundfonts]
#         if not soundfont_names:
#              logger.error("Available soundfonts list is empty or missing names.")
#              await queue.error("Cannot select instruments, list is invalid.")
#              return False

#         # Get suggestions from the parameters determined previously
#         melody_suggestion_text = (
#             f"Previously, it was suggested to use a '{self.musical_params.melody_instrument_suggestion}' type for the melody." 
#             if self.musical_params.melody_instrument_suggestion 
#             else "No specific type was suggested for the melody instrument."
#         )
#         chords_suggestion_text = (
#             f"Previously, it was suggested to use a '{self.musical_params.chords_instrument_suggestion}' type for the chords." 
#             if self.musical_params.chords_instrument_suggestion 
#             else "No specific type was suggested for the chords instrument."
#         )

#         # System prompt (can be general or specific)
#         system_prompt = get_ai_composer_agent_initial_system_prompt() + "\n" + \
#                         "You are an expert instrument selector for music composition. " \
#                         "Your task is to choose specific soundfonts from a provided list for different musical roles (melody, chords, potentially others like bass). " \
#                         "Consider the desired musical style, the previously suggested instrument types, and how the chosen instruments will sound together. " \
#                         "Explain your choices clearly in text, then provide the selections in the required `SelectInstruments` format."
#         self.llm_client.set_system_prompt(system_prompt)

#         # Construct the user message
#         message = f"""Based on the musical context (Key: {self.musical_params.key} {self.musical_params.mode}, Tempo: {self.musical_params.bpm} BPM):
# {melody_suggestion_text}
# {chords_suggestion_text}

# Please select specific soundfonts from the following list for the required roles:

# Available Soundfonts:
# {json.dumps(soundfont_names, indent=2)}

# Requirements:
# - Select at least one soundfont for the 'melody' role.
# - Select at least one soundfont for the 'chords' role.
# - You can optionally select instruments for other roles (e.g., 'bass', 'countermelody') if appropriate.
# - Ensure the names you choose exactly match the names in the provided list.

# First, explain your reasoning for each choice: why is this soundfont suitable for this role in this musical context? How do the selected instruments complement each other?
# Then, provide your final selections using the `SelectInstruments` structure, including `instrument_name`, `role`, and `explanation` for each.
# """

#         try:
#             # Call LLM to get instrument selections
#             # Text response is streamed to the queue.
#             instruments_model = await self.llm_client.send_message_async(
#                 message=message,
#                 queue=queue,
#                 response_model=SelectInstruments,
#                 stream=True, # Enable streaming for text to queue
#                 llm_run_kwargs={"retries": 1} # Map max_retries
#             )

#             if not instruments_model or not instruments_model.instrument_selections:
#                 logger.warning("LLM did not return any instrument selections. Attempting fallbacks.")
#                 await queue.add_chunk("AI did not select instruments. Assigning defaults.")
#                 self._process_instrument_selections([]) # Trigger fallback logic
#             else:
#                 # Text response (reasoning) is streamed to the queue by PydanticAgentWrapper
#                 # logger.info(f"LLM Reasoning (Instruments): {text_response[:200]}...") # This was removed
#                 logger.info(f"Received Instrument Selections: {instruments_model}")
#                 # Process the selections received from the LLM
#                 self._process_instrument_selections(instruments_model.instrument_selections)

#             # Check if essential roles were filled (either by LLM or fallback)
#             if not self.musical_params.melody_instrument or not self.musical_params.chords_instrument:
#                 logger.error("Failed to finalize instruments for essential melody and chords roles.")
#                 await queue.error("Could not assign instruments for melody and chords.")
#                 return False
            
#             # Log final selections
#             selected_roles = {inst.role: inst.name for inst in self.selected_instruments}
#             log_msg = f"Finalized Instruments: {selected_roles}"
#             logger.info(log_msg)
            
#             return True

#         except ValidationError as e:
#             logger.error(f"LLM response failed Pydantic validation for SelectInstruments: {e}", exc_info=True)
#             await queue.error("AI provided invalid instrument selections.")
#             logger.info("Attempting fallback instrument selection due to validation error.")
#             self._process_instrument_selections([]) # Trigger fallback
#             # Check again if fallbacks succeeded for essential roles
#             if not self.musical_params.melody_instrument or not self.musical_params.chords_instrument:
#                 return False
#             return True # Fallback might have worked
#         except Exception as e:
#             logger.error(f"Error selecting instruments: {e}", exc_info=True)
#             await queue.error(f"An error occurred while selecting instruments: {str(e)}")
#             # Attempt fallback even on general error
#             logger.info("Attempting fallback instrument selection due to general error.")
#             self._process_instrument_selections([]) # Trigger fallback
#             if not self.musical_params.melody_instrument or not self.musical_params.chords_instrument:
#                 return False
#             return True # Fallback might have worked

#     # --- Helper methods for instrument selection --- 
    
#     def _add_selected_instrument(
#         self, soundfont_data: Dict[str, Any], role: str, description: str
#     ):
#         """Adds a selected instrument to the list, avoiding duplicates by name."""
#         # Prevent adding the exact same soundfont name multiple times, regardless of role suggested by LLM.
#         # The first role assigned by the LLM (or fallback) for a given soundfont name wins.
#         is_duplicate = any(inst.name == soundfont_data.get("name") for inst in self.selected_instruments)
#         if is_duplicate:
#             logger.debug(f"Soundfont '{soundfont_data.get('name')}' already selected. Skipping add for new role '{role}'.")
#             return
        
#         # Validate essential soundfont data is present
#         sf_id = soundfont_data.get("id")
#         sf_name = soundfont_data.get("name")
#         sf_storage_key = soundfont_data.get("storage_key")

#         if not all([sf_id, sf_name, sf_storage_key]):
#              logger.warning(f"Skipping adding instrument due to missing data in soundfont_data: {soundfont_data}")
#              return

#         instrument = Instrument(
#             id=str(sf_id), # Ensure ID is string
#             name=sf_name,
#             description=description or "Instrument selected by AI", # LLM explanation
#             soundfont_name=sf_name, 
#             storage_key=sf_storage_key,
#             role=role.lower(), # Ensure role is lowercase
#         )
#         self.selected_instruments.append(instrument)
#         logger.info(f"Added instrument to selection: {instrument.name} with role: {instrument.role}")

#     def _process_instrument_selections(self, llm_selections: List[Any]): # Expects List[InstrumentSelectionItem]
#         """Processes the instrument selections from LLM, applies fallbacks, and updates state."""
#         self.selected_instruments = [] # Reset before processing
#         soundfont_map = {sf.get("name"): sf for sf in self.available_soundfonts if sf.get("name")} # Map name to full dict

#         if llm_selections:
#             logger.info(f"Processing {len(llm_selections)} instrument selections from LLM.")
#             for selection_item in llm_selections:
#                 # Ensure it looks like InstrumentSelectionItem (duck typing or isinstance if needed)
#                 if hasattr(selection_item, 'instrument_name') and hasattr(selection_item, 'role') and hasattr(selection_item, 'explanation'):
#                     instrument_name = selection_item.instrument_name
#                     role = selection_item.role
#                     explanation = selection_item.explanation

#                     if instrument_name in soundfont_map:
#                         soundfont_data = soundfont_map[instrument_name]
#                         self._add_selected_instrument(soundfont_data, role, explanation)
#                     else:
#                         logger.warning(
#                             f"LLM selected instrument '{instrument_name}' which was not found in the available soundfonts map. Skipping."
#                         )
#                 else:
#                      logger.warning(f"Skipping invalid selection item from LLM: {selection_item}")       
#         else:
#             logger.warning("LLM provided no instrument selections. Proceeding with fallbacks.")

#         # --- Fallback Logic --- 
#         has_melody = any(inst.role == "melody" for inst in self.selected_instruments)
#         has_chords = any(inst.role == "chords" for inst in self.selected_instruments)

#         # If no melody instrument, assign a fallback
#         if not has_melody and self.available_soundfonts:
#             logger.warning("Assigning fallback melody instrument.")
#             # Prefer instrument not already used for chords, otherwise take the first available
#             fallback_melody_sf = next((
#                 sf for sf in self.available_soundfonts 
#                 if not any(si.name == sf.get("name") for si in self.selected_instruments)
#             ), self.available_soundfonts[0])
#             self._add_selected_instrument(fallback_melody_sf, "melody", "Fallback for missing melody role")

#         # If no chords instrument, assign a fallback
#         if not has_chords and self.available_soundfonts:
#             # Prefer instrument not already used for melody (or anything else)
#             fallback_chords_sf = next((
#                 sf for sf in self.available_soundfonts 
#                 if not any(si.name == sf.get("name") for si in self.selected_instruments)
#             ), None) # Find one not already selected at all
            
#             if fallback_chords_sf: 
#                 logger.warning("Assigning fallback chords instrument.")
#                 self._add_selected_instrument(fallback_chords_sf, "chords", "Fallback for missing chords role")
#             elif len(self.available_soundfonts) == 1 and has_melody: # Only one soundfont, used for melody
#                  logger.warning("Only one soundfont available, cannot assign different fallback for chords.")
#             elif len(self.available_soundfonts) > 1: # More than one sf, but all already used (e.g. melody + bass)
#                  logger.warning("Could not find an unused soundfont for fallback chords instrument. Picking first available.")
#                  self._add_selected_instrument(self.available_soundfonts[0], "chords", "Fallback for missing chords role (reusing soundfont)")
#             else: # No soundfonts left or available
#                  logger.warning("No soundfonts available for fallback chords instrument.")

#         # --- Final Assignment to MusicalParams --- 
#         # Find the *first* instrument assigned the role of melody/chords from the processed list
#         self.musical_params.melody_instrument = next((inst for inst in self.selected_instruments if inst.role == "melody"), None)
#         self.musical_params.chords_instrument = next((inst for inst in self.selected_instruments if inst.role == "chords"), None)

#         logger.info(f"Final Melody Instrument assigned: {self.musical_params.melody_instrument.name if self.musical_params.melody_instrument else 'None'}")
#         logger.info(f"Final Chords Instrument assigned: {self.musical_params.chords_instrument.name if self.musical_params.chords_instrument else 'None'}")


#     async def _generate_chord_sequence_notes(self, queue: SSEQueueManager) -> bool:
#         """Generates chord notes programmatically from the chord progression string and sends via SSE."""
#         logger.info("Generating chord sequence notes...")
        
#         chord_instrument = self.musical_params.chords_instrument
#         chord_progression_str = self.musical_params.chord_progression_str
#         key = self.musical_params.key
        
#         if not chord_instrument:
#             logger.warning("Cannot generate chords: No chords instrument selected.")
#             # Not necessarily an error, might be intentional design
#             return False 
        
#         if not chord_progression_str:
#             logger.warning("Cannot generate chords: No chord progression string determined.")
#             return False
            
#         logger.info(f"Generating notes for chords '{chord_progression_str}' using {chord_instrument.name}")

#         try:
#             # Use the transformation function from midi2.py
#             transformed_dict = transform_chord_progression_to_instrument_format(
#                 chord_progression=chord_progression_str, 
#                 key=key
#             )

#             if not transformed_dict or "notes" not in transformed_dict or not transformed_dict["notes"]:
#                 logger.error("Chord transformation returned empty or invalid result.")
#                 await queue.error(f"Failed to process generated chord progression for {chord_instrument.name}.")
#                 return False

#             # Store the generated notes data (the dict {"notes": [...]})
#             self.musical_params.chords_track_data = transformed_dict
#             logger.info(f"Generated {len(transformed_dict.get('notes', []))} notes for chords.")

#             # Create models for SSE action
#             track_id = uuid.uuid4()
#             instrument_file_model = InstrumentFileRead(
#                 id=chord_instrument.id,
#                 file_name=chord_instrument.soundfont_name,
#                 display_name=chord_instrument.name,
#                 storage_key=chord_instrument.storage_key,
#                 file_format="sf2", # TODO: Determine format properly if needed
#                 file_size=0,  # Placeholder
#                 category="chords",
#                 is_public=True, # Assuming public soundfonts
#                 description=chord_instrument.description, # Use description from selection
#             )
#             midi_track_model = MidiTrackRead(
#                 id=track_id,
#                 name=chord_instrument.name,
#                 instrument_id=chord_instrument.id,
#                 midi_notes_json=transformed_dict,  # Pass the whole {"notes": ...} dict
#                 instrument_file=instrument_file_model,
#             )

#             # Send track data via SSE
#             await queue.action(
#                 AssistantAction.add_midi_track(track=midi_track_model)
#             )
#             logger.info(f"Sent chord track '{chord_instrument.name}' via SSE.")
#             return True

#         except Exception as e:
#             logger.error(f"Error during chord sequence generation: {e}", exc_info=True)
#             await queue.error(f"Failed to generate chord sequence for {chord_instrument.name}: {str(e)}")
#             return False

#     async def _generate_melody_sequence_notes(self, user_prompt: str, queue: SSEQueueManager) -> bool:
#         """Stub for LLM call to generate melody notes, structured as MelodyData."""
#         # This method will use response_model=MelodyData
#         logger.info("Stub: _generate_melody_sequence_notes called")
#         # ---- To be implemented ----
#         # 1. Check if self.musical_params.melody_instrument is set.
#         # 2. Construct prompt using user_prompt, musical context (key, mode, tempo, chords_progression_str), and melody_instrument info.
#         # 3. Call self.llm_client.send_message_async with response_model=MelodyData.
#         # 4. Process MelodyData: use transform_bars_to_instrument_format from midi2.py.
#         # 5. Store result in self.musical_params.melody_track_data.
#         # 6. Send AssistantAction.add_midi_track via queue.
#         return True # Placeholder

#     async def _select_drum_samples(self, user_prompt: str, queue: SSEQueueManager) -> bool:
#         """Stub for LLM call to select specific drum samples."""
#         # This method will use response_model=SelectDrumSounds
#         logger.info("Stub: _select_drum_samples called")
#         # ---- To be implemented ----
#         # 1. Perform drum-specific research if needed: self.researcher.research_drum_sounds(user_prompt)
#         # 2. Construct prompt with available_drum_samples and research.
#         # 3. Call self.llm_client.send_message_async with response_model=SelectDrumSounds.
#         # 4. Populate self.selected_drum_samples based on LLM response.
#         return True # Placeholder

#     async def _generate_drum_beat_patterns(self, queue: SSEQueueManager) -> bool:
#         """Stub for LLM call to generate drum beat patterns for selected samples."""
#         # This method will use response_model=CreateDrumBeat
#         logger.info("Stub: _generate_drum_beat_patterns called")
#         # ---- To be implemented ----
#         # 1. Check if self.selected_drum_samples is not empty.
#         # 2. Construct prompt with selected_drum_samples info.
#         # 3. Call self.llm_client.send_message_async with response_model=CreateDrumBeat.
#         # 4. Process CreateDrumBeat: use transform_drum_beats_to_midi_format for each pattern.
#         # 5. Send AssistantAction.add_drum_track (which contains multiple SamplerTrackRead) via queue.
#         return True # Placeholder

#     def _package_composition_result(self) -> Dict[str, Any]:
#         """Packages the final composition data to be returned."""
#         logger.info("Packaging final composition result...")
#         # This is similar to the return structure of the old compose_music
#         # It should reflect the successfully generated parts.
#         instruments_for_client = []
#         if self.musical_params.melody_track_data: # Assuming this stores the {"notes":...} dict
#             # We need to send MidiTrackRead or similar, not just raw notes, if client expects that.
#             # For now, let's assume this part of the data structure might evolve.
#             # Based on old service, it sent the transformed dicts directly.
#             instruments_for_client.append(self.musical_params.melody_track_data)
#         if self.musical_params.chords_track_data:
#             instruments_for_client.append(self.musical_params.chords_track_data)
#         # Drum tracks are sent via SSE actions directly as DrumTrackRead.

#         return {
#             "tempo": self.musical_params.bpm,
#             "key": self.musical_params.key,
#             "mode": self.musical_params.mode,
#             "time_signature": self.musical_params.time_signature,
#             "chord_progression": self.musical_params.chord_progression_str,
#             "instruments": instruments_for_client, # This might need to be more structured depending on client needs
#             # Add other relevant info, e.g., selected instrument names, drum names.
#         }

# # To make it runnable (for testing stubs)
# music_gen_service3 = MusicGenService3()
