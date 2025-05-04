import asyncio
from dataclasses import dataclass, field
import json
import os
import traceback
from typing import Any, Dict, List, Optional
import uuid
import anthropic
from dotenv import load_dotenv
import logging
from app2.sse.sse_queue_manager import SSEQueueManager
from app2.core.logging import get_api_logger
from app2.types.assistant_actions import AssistantAction, TrackType
from app2.api.dependencies import get_drum_sample_service, get_drum_sample_public_repository
from app2.models.public_models.drum_samples import DrumSamplePublicRead
from app2.models.track_models.midi_track import MidiTrackRead
from app2.models.public_models.instrument_file import InstrumentFileRead
from app2.models.track_models.sampler_track import SamplerTrackRead
from services.music_gen_service.chord_progression_analysis import analyze_chord_progression
from services.soundfont_service.soundfont_service import soundfont_service
from clients.anthropic_client import AnthropicClient
from services.music_gen_service.midi import transform_bars_to_instrument_format, transform_chord_progression_to_instrument_format
from services.music_gen_service.music_utils import get_mode_intervals
from services.music_gen_service.music_gen_tools import CREATE_MELODY_TOOL, DETERMINE_MUSICAL_PARAMETERS_TOOL, SELECT_DRUM_SOUNDS_TOOL, SELECT_INSTRUMENTS_TOOL, CREATE_DRUM_BEAT_TOOL
from services.music_gen_service.prompt_utils import get_ai_composer_agent_initial_system_prompt, get_melody_create_prompt
from services.music_gen_service.music_researcher import MusicResearcher
import re
from sqlmodel import Session
from uuid import UUID

load_dotenv()
logger = get_api_logger("music_gen_service")

@dataclass
class Instrument:
    id: str
    name: str
    description: str
    soundfont_name: str
    storage_key: str
    role: str = ""  # For tracking the instrument's role in the composition (melody, chords, etc.)
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert instrument to a dictionary for serialization"""
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "soundfont_name": self.soundfont_name,
            "storage_key": self.storage_key,
            "category": self.category,
            "role": self.role
        }
    
@dataclass
class MusicalParams:
    key: str = ""
    mode: str = ""
    chord_progression: str = ""
    bpm: int = 0
    allowed_intervals: List[int] = field(default_factory=list)
    duration_beats: int = 16
    duration_bars: int = 4
    time_signature: List[int] = field(default_factory=list)
    melody: Optional[Any] = None
    counter_melody: Optional[Any] = None
    chords: Optional[Any] = None
    melody_instrument: Optional[Instrument] = None
    chords_instrument: Optional[Instrument] = None
    drum_sounds: Optional[List[DrumSamplePublicRead]] = None

class MusicGenService:
    def __init__(self):
        self.researcher = MusicResearcher()
        self.anthropic_client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))
        self.anthropic_client2 = AnthropicClient()
        self.melody_composer = AnthropicClient()
        self.chord_composer = AnthropicClient()
        self.model = os.getenv("MODEL_ID")
        self.musical_params = MusicalParams()
        self.available_soundfonts = []
        self.selected_instruments: List[Instrument] = []
        self.drum_sounds: List[DrumSamplePublicRead] = []

    async def compose_music(self, prompt: str, queue: SSEQueueManager, session: Session):
        _drum_file_repository = get_drum_sample_public_repository(session)
        drum_sample_service = get_drum_sample_service(_drum_file_repository)

        await queue.stage("Starting research...", "Doing research online to find the best musical parameters...")
        research_result, chord_research_result, self.available_soundfonts = await asyncio.gather(
            self.researcher.enhance_description(prompt),
            self.researcher.research_chord_progression(prompt),
            soundfont_service.get_public_soundfonts(),
        )
        
        self.drum_sounds = await drum_sample_service.get_all_samples()

        await self._determine_musical_parameters(prompt, research_result, chord_research_result, queue)

        await self._select_instruments_via_llm(queue)

        await self._generate_chords(queue)

        # Generate melody
        await self._generate_melody(prompt, queue)

        # Get drum sounds
        drum_result = await self.researcher.research_drum_sounds(prompt)
        logger.info(f"Drum result: {drum_result}")
        
        await self._select_drum_sounds(drum_result, queue)

        # Generate drum beat *after* selecting sounds
        await self._generate_drum_beat(queue)

        instruments = []
        if self.musical_params.melody:
            instruments.append(self.musical_params.melody)
        if self.musical_params.chords:
            instruments.append(self.musical_params.chords)
        if self.musical_params.counter_melody:
            instruments.append(self.musical_params.counter_melody)
            
        return {
            "tempo": self.musical_params.bpm,
            "key": self.musical_params.key,
            "time_signature": self.musical_params.time_signature,
            "instruments": instruments,
            "chord_progression": self.musical_params.chord_progression
        }
        
    async def _get_drum_sounds(self, prompt: str, queue: SSEQueueManager):
        """Gets the drum sounds using an LLM."""
        logger.debug("Getting drum sounds...")
        drum_result = await self.researcher.research_drum_sounds(prompt)
        logger.info(f"Drum result: {drum_result}")
        return drum_result

    async def _determine_musical_parameters(self, prompt: str, research_result: str, chord_research_result: str, queue: SSEQueueManager):
        """Determines key, mode, BPM, chord progression, and suggested instruments using an LLM."""
        logger.debug("Determining musical parameters...")
        system_prompt = get_ai_composer_agent_initial_system_prompt()
        self.anthropic_client2.set_system_prompt(system_prompt)
        
        message = f"""Based on this description: {prompt}

I need you to determine the musical parameters (key, mode, BPM, melody instrument, chords instrument, and chord progression). 

First, explain your reasoning for each parameter:
1. What key would work best and why?
2. What mode would complement this and why?
3. What tempo (BPM) would capture the right feel and why?
4. What chord progression would support this style and why?
5. What melody instrument would work best and why? (Suggest a general type, not a specific soundfont yet)
6. What chords instrument would work best and why? (Suggest a general type, not a specific soundfont yet)

After you've explained your choices, use the determine_musical_parameters tool to set these values.

**IMPORTANT: Explain your reasoning for each parameter before using the tool.**

Here is some research we've done on the description: {research_result} 
And here is some research we've done on the chord progression: {chord_research_result}"""
        
        await self.anthropic_client2.send_message_async(message, queue, stream=True, tools=[])
        
        message = """
        Now use the "determine_musical_parameters" tool to set the musical parameters based on your previous reasoning.
        """
        _, tool_use_json = await self.anthropic_client2.send_message_async(message, queue, stream=True, tools=[DETERMINE_MUSICAL_PARAMETERS_TOOL])
        
        if not tool_use_json:
             raise ValueError("Failed to get musical parameters from LLM tool use.")

        self._set_musical_params(
            tool_use_json.get("key"), 
            tool_use_json.get("mode"), 
            tool_use_json.get("chord_progression"), 
            tool_use_json.get("tempo"),
            tool_use_json.get("melody_instrument"),
            tool_use_json.get("chords_instrument")
        )
        logger.info(f"Determined Musical Params: {self.musical_params}")
        await queue.action(AssistantAction.change_bpm(value=self.musical_params.bpm))

    async def _select_drum_sounds(self, drum_research_result: str, queue: SSEQueueManager):
        """Selects specific drum sounds using an LLM based on available drum sounds."""
        logger.debug("Selecting drum sounds...")
        # Ensure self.drum_sounds is populated and contains DrumSamplePublicRead objects
        if not self.drum_sounds or not isinstance(self.drum_sounds[0], DrumSamplePublicRead):
             logger.error("Available drum sounds list is empty or contains invalid data.")
             self.musical_params.drum_sounds = []
             return

        # Create a list of names and a mapping for easy lookup
        drum_sample_names = [ds.display_name for ds in self.drum_sounds]
        drum_sound_map = {ds.display_name: ds for ds in self.drum_sounds}
        
        message = f"""Now we need to select specific drum sounds for the composition. 

Look through this list of available drum sounds and select specific ones that fit the overall style and the description provided earlier. 
Available Drum Sounds: {drum_sample_names} 

Consider the genre of the description and select the most appropriate drum sounds (typically 4-5, like kick, snare, hi-hat, crash). Consider this research: {drum_research_result}

Explain your choices briefly for each drum sound you select.

After explaining, use the select_drum_sounds tool to finalize your choices."""

        await self.anthropic_client2.send_message_async(message, queue, stream=True, tools=[])

        message = "Now use the select_drum_sounds tool to confirm your drum sound selections based on your reasoning."
        _, tool_use_json = await self.anthropic_client2.send_message_async(message, queue, stream=True, tools=[SELECT_DRUM_SOUNDS_TOOL])
        
        if not tool_use_json:
             logger.error("LLM did not use the select_drum_sounds tool.")
             self.musical_params.drum_sounds = []
             return
             
        selected_names = tool_use_json.get("drum_sounds", [])
        if not selected_names:
             logger.warning("LLM tool use did not specify any drum sounds.")
             self.musical_params.drum_sounds = []
             return

        selected_drums = []
        for name in selected_names:
            if name in drum_sound_map:
                selected_drums.append(drum_sound_map[name])
                logger.info(f"Selected drum sound: {name}")
            else:
                logger.warning(f"LLM selected drum sound '{name}' which is not in the available list.")
                
        self.musical_params.drum_sounds = selected_drums
        logger.info(f"Final selected drums ({len(self.musical_params.drum_sounds)}): {[ds.display_name for ds in self.musical_params.drum_sounds]}")

    async def _select_instruments_via_llm(self, queue: SSEQueueManager):
        """Selects specific soundfonts using an LLM based on available soundfonts and desired roles."""
        logger.debug("Selecting instruments via LLM...")
        soundfont_names = [sf["name"] for sf in self.available_soundfonts]
        
        melody_suggestion = f"The suggested melody instrument type is: {self.musical_params.melody_instrument_suggestion}" if self.musical_params.melody_instrument_suggestion else ""
        chords_suggestion = f"The suggested chords instrument type is: {self.musical_params.chords_instrument_suggestion}" if self.musical_params.chords_instrument_suggestion else ""
        
        message = f"""Now we need to select specific instruments (soundfonts) for the composition. 
        
{melody_suggestion}
{chords_suggestion}

Look through this list of available soundfonts and select specific ones that fit the roles (melody, chords) and the overall style. 
Available Soundfonts: {soundfont_names} 

Explain your choices briefly for each role. You should select at least one instrument for melody and one for chords. Make sure they fit well together.

After explaining, use the select_instruments tool to finalize your choices."""

        await self.anthropic_client2.send_message_async(message, queue, stream=True, tools=[])

        message = "Now use the select_instruments tool to confirm your instrument selections."
        _, tool_use_json = await self.anthropic_client2.send_message_async(message, queue, stream=True, tools=[SELECT_INSTRUMENTS_TOOL])
        
        if not tool_use_json:
             raise ValueError("Failed to get instrument selections from LLM tool use.")
             
        self._process_instrument_selections(tool_use_json)
        logger.info(f"Selected Instruments: {self.selected_instruments}")
        
    def _process_instrument_selections(self, tool_use_args: Dict[str, Any]):
        """Processes the instrument selections from the LLM tool use."""
        instrument_selections = tool_use_args.get("instrument_selections", [])
        if not instrument_selections:
            logger.warning("LLM did not select any instruments.")
            if len(self.available_soundfonts) >= 1:
                 self._add_selected_instrument(self.available_soundfonts[0], "melody", "Fallback selection")
            if len(self.available_soundfonts) >= 2:
                 self._add_selected_instrument(self.available_soundfonts[1], "chords", "Fallback selection")
            return

        soundfont_map = {sf["name"]: sf for sf in self.available_soundfonts}

        self.selected_instruments = []
        for selection in instrument_selections:
            instrument_name = selection.get("instrument_name")
            role = selection.get("role")
            explanation = selection.get("explanation", "")

            if instrument_name in soundfont_map:
                soundfont_data = soundfont_map[instrument_name]
                self._add_selected_instrument(soundfont_data, role, explanation)
            else:
                logger.warning(f"LLM selected instrument '{instrument_name}' not found in available soundfonts.")
                
        has_melody = any(inst.role == "melody" for inst in self.selected_instruments)
        has_chords = any(inst.role == "chords" for inst in self.selected_instruments)

        if not has_melody and self.available_soundfonts:
             logger.warning("No melody instrument selected, assigning fallback.")
             fallback_melody = next((sf for sf in self.available_soundfonts if sf['name'] not in [inst.name for inst in self.selected_instruments if inst.role == 'chords']), self.available_soundfonts[0])
             self._add_selected_instrument(fallback_melody, "melody", "Fallback for missing melody role")
        
        if not has_chords and self.available_soundfonts:
             logger.warning("No chords instrument selected, assigning fallback.")
             fallback_chords = next((sf for sf in self.available_soundfonts if sf['name'] not in [inst.name for inst in self.selected_instruments if inst.role == 'melody']), self.available_soundfonts[0])
             self._add_selected_instrument(fallback_chords, "chords", "Fallback for missing chords role")

    def _add_selected_instrument(self, soundfont_data: Dict[str, Any], role: str, description: str):
        """Adds a selected instrument to the list, avoiding duplicates."""
        if any(inst.name == soundfont_data["name"] for inst in self.selected_instruments):
             logger.debug(f"Instrument '{soundfont_data['name']}' already selected, skipping duplicate add.")
             return
             
        instrument = Instrument(
            id=soundfont_data["id"],
            name=soundfont_data["name"],
            description=description,
            soundfont_name=soundfont_data["name"],
            storage_key=soundfont_data["storage_key"],
            role=role
        )
        self.selected_instruments.append(instrument)
        logger.info(f"Added instrument: {instrument.name} with role: {instrument.role}")

    async def _generate_chords(self, queue: SSEQueueManager):
        """Generates the chord progression MIDI data."""
        logger.debug("Generating chords...")
        try:
            chords_result = await self._handle_create_chords(queue=queue)
            if chords_result:
                logger.info(f"Successfully generated chord progression")
            else:
                logger.warning("Chord generation did not return results.")
        except Exception as e:
            logger.error(f"Error generating chord progression: {str(e)}", exc_info=True)
            self.musical_params.chords = None 

    async def _generate_drum_beat(self, queue: SSEQueueManager):
        """Generates the drum beat MIDI data."""
        logger.debug("Generating drum beat...")
        await queue.stage("Generating drum beat...", "Asking the AI composer to create drum patterns...")

        selected_drums = self.musical_params.drum_sounds
        if not selected_drums:
            logger.warning("No drum sounds selected, skipping drum beat generation.")
            return

        # Convert UUID to string for JSON serialization
        drum_info = [{'id': str(ds.id), 'name': ds.display_name} for ds in selected_drums]
        drum_names = [ds['name'] for ds in drum_info]

        message = f"""We need to create drum patterns for the composition.
Key: {self.musical_params.key} {self.musical_params.mode}
Tempo: {self.musical_params.bpm} BPM
Style based on original prompt.

Selected Drum Sounds: {drum_names}

For EACH of the following drum sounds, create a rhythmic pattern:
{json.dumps(drum_info, indent=2)}

Each pattern MUST be a JSON array of exactly 32 boolean values (true/false), representing 16th notes over 2 bars (in 4/4 time).
'true' means the drum hits on that 16th note step, 'false' means silence.

Describe the overall feel of the drum beat you are creating and explain the role of each drum sound's pattern (e.g., kick provides the main pulse, snare hits on 2 and 4, hi-hat provides 16th note rhythm).

After your explanation, use the 'create_drum_beat' tool to provide the patterns.
"""

        try:
            # Send message asking for reasoning + tool use prompt
            await self.anthropic_client2.send_message_async(message, queue, stream=True, tools=[])

            # Send message explicitly asking for the tool use
            tool_prompt = f"Now, use the 'create_drum_beat' tool to generate the 32-step boolean patterns for each of the selected drum sounds: {drum_names}. Ensure each pattern is exactly 32 booleans long."
            _, tool_use_json = await self.anthropic_client2.send_message_async(tool_prompt, queue, stream=True, tools=[CREATE_DRUM_BEAT_TOOL])

            if not tool_use_json or 'drum_beats' not in tool_use_json:
                logger.error("Failed to get valid drum beat patterns from LLM tool use.")
                raise ValueError("LLM response did not contain valid JSON for drum beats using the tool.")

            drum_patterns = tool_use_json['drum_beats']
            logger.info(f"Received {len(drum_patterns)} drum patterns from LLM.")
            
            # Create a map of string IDs to drum samples for easier lookup
            drum_sound_map = {str(ds.id): ds for ds in selected_drums}

            logger.info(f"Drum patterns: {drum_patterns}")
            logger.info(f"Drum sound map keys: {list(drum_sound_map.keys())}")
            for beat_data in drum_patterns:
                drum_sound_id = beat_data.get('drum_sound_id')
                pattern = beat_data.get('pattern')

                if not drum_sound_id or not isinstance(pattern, list) or len(pattern) != 32:
                    logger.warning(f"Invalid drum beat data received: {beat_data}, skipping.")
                    continue
                    
                if not all(isinstance(p, bool) for p in pattern):
                    logger.warning(f"Invalid pattern format (non-boolean values) for drum sound ID {drum_sound_id}, skipping.")
                    continue

                # Check if the ID exists in our map (already as string)
                if drum_sound_id in drum_sound_map:
                    drum_sample = drum_sound_map[drum_sound_id]
                    logger.info(f"Adding drum track for {drum_sample.display_name} (ID: {drum_sound_id})")
                    await queue.action(AssistantAction.add_drum_track(
                        type=TrackType.DRUM,
                        track_data=AssistantAction.add_midi_track(
                            track=SamplerTrackRead(
                                id=uuid.uuid4(),
                                name=drum_sample.display_name,
                                instrument_id=drum_sample.id,
                                drum_sound_id=drum_sound_id,
                                drum_sound_name=drum_sample.display_name,
                                drum_sound_storage_key=drum_sample.storage_key,
                                drum_sound_kit_name=drum_sample.kit_name
                            )
                        )
                    ))
                else:
                    logger.warning(f"Drum sound ID '{drum_sound_id}' from LLM response not found in selected drums.")

            logger.info("Successfully processed and added drum tracks.")

        except Exception as e:
            logger.error(f"Error during drum beat generation: {str(e)}")
            logger.error(f"Stack trace: {traceback.format_exc()}")
            # Optionally send an error status via SSE
            await queue.error("Failed to generate drum beat.")

    async def _generate_melody(self, prompt: str, queue: SSEQueueManager):
        """Generates the melody MIDI data using an LLM."""
        logger.debug("Generating melody...")
        
        melody_instrument = next((inst for inst in self.selected_instruments if inst.role == "melody"), None)
        if not melody_instrument:
             logger.error("Cannot generate melody: No melody instrument selected.")
             return

        message = f"""Describe a suitable melody for the following description: '{prompt}'.
Consider the key ({self.musical_params.key} {self.musical_params.mode}), tempo ({self.musical_params.bpm} BPM), chord progression ({self.musical_params.chord_progression}), and the chosen melody instrument ({melody_instrument.name}). 
Describe the melody in terms of: mood, rhythm, musical style, and overall character.
Then, use the create_melody tool to generate the notes."""
        
        await self.anthropic_client2.send_message_async(message, queue, stream=True, tools=[]) 
        
        message = f"Now use the create_melody tool to generate the melody notes based on your description and the established musical parameters (Key: {self.musical_params.key} {self.musical_params.mode}, Tempo: {self.musical_params.bpm} BPM, Chord Progression: {self.musical_params.chord_progression}, Melody Instrument: {melody_instrument.name})."
        
        _, tool_use_json = await self.anthropic_client2.send_message_async(message, queue, stream=True, tools=[CREATE_MELODY_TOOL])

        if not tool_use_json:
             raise ValueError("Failed to get melody generation parameters from LLM tool use.")
             
        try:
            await self._handle_create_melody(tool_use_json, queue)
            logger.info("Successfully generated melody.")
        except Exception as e:
            logger.error(f"Error generating melody: {str(e)}", exc_info=True)
            self.musical_params.melody = None
            
    async def _handle_create_chords(self, args: Dict[str, Any] = None, queue: SSEQueueManager = None) -> Optional[Dict[str, Any]]:
        """
        Handle chord generation based on the musical parameters.
        Generate MIDI notes for the chord progression and format for client use.
        
        Args:
            args: Optional arguments (currently unused, relies on self.musical_params)
            queue: SSEQueueManager for sending updates.
            
        Returns:
            Dictionary with chord data formatted for client use, or None if failed.
        """
        key = self.musical_params.key
        mode = self.musical_params.mode
        tempo = self.musical_params.bpm
        chord_progression = self.musical_params.chord_progression
        
        if not all([key, mode, tempo, chord_progression]):
             logger.error("Cannot generate chords: Missing key, mode, tempo, or chord progression.")
             return None

        chord_instrument = next((inst for inst in self.selected_instruments if inst.role == "chords"), None)
                
        if not chord_instrument:
            logger.error("No 'chords' role instrument selected for chord progression")
            return None

        logger.info(f"Generating chord progression: '{chord_progression}' in {key} {mode} using {chord_instrument.name}")
        
        try:
            if isinstance(chord_progression, str):
                 processed_chord_progression = re.sub(r'[,\s]+', '-', chord_progression).strip('-')
            else:
                 logger.error(f"Invalid chord progression format: {chord_progression}")
                 return None

            result = transform_chord_progression_to_instrument_format(
                chord_progression=processed_chord_progression,
                instrument=chord_instrument,
                key=key
            )
            
            if not result or 'notes' not in result or not result['notes']:
                 logger.error(f"Chord transformation returned empty or invalid result for progression '{processed_chord_progression}'")
                 return None

            self.musical_params.chords = result
            
            result["part_type"] = "chords"
            result["description"] = f"Chord progression {processed_chord_progression} in {key} {mode}"
            
            # await queue.action(AssistantAction.add_midi_track(
            #     type=TrackType.MIDI,
            #     instrument_id=chord_instrument.id,
            #     notes=result.get('notes')
            # ))
            
            logger.info(f"____________notes: {result.get('notes')}")
            await queue.action(AssistantAction.add_midi_track(
                track=MidiTrackRead(
                    id=uuid.uuid4(),
                    name=chord_instrument.name,
                    instrument_id=chord_instrument.id,
                    midi_notes_json=result.get('notes'),
                    instrument_file=InstrumentFileRead(
                        id=chord_instrument.id,
                        file_name=chord_instrument.name,
                        display_name=chord_instrument.name,
                        storage_key=chord_instrument.storage_key,
                        file_format="Fix this later", #TODO: Fix this later
                        file_size=0, # TODO: Fix this later
                        category="chords",
                        is_public=True,
                        description=f"Chord progression {processed_chord_progression} in {key} {mode}"
                    )
                )
            ))
            
            logger.info(f"Generated chord progression with {len(result.get('notes', []))} notes")
            return result
            
        except Exception as e:
            logger.error(f"Error during chord transformation/MIDI generation: {str(e)}")
            logger.error(f"Stack trace: {traceback.format_exc()}")
            return None
    
    async def _handle_create_melody(self, args: Dict[str, Any], queue: SSEQueueManager) -> Optional[Dict[str, Any]]:
        """Handles the melody generation process based on LLM tool output and musical parameters."""
        
        instrument_name_llm = args.get("instrument_name", "")
        description = args.get("description", "")
        duration_beats = args.get("duration_beats", self.musical_params.duration_beats)
        duration_bars = args.get("duration_bars", self.musical_params.duration_bars)
        mood = args.get("mood", "")
        tempo_character = args.get("tempo_character", "")
        rhythm_type = args.get("rhythm_type", "")
        musical_style = args.get("musical_style", "")
        melodic_character = args.get("melodic_character", "")

        key = self.musical_params.key
        mode = self.musical_params.mode
        tempo = self.musical_params.bpm
        allowed_intervals = self.musical_params.allowed_intervals
        chord_progression = self.musical_params.chord_progression
        
        if not all([key, mode, tempo, chord_progression]):
             logger.error("Cannot generate melody: Missing key, mode, tempo, or chord progression.")
             return None

        melody_instrument = next((inst for inst in self.selected_instruments if inst.role == "melody"), None)
        if not melody_instrument:
             logger.error("Cannot generate melody: No 'melody' role instrument selected.")
             return None

        logger.info(f"Using instrument '{melody_instrument.name}' for melody generation.")
        if instrument_name_llm and instrument_name_llm != melody_instrument.name:
             logger.warning(f"LLM suggested melody instrument '{instrument_name_llm}' in create_melody tool, but using selected instrument '{melody_instrument.name}'.")

        detailed_description = f"Generate a melody for the instrument '{melody_instrument.name}'. "
        detailed_description += description
        structured_params = {
            "key": key, "mode": mode, "tempo": f"{tempo} BPM", "mood": mood,
            "tempo_character": tempo_character, "rhythm_type": rhythm_type,
            "musical_style": musical_style, "melodic_character": melodic_character,
            "chord_progression": chord_progression
        }
        detailed_description += ". Parameters: " + ", ".join(f"{k}='{v}'" for k, v in structured_params.items() if v)
        detailed_description += f". The duration should be approximately {duration_bars} bars ({duration_beats} beats)."
        detailed_description += f". Adhere strictly to the key ({key} {mode}) and follow the chord progression ({chord_progression}) closely."

        logger.info(f"Requesting melody generation with description: {detailed_description[:150]}...")
        
        try:
            allowed_intervals_string = ", ".join(map(str, allowed_intervals))
            
            system_prompt = get_melody_create_prompt(
                key, mode, tempo, allowed_intervals_string, chord_progression,
                mood, tempo_character, rhythm_type, musical_style, melodic_character, 
                duration_bars, duration_beats
            )
            self.melody_composer.set_system_prompt(system_prompt)
            
            try:
                 chord_progression_list = re.split(r'[-,\s]+', chord_progression)
                 chord_progression_list = [chord.strip().replace("b", "-") for chord in chord_progression_list if chord.strip()] 
                 note_probabilities = analyze_chord_progression(chord_progression_list, key)
                 note_probabilities_string = json.dumps(note_probabilities, indent=2)
                 logger.debug(f"Note probabilities calculated for chords: {chord_progression_list}")
            except Exception as analysis_err:
                 logger.error(f"Failed to analyze chord progression for note probabilities: {analysis_err}", exc_info=True)
                 note_probabilities_string = "{}"

            message = f"""Create the musical notes for a melody based on the following:
Description: {detailed_description}
Use this note probability data derived from the chord progression to guide note selection: 
{note_probabilities_string}

Constraints:
- Adhere strictly to the key of {key} {mode}.
- Follow the chord progression '{chord_progression}' closely.
- The output MUST be ONLY a valid JSON object representing the melody structure (e.g., bars, notes with pitch, start_beat, duration_beats).
- Do NOT include any explanatory text, comments, or markdown formatting before or after the JSON object.

Example JSON structure (adapt as needed for your expected format):
{{
  "bars": [
    {{ "bar": 1, "notes": [{{"pitch": 60, "start_beat": 0, "duration_beats": 1}}, ...] }},
    {{ "bar": 2, "notes": [...] }}
  ]
}}

Generate the JSON output now."""

            await queue.stage("Generating melody notes...", "Asking the AI composer to write the melody...")
            content_text, _ = await self.melody_composer.send_message_async(message, queue, stream=True, thinking=True)
            
            logger.debug(f"Raw melody LLM response (first 500 chars): {content_text[:500]}")
            
            melody_data = self._extract_json_from_text(content_text)
            if not melody_data:
                 logger.error("Failed to extract valid JSON melody data from the LLM response.")
                 raise ValueError("LLM response did not contain valid JSON for melody.")

            logger.info(f"Successfully parsed melody JSON data.")
            logger.debug(f"Parsed Melody Data (snippet): {json.dumps(melody_data)[:200]}...")
            
            result = transform_bars_to_instrument_format(melody_data, melody_instrument, key)
            
            if not result or 'notes' not in result or not result['notes']:
                 logger.error("Melody transformation returned empty or invalid result.")
                 return None
                 
            self.musical_params.melody = result
            
            result["part_type"] = "melody"
            result["description"] = f"Melody for {melody_instrument.name} in {key} {mode}"
            
            await queue.action(AssistantAction.add_midi_track(
                track=MidiTrackRead(
                    id=uuid.uuid4(),
                    name=melody_instrument.name,
                    instrument_id=melody_instrument.id,
                    midi_notes_json=result.get('notes'),
                    instrument_file=InstrumentFileRead(
                        id=melody_instrument.id,
                        file_name=melody_instrument.name,
                        display_name=melody_instrument.name,
                        storage_key=melody_instrument.storage_key,
                        file_format="Fix this later", #TODO: Fix this later
                        file_size=0, # TODO: Fix this later
                        category="melody",
                        is_public=True,
                        description=f"Melody for {melody_instrument.name} in {key} {mode}"
                    )
                )
            ))
            
            logger.info(f"Generated melody with {len(result.get('notes', []))} notes.")
            return result
                
        except Exception as e:
            logger.error(f"Error during melody generation: {str(e)}")
            logger.error(f"Stack trace: {traceback.format_exc()}")
            return None
            
    def _extract_json_from_text(self, text: str) -> Optional[Dict[str, Any]]:
        """
        Attempts to extract a JSON object from a string.
        Handles markdown code blocks and raw JSON.
        """
        logger.debug(f"Attempting to extract JSON from text (length {len(text)})...")
        
        json_match = re.search(r'```(?:json)?\s*({.*?})\s*```', text, re.DOTALL | re.IGNORECASE)
        if json_match:
            json_content = json_match.group(1)
            logger.debug("Found JSON within markdown code block.")
            try:
                json_content = json_content.strip()
                parsed_json = json.loads(json_content)
                logger.info("Successfully parsed JSON from markdown block.")
                return parsed_json
            except json.JSONDecodeError as e:
                logger.warning(f"Failed to parse JSON from markdown block: {e}. Content: {json_content[:100]}...")
                # Fall through to other methods

        first_brace = text.find('{')
        last_brace = text.rfind('}')
        if first_brace != -1 and last_brace != -1 and last_brace > first_brace:
            potential_json = text[first_brace:last_brace + 1]
            logger.debug("Attempting to parse content between first/last braces.")
            try:
                parsed_json = json.loads(potential_json)
                logger.info("Successfully parsed JSON between first/last braces.")
                return parsed_json
            except json.JSONDecodeError as e:
                logger.warning(f"Failed to parse JSON between first/last braces: {e}. Content: {potential_json[:100]}...")
                # Fall through

        json_regex_match = re.search(r'({[\s\S]*})', text) 
        if json_regex_match:
             potential_json = json_regex_match.group(1)
             logger.debug("Attempting to parse JSON found via greedy regex.")
             try:
                 potential_json = re.sub(r'//.*?\n|/\*.*?\*/', '', potential_json, flags=re.DOTALL)
                 parsed_json = json.loads(potential_json)
                 logger.info("Successfully parsed JSON via greedy regex.")
                 return parsed_json
             except json.JSONDecodeError as e:
                 logger.warning(f"Failed to parse JSON from greedy regex match: {e}. Content: {potential_json[:100]}...")
                 # Fall through
                 
        logger.error("Could not find or parse valid JSON in the provided text.")
        return None
        
    
    def _set_musical_params(self, key, mode, chord_progression, bpm, melody_instrument_suggestion, chords_instrument_suggestion):
        """Sets the core musical parameters."""
        self.musical_params.key = key or "C"
        self.musical_params.mode = mode or "major"
        self.musical_params.chord_progression = chord_progression or "I-V-vi-IV"
        try:
             self.musical_params.bpm = int(bpm) if bpm else 120
        except (ValueError, TypeError):
             logger.warning(f"Invalid BPM value received: {bpm}. Defaulting to 120.")
             self.musical_params.bpm = 120
             
        try:
            self.musical_params.allowed_intervals = get_mode_intervals(self.musical_params.mode)
        except ValueError as e:
             logger.warning(f"Could not determine intervals for mode '{self.musical_params.mode}': {e}. Using major scale intervals.")
             self.musical_params.allowed_intervals = get_mode_intervals("major")

        self.musical_params.melody_instrument_suggestion = melody_instrument_suggestion
        self.musical_params.chords_instrument_suggestion = chords_instrument_suggestion
        
        self.musical_params.melody = None
        self.musical_params.chords = None
        self.musical_params.counter_melody = None
        
        self.selected_instruments = []

    @staticmethod   
    def _get_stream_response(response) -> tuple[str, dict]:
        content_text = ""
        tool_use_started = False
        tool_use_data = []
        for data in response:
            if tool_use_started:
                tool_use_data.append(data)
            if hasattr(data, "delta") and hasattr(data.delta, "text"):
                chunk_text = data.delta.text
                print(chunk_text)
                if chunk_text:
                    content_text += chunk_text
                    logger.info(f"Received {len(content_text)} characters so far...")
            if data.type == "content_block_start":
                if data.content_block.type == "tool_use":
                    tool_use_started = True
                    print(data.content_block)
            if data.type == "content_block_end":
                tool_use_started = False
        print("TOOL USE DATA:", tool_use_data)
        tool_use_json = MusicGenService._parse_tool_use_data(tool_use_data)
        print("TOOL USE JSON:", tool_use_json)
        return content_text, tool_use_json
    
    @staticmethod
    def _parse_tool_use_data(tool_use_data) -> dict:
        full_json = ""
        for data in tool_use_data:
            if hasattr(data, 'delta') and hasattr(data.delta, 'partial_json'):
                full_json += data.delta.partial_json
        
        try:
            if full_json:
                return json.loads(full_json)
            return None
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse tool use JSON: {e}")
            return None

music_gen_service = MusicGenService()