import json
from dotenv import load_dotenv
import os
import asyncio
from anthropic import Anthropic, AsyncAnthropic
import logging


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
        
    def send_message(self, message: str, stream: bool = True, tools: list[dict] = [], thinking: bool = False) -> tuple[str, dict]:
        """Synchronous version of send_message - this will block the event loop"""
        self.append_user_message(message)
        
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

        response = self.client.messages.create(**params)
        assistant_response, tool_use_json = self._get_stream_response(response)
        #self.messages.append({"role": "assistant", "content": assistant_response})
        return assistant_response, tool_use_json
        
    async def send_message_async(self, message: str, queue: asyncio.Queue, stream: bool = True, tools: list[dict] = [], thinking: bool = False) -> tuple[str, dict]:
        """Asynchronous version of send_message - this will not block the event loop"""
        self.append_user_message(message)
        
        # Log the start of the API call
        logger.info(f"Starting async API call to Anthropic with model {self.model}")
        
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
        
        logger.info(f"Completed async API call to Anthropic")
        
        return assistant_response, tool_use_json
    
    def _get_stream_response(self, response, queue) -> tuple[str, dict]:
        """Synchronous version of stream response processing"""
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
                    print(content_text)
                    queue.put(("response_chunk", {
                        "chunk": chunk_text,
                        "chunk_index": 0
                    }))
            if data.type == "content_block_start":
                if data.content_block.type == "tool_use":
                    tool_use_started = True
                    print(data.content_block)
            if data.type == "content_block_end":
                tool_use_started = False
        #print("TOOL USE DATA:", tool_use_data)
        tool_use_json = self._parse_tool_use_data(tool_use_data)
        #print("TOOL USE JSON:", tool_use_json)
        return content_text, tool_use_json
        
    async def _get_stream_response_async(self, response, queue) -> tuple[str, dict]:
        """Asynchronous version of stream response processing"""
        content_text = ""
        tool_use_started = False
        tool_use_data = []
        
        # Asynchronously iterate through the stream
        async for data in response:
            # Periodically yield control back to the event loop
            await asyncio.sleep(0)
            
            if tool_use_started:
                tool_use_data.append(data)
            if hasattr(data, "delta") and hasattr(data.delta, "text"):
                chunk_text = data.delta.text
                if chunk_text:
                    content_text += chunk_text
                    logger.debug(f"Received chunk: {chunk_text[:50]}...")
                    queue.put(("response_chunk", {
                        "chunk": chunk_text,
                        "chunk_index": 0
                    }))
            if data.type == "content_block_start":
                if data.content_block.type == "tool_use":
                    tool_use_started = True
                    logger.debug(f"Tool use started: {data.content_block}")
            if data.type == "content_block_end":
                tool_use_started = False
                logger.debug("Tool use ended")
        
        # Use the same parsing logic
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
