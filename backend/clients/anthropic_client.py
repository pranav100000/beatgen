import json
from dotenv import load_dotenv
import os
import asyncio
from anthropic import Anthropic, AsyncAnthropic
import logging

from app2.sse.sse_queue_manager import SSEQueueManager


load_dotenv()
logger = logging.getLogger(__name__)

class AnthropicClient:
    def __init__(self, system_prompt: str = "", thinking: bool = False, max_tokens: int = 20000, temperature: float = 1):
        # Initialize both sync and async clients
        self.client = Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))
        self.async_client = AsyncAnthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))
        self.model = os.getenv("MODEL_ID")
        self.max_tokens = max_tokens
        self.temperature = temperature
        self.messages = []
        self.system_prompt = system_prompt
        self.thinking = thinking
        
    def set_system_prompt(self, system_prompt: str):
        self.system_prompt = system_prompt
        
    def set_thinking(self, thinking: bool):
        self.thinking = thinking
        
    def set_max_tokens(self, max_tokens: int):
        self.max_tokens = max_tokens
        
    def set_temperature(self, temperature: float):
        self.temperature = temperature
        
    def get_messages(self):
        return self.messages
        
    def append_user_message(self, message: str):
        self.messages.append({"role": "user", "content": message})
        
    def append_assistant_message(self, message: str):
        self.messages.append({"role": "assistant", "content": message})
        
        
    async def send_message_async(self, message: str, queue: SSEQueueManager, stream: bool = True, tools: list[dict] = [], thinking: bool = False) -> tuple[str, dict]:
        #print("CURRENT MESSAGES", self.messages)
        """Asynchronous version of send_message - this will not block the event loop"""
        self.append_user_message(message)
        
        # Log the start of the API call
        logger.info(f"Starting async API call to Anthropic with model {self.model} and message {message}")
        
        params = {
            "model": self.model,
            "max_tokens": self.max_tokens,
            "temperature": self.temperature,
            "messages": self.messages,
            "system": self.system_prompt,
            "stream": stream,
        }

        if tools:
            params["tools"] = tools
            params["tool_choice"] = {"type": "any"}

        if thinking:
            params["thinking"] = {
                "type": "enabled",
                "budget_tokens": 16000
            }

        # Use the async client to make the API call
        response = await self.async_client.messages.create(**params)
        
        # Process the streamed response asynchronously
        assistant_response, tool_use_json = await self._get_stream_response_async(response, queue)
        
        if assistant_response:
            self.append_assistant_message(assistant_response)
        
        logger.info(f"Completed async API call to Anthropic")
        
        return assistant_response, tool_use_json
        
    async def _get_stream_response_async(self, response, queue: SSEQueueManager) -> tuple[str, dict]:
        """Asynchronous version of stream response processing"""
        content_text = ""
        tool_use_data = []
        tool_use_started = False
        
        # For debugging
        event_types_seen = set()
        
        print("response", response)
        
        # Asynchronously iterate through the stream
        async for data in response:
            # For debugging - log the type of event
            if hasattr(data, 'type'):
                event_types_seen.add(data.type)
                logger.debug(f"Stream event type: {data.type}")
            else:
                logger.debug(f"Unknown data structure: {data}")
                
            # Handle all possible ways text might be delivered
            chunk_text = None
            
            # Check for the new format (content_block_delta with text_delta)
            if data.type == "content_block_delta" and hasattr(data, "delta"):
                if hasattr(data.delta, "type") and data.delta.type == "text_delta" and hasattr(data.delta, "text"):
                    chunk_text = data.delta.text
                # Fallback for direct text property
                elif hasattr(data.delta, "text"):
                    chunk_text = data.delta.text
            
            # Also check the old format for backward compatibility
            elif hasattr(data, "delta") and hasattr(data.delta, "text"):
                chunk_text = data.delta.text
                
            # Process text chunks from any format
            if chunk_text:
                content_text += chunk_text
                logger.debug(f"Received chunk: {chunk_text[:50]}...")
                await queue.add_chunk(chunk_text)
                
            # Handle tool use tracking
            if tool_use_started:
                tool_use_data.append(data)
                
            if data.type == "content_block_start":
                if hasattr(data, "content_block") and hasattr(data.content_block, "type") and data.content_block.type == "tool_use":
                    tool_use_started = True
                    logger.debug(f"Tool use started: {data.content_block}")
                    
            if data.type == "content_block_stop":
                tool_use_started = False
                logger.debug("Content block stopped")
                
            if data.type == "thinking_delta":
                if hasattr(data.delta, "type") and data.delta.type == "thinking_delta" and hasattr(data.delta, "thinking"):
                    chunk_text = data.delta.thinking
                # Fallback for direct text property
                elif hasattr(data.delta, "text"):
                    chunk_text = data.delta.text
                await queue.add_chunk(chunk_text)
                logger.debug(f"Thinking block delta: {data.delta}")
        # Log the event types seen during this stream processing
        logger.info(f"Event types seen in this stream: {event_types_seen}")
        
        # Parse tool use data
        tool_use_json = self._parse_tool_use_data(tool_use_data)
        
        return content_text, tool_use_json
                

    def _parse_tool_use_data(self, tool_use_data) -> dict:
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
