import asyncio
from dataclasses import dataclass, field
import json
import os
import traceback
from typing import Any, Dict, List, Optional
import anthropic
from dotenv import load_dotenv
import logging
from app.utils.sse_queue_manager import SSEQueueManager
from app.types.assistant_actions import AssistantAction, TrackType
from services.music_gen_service.chord_progression_analysis import analyze_chord_progression
from services.soundfont_service.soundfont_service import soundfont_service
from clients.anthropic_client import AnthropicClient
from services.music_gen_service.midi import transform_bars_to_instrument_format, transform_chord_progression_to_instrument_format
from services.music_gen_service.music_utils import get_mode_intervals
from services.music_gen_service.music_gen_tools import CREATE_MELODY_TOOL, DETERMINE_MUSICAL_PARAMETERS_TOOL, SELECT_INSTRUMENTS_TOOL
from services.music_gen_service.prompt_utils import get_ai_composer_agent_initial_system_prompt, get_melody_create_prompt
from services.music_gen_service.music_researcher import MusicResearcher

load_dotenv()
logger = logging.getLogger(__name__)

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

    async def compose_music(self, prompt: str, queue: SSEQueueManager):
        
        await queue.stage("Starting research...", "Doing research online to find the best musical parameters...")
        # Run research and soundfont fetching concurrently
        research_result, chord_research_result, self.available_soundfonts = await asyncio.gather(
            self.researcher.enhance_description(prompt),
            self.researcher.research_chord_progression(prompt),
            soundfont_service.get_public_soundfonts()
        )
        #research_result, chord_research_result = "", ""
        #self.available_soundfonts = await soundfont_service.get_public_soundfonts()
        
        
        #musical_params = self.get_musical_params(description, research_result)
        #mode = await self.researcher.enhance_research(description)
        #logger.info(f"Research result: {research_result}")
        #logger.info(f"Chord research result: {chord_research_result}")
        #logger.info(f"Prompt: {prompt}")
        #logger.info(f"Available soundfonts: {self.available_soundfonts}")

        # Track conversation to build up the composition in stages
        completed = False
        max_iterations = 10
        iterations = 0

        # while not completed and iterations < max_iterations:
        iterations += 1
        logger.debug(f"Composition iteration {iterations}")
        
        
        system_prompt = get_ai_composer_agent_initial_system_prompt()
        self.anthropic_client2.set_system_prompt(system_prompt)
        message = f"""Based on this description: {prompt}

I need you to determine the musical parameters (key, mode, BPM, melody instrument, chords instrument, and chord progression). 

First, explain your reasoning for each parameter:
1. What key would work best and why?
2. What mode would complement this and why?
3. What tempo (BPM) would capture the right feel and why?
4. What chord progression would support this style and why?
5. What melody instrument would work best and why?
6. What chords instrument would work best and why?

After you've explained your choices, use the determine_musical_parameters tool to set these values.

**IMPORTANT: Explain your reasoning for each parameter before using the tool.**

Here is some research we've done on the description: {research_result} 
And here is some research we've done on the chord progression: {chord_research_result}"""
        
        # Use async method
        content_text, tool_use_json = await self.anthropic_client2.send_message_async(message, queue, stream=True, tools=[])
        message = f"""
        Now use the "determine_musical_parameters" tool to set the musical parameters for the rest of the composition.
        """
        content_text, tool_use_json = await self.anthropic_client2.send_message_async(message, queue, stream=True, tools=[DETERMINE_MUSICAL_PARAMETERS_TOOL])
        self._set_musical_params(
            tool_use_json.get("key"), 
            tool_use_json.get("mode"), 
            tool_use_json.get("chord_progression"), 
            tool_use_json.get("tempo"),
            tool_use_json.get("melody_instrument"),
            tool_use_json.get("chords_instrument")
        )
        print(self.musical_params)
        
        #queue.action(AssistantAction.change_key(value=(self.musical_params.key + self.musical_params.mode)))
        await queue.action(AssistantAction.change_bpm(value=self.musical_params.bpm))
        

        # Select instruments
        soundfont_names = [soundfont["name"] for soundfont in self.available_soundfonts]
        message = f"What kind of instruments fit the beat we are trying to make? Look through this list of available soundfonts and select the ones that you think are the best fit: {soundfont_names} IMPORTANT: Make sure to select instruments that fit well together. DO NOT select instruments that will not fit well together. You should select 2-3 instruments."
        
        # Use async method
        select_instruments_response, tool_use_json = await self.anthropic_client2.send_message_async(message, queue, stream=True, tools=[])
        print("SELECT INSTRUMENTS TOOL USE JSON:", json.dumps(tool_use_json, indent=4))
        message = f"Now select the instruments you just mentioned with the select_instruments tool."
        select_instruments_response, tool_use_json = await self.anthropic_client2.send_message_async(message, queue, stream=True, tools=[SELECT_INSTRUMENTS_TOOL])
        self.select_instruments(tool_use_json, self.available_soundfonts)
        print("MUSICAL PARAMS AFTER SELECT INSTRUMENTS:", self.musical_params)
        #print("TOOL USE JSON:", tool_use_json)
        print("SELECT INSTRUMENTS RESPONSE:", select_instruments_response)
        
        #print(self.anthropic_client2.get_messages())
        
        # Create a chord progression
        # message = f"Create a chord progression that is {self.musical_params.chord_progression} for {self.musical_params.key} {self.musical_params.mode} at {self.musical_params.bpm} BPM."
        # create_chords_response, tool_use_json = self.anthropic_client2.send_message(message, stream=True, tools=[CREATE_CHORDS_TOOL])
        # print("CREATE CHORDS RESPONSE:", create_chords_response)
        # Generate chord progression
        try:
            chords_result = await self._handle_create_chords(queue=queue)
            logger.info(f"Successfully generated chord progression")
        except Exception as e:
            logger.error(f"Error generating chord progression: {str(e)}")
            chords_result = None
        
        message = f"How would you describe a melody for the following description: {prompt} using these instruments: {soundfont_names}. Also consider the research we've done Describe the melody in these categories: instrument name (instrument that best fits what we are trying to make), description, mood, rhythm_type, musical_style, melodic_character. Use the create_melody tool to create a melody."
        
        # Use async method
        create_melody_response, tool_use_json = await self.anthropic_client2.send_message_async(message, queue, stream=True, tools=[CREATE_MELODY_TOOL])
        print("CREATE MELODY RESPONSE:", create_melody_response)
        
        await self._handle_create_melody(tool_use_json, queue)
        
        # Build the final response
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
            "time_signature": str(self.musical_params.time_signature),
            "instruments": instruments,
            "chord_progression": self.musical_params.chord_progression
        }
    
    def select_instruments(self, args: Dict[str, Any], available_soundfonts: List[Dict[str, Any]]) -> Dict[str, Any]:
        instrument_selections = args.get("instrument_selections", [])
        for soundfont in available_soundfonts:
            for instrument_selection in instrument_selections:
                if instrument_selection["instrument_name"] == soundfont["name"]:
                    self.musical_params.instruments.append(
                        Instrument(
                            id=soundfont["id"],
                            name=instrument_selection["instrument_name"],
                            description=instrument_selection["explanation"],
                            soundfont_name=soundfont["name"],
                            storage_key=soundfont["storage_key"],
                            role=instrument_selection["role"]
                        )
                    )
        print("MUSICAL PARAMS INSTRUMENTS:", self.musical_params.instruments)
                
    async def _handle_create_chords(self, args: Dict[str, Any] = None, queue: SSEQueueManager = None) -> Dict[str, Any]:
        """
        Handle chord generation based on the musical parameters.
        Generate MIDI notes for the chord progression and format for client use.
        
        Args:
            args: Optional arguments - if None, uses stored musical parameters
            
        Returns:
            Dictionary with chord data formatted for client use
        """
        key = self.musical_params.key
        mode = self.musical_params.mode
        tempo = self.musical_params.bpm
        chord_progression = self.musical_params.chord_progression
        
        # Find an appropriate instrument for chords
        chord_instrument = None
        for instrument in self.musical_params.instruments:
            if instrument.role == "chords":
                chord_instrument = instrument
                break
                
        # If no dedicated chord instrument, use the first available instrument
        if not chord_instrument and self.musical_params.instruments:
            chord_instrument = self.musical_params.instruments[0]
            logger.info(f"No dedicated chord instrument found, using {chord_instrument.get('instrument_name', 'unknown')} instead")
        
        if not chord_instrument:
            logger.error("No instruments available for chord progression")
            raise ValueError("No instruments available for chord progression")
            
        logger.info(f"Generating chord progression: {chord_progression} in {key} {mode}")
        
        try:
            if "-" not in chord_progression:
                chord_progression = chord_progression.replace(" ", "-").replace(",", "-")
            
            result = transform_chord_progression_to_instrument_format(
                chord_progression=chord_progression,
                instrument=chord_instrument,
                key=key
            )
            
            self.musical_params.chords = result
            
            result["part_type"] = "chords"
            result["description"] = f"Chord progression {chord_progression} in {key} {mode}"
            
            await queue.action(AssistantAction.add_track(
                type=TrackType.MIDI,
                instrument_id=chord_instrument.id,
                notes=result.get('notes')
            ))
            
            logger.info(f"Generated chord progression with {len(result.get('notes', []))} notes")
            return result
            
        except Exception as e:
            logger.error(f"Error in chord generation: {str(e)}")
            logger.error(f"Stack trace: {traceback.format_exc()}")
            raise ValueError(f"Failed to generate chord progression: {str(e)}")
    
    async def _handle_create_melody(self, args: Dict[str, Any], queue: SSEQueueManager) -> Dict[str, Any]:
        instrument_name = args.get("instrument_name", "")
        description = args.get("description", "")
        duration_beats = args.get("duration_beats", 16)
        duration_bars = args.get("duration_bars", 4)
        
        # Get additional musical characteristics
        mood = args.get("mood", "")
        tempo_character = args.get("tempo_character", "")
        rhythm_type = args.get("rhythm_type", "")
        musical_style = args.get("musical_style", "")
        melodic_character = args.get("melodic_character", "")
        key = self.musical_params.key
        mode = self.musical_params.mode
        tempo = self.musical_params.bpm
        
        allowed_intervals_string = ", ".join(str(interval) for interval in self.musical_params.allowed_intervals)
        chord_progression = self.musical_params.chord_progression
        
        # Build a comprehensive musical description
        detailed_description = description
        if key:
            detailed_description += f" in the key of {key}"
        if mode:
            detailed_description += f" {mode}"
        if tempo:
            detailed_description += f" at {tempo} BPM"
        if mood:
            detailed_description += f", with a {mood} mood"
        if tempo_character:
            detailed_description += f", at a {tempo_character} pace"
        if rhythm_type:
            detailed_description += f", using a {rhythm_type} rhythm"
        if musical_style:
            detailed_description += f", in a {musical_style} style"
        if melodic_character:
            detailed_description += f", with a {melodic_character} melodic character"
            
        detailed_description += f", and this piece is following a chord progression of {chord_progression} You should try to follow the chord progression closely."
        
        # Log the input for debugging
        logger.info(f"Creating melody2 for {instrument_name}: {detailed_description[:50]}...")
        
        if not self.anthropic_client:
            logger.error("Cannot generate melody: No Anthropic API key available")
            raise ValueError("No Anthropic API key available")
        
        try:
            # Generate intervals and durations based on the description
            system_prompt = get_melody_create_prompt(
                self.musical_params.key, 
                self.musical_params.mode,
                self.musical_params.bpm, 
                allowed_intervals_string, 
                self.musical_params.chord_progression, 
                mood, tempo_character, rhythm_type, musical_style, melodic_character, duration_bars, duration_beats)
            #print("system_prompt", system_prompt)
            
            self.melody_composer.set_system_prompt(system_prompt)
            chord_progression_list = chord_progression.split("-")
            for idx, chord in enumerate(chord_progression_list):
                chord_progression_list[idx] = chord.replace("b", "-")
            note_probabilities = analyze_chord_progression(chord_progression_list, key)
            note_probabilities_string = json.dumps(note_probabilities, indent=4)
            message = f"Create a melody that is {detailed_description} for {instrument_name} in the key of {key} {mode} at {tempo} BPM. Follow the chord progression: {chord_progression} as closely as possible. Use this data with note probabilities to create a melody: {note_probabilities_string}. DO NOT create notes that are out of key. IMPORTANT: Return ONLY the JSON object in your response with no text or comments before or after it. The JSON should be properly formatted and contain no comments."
            
            # Use the async method instead of the sync one
            content_text, tool_use_json = await self.melody_composer.send_message_async(message, queue, stream=True, thinking=True)
            
            # Log the raw response for debugging
            logger.debug(f"Raw melody response (first 500 chars): {content_text[:500]}")
            
            # Extract JSON from the response - look for code blocks first
            import re
            # First try to find JSON in code blocks
            json_match = re.search(r'```(?:json)?\s*(.*?)\s*```', content_text, re.DOTALL)
            
            if json_match:
                # Found JSON in code blocks
                json_content = json_match.group(1)
                logger.info(f"Extracted JSON from code blocks, length: {len(json_content)}")
                try:
                    # Remove any comments or non-JSON content that might exist in the code block
                    # First strip any lines starting with # (comments)
                    json_content = re.sub(r'(?m)^#.*$', '', json_content)
                    # Strip any text before the first {
                    json_content = re.sub(r'^[^{]*', '', json_content)
                    # Strip any text after the last }
                    json_content = re.sub(r'}[^}]*$', '}', json_content)
                    
                    logger.debug(f"Processed JSON content (first 500 chars): {json_content[:500]}")
                    melody_data = json.loads(json_content)
                    logger.info(f"Successfully parsed JSON from code block: {json.dumps(melody_data)[:200]}...")
                except json.JSONDecodeError as e:
                    logger.error(f"Failed to parse JSON from code block: {str(e)}")
                    # Try more aggressive JSON extraction before giving up
                    try:
                        json_content = re.search(r'({.*})', json_content, re.DOTALL)
                        if json_content:
                            melody_data = json.loads(json_content.group(1))
                            logger.info(f"Successfully parsed JSON with fallback method")
                        else:
                            raise ValueError("No JSON object found in response")
                    except (json.JSONDecodeError, AttributeError) as e2:
                        logger.error(f"Failed in second attempt to parse JSON: {str(e2)}")
                        raise ValueError(f"Failed to parse Claude's response from code block: {str(e)}")
            else:
                # Try to parse the raw text as JSON
                try:
                    # First try to extract just the JSON portion
                    # Look for a JSON object with {} brackets
                    json_match = re.search(r'({[\s\S]*?})(?:\s*$|\s*[^{])', content_text)
                    if json_match:
                        json_content = json_match.group(1)
                        logger.debug(f"Found JSON object with regex: {json_content[:100]}...")
                    else:
                        # Strip any text before the first {
                        json_content = re.sub(r'^[^{]*', '', content_text)
                        # Strip any text after the last }
                        json_content = re.sub(r'}[^}]*$', '}', json_content)
                    
                    # Remove any lines starting with # (comments)
                    json_content = re.sub(r'(?m)^#.*$', '', json_content)
                    
                    logger.debug(f"Processed JSON content (first 500 chars): {json_content[:500]}")
                    melody_data = json.loads(json_content)
                    logger.info(f"Generated melody data: {json.dumps(melody_data)[:200]}...")
                except json.JSONDecodeError as e:
                    logger.error(f"Failed to parse Claude's response as JSON: {content_text[:200]}")
                    logger.error(f"JSON error: {str(e)}")
                    
                    # Try one more approach - find any JSON-like structure
                    try:
                        # More aggressive pattern matching
                        potential_json = re.search(r'({[\s\S]*})(?:\s*$|\s*[^{])', content_text)
                        if potential_json:
                            json_content = potential_json.group(1)
                            # Clean it up further
                            json_content = re.sub(r'#.*?[\r\n]', '', json_content)  # Remove # comments
                            json_content = re.sub(r'//.*?[\r\n]', '', json_content) # Remove // comments
                            logger.debug(f"Last attempt JSON extraction: {json_content[:100]}...")
                            melody_data = json.loads(json_content)
                            logger.info("Successfully extracted JSON with last-resort method")
                        else:
                            raise ValueError("No valid JSON structure found in the response")
                    except Exception as e2:
                        logger.error(f"All JSON extraction attempts failed: {str(e2)}")
                        raise ValueError(f"Failed to parse Claude's response: {str(e)}")
            
            print("MELODY DATA:", melody_data)
            # Create the melody using the generated notes
            # Transform the notes into instrument format
            instrument_name_list = [instrument.name for instrument in self.musical_params.instruments]
            logger.info(f"Looking for melody instrument among {len(self.musical_params.instruments)} instruments")
            logger.info(f"Available instruments: {instrument_name_list}")
            melody_instrument = None
            for idx, instrument in enumerate(self.musical_params.instruments):
                logger.info(f"Checking instrument {idx}: {instrument.name} with role '{instrument.role}'")
                if instrument.role == "melody":
                    logger.info(f"Found melody instrument: {instrument.name}")
                    melody_instrument = instrument
                    break
            if not melody_instrument:
                logger.error(f"No instrument with role 'melody' found in {len(self.musical_params.instruments)} instruments")
                # Use first available instrument as fallback
                if self.musical_params.instruments:
                    melody_instrument = self.musical_params.instruments[0]
                    logger.info(f"Using fallback instrument: {melody_instrument.name}")
                else:
                    logger.error("No instruments available at all")
                    raise ValueError("No instruments available for melody creation")
            result = transform_bars_to_instrument_format(melody_data, melody_instrument, key)
            self.musical_params.melody = result
            print("MUSICAL PARAMS:", self.musical_params)
            await queue.action(AssistantAction.add_track(
                type=TrackType.MIDI,
                instrument_id=melody_instrument.id,
                notes=result.get('notes')
            ))
            return result
                
        except Exception as e:
            logger.error(f"Error in melody generation: {str(e)}")
            logger.error(f"Stack trace: {traceback.format_exc()}")
            raise ValueError(f"Failed to generate melody: {str(e)}")
        
    
    def _set_musical_params(self, key, mode, chord_progression, bpm, melody_instrument, chords_instrument):
        self.musical_params.key = key
        self.musical_params.chord_progression = chord_progression
        self.musical_params.mode = mode
        self.musical_params.bpm = bpm
        self.musical_params.allowed_intervals = get_mode_intervals(mode)
        self.musical_params.melody_instrument = melody_instrument
        self.musical_params.chords_instrument = chords_instrument

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
            # Only process RawContentBlockDeltaEvent events that have delta attribute
            if hasattr(data, 'delta') and hasattr(data.delta, 'partial_json'):
                full_json += data.delta.partial_json
        
        try:
            # Parse the accumulated JSON string into a Python dict
            if full_json:
                return json.loads(full_json)
            return None
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse tool use JSON: {e}")
            return None

music_gen_service = MusicGenService()