# import json
# import os
# import logging
# from typing import Type, TypeVar, Tuple, Optional, Dict, Any, List

# import instructor
# from anthropic import Anthropic, AsyncAnthropic
# from dotenv import load_dotenv
# from pydantic import BaseModel

# from app2.sse.sse_queue_manager import SSEQueueManager

# # --- Type Variables --- 
# # Define a TypeVar for Pydantic models used in response_model
# T = TypeVar("T", bound=BaseModel)

# load_dotenv()
# logger = logging.getLogger(__name__)


# class InstructorAnthropicClient:
#     """ 
#     An Anthropic client patched with `instructor` for reliable structured 
#     output (Pydantic models) and tool use, supporting asynchronous streaming.
#     """

#     def __init__(
#         self,
#         system_prompt: str = "",
#         max_tokens: int = 4096, # Default max_tokens for Claude 3.5 Sonnet
#         temperature: float = 0.7, # Adjusted default temperature 
#     ):
#         self.api_key = os.getenv("ANTHROPIC_API_KEY")
#         if not self.api_key:
#             raise ValueError("ANTHROPIC_API_KEY environment variable not set.")
        
#         self.model = os.getenv("MODEL_ID", "claude-3-5-sonnet-20240620") # Default model
#         self.max_tokens = max_tokens
#         self.temperature = temperature
#         self.messages: List[Dict[str, Any]] = []
#         self.system_prompt = system_prompt

#         # Initialize and patch the async client for instructor
#         # Use ANTHROPIC_TOOLS mode for tool_use/response_model integration
#         # self.async_client = instructor.patch(
#         #     AsyncAnthropic(api_key=self.api_key),
#         #     mode=instructor.Mode.ANTHROPIC_TOOLS 
#         # )
#         self.async_client = instructor.from_anthropic(
#             AsyncAnthropic(api_key=self.api_key),
#             mode=instructor.Mode.ANTHROPIC_TOOLS # Revert back to TOOLS mode
#         )
#         # Note: Sync client is not initialized/patched as primary use case is async

#     def set_system_prompt(self, system_prompt: str):
#         self.system_prompt = system_prompt

#     def set_max_tokens(self, max_tokens: int):
#         self.max_tokens = max_tokens

#     def set_temperature(self, temperature: float):
#         self.temperature = temperature

#     def get_messages(self) -> List[Dict[str, Any]]:
#         return self.messages

#     def clear_messages(self):
#         self.messages = []

#     def append_user_message(self, message: str):
#         self.messages.append({"role": "user", "content": message})

#     def append_assistant_message(self, message: str):
#         # TODO: Handle potential tool calls if appending assistant message with them
#         self.messages.append({"role": "assistant", "content": message})

#     async def send_message_async(
#         self,
#         message: str,
#         queue: SSEQueueManager,
#         response_model: Optional[Type[T]] = None,
#         max_retries: int = 1,
#     ) -> Tuple[str, Optional[T]]:
#         """
#         Sends a message asynchronously.
#         - If response_model is provided, call is NON-STREAMING to ensure correct 
#           parsing by instructor, and full text is sent to queue afterwards.
#         - If response_model is None, call is STREAMING, and text chunks are sent 
#           to queue during generation.

#         Args:
#             message: The user message content.
#             queue: The SSEQueueManager for streaming/sending text chunks.
#             response_model: The Pydantic model to structure the response (optional).
#             max_retries: Number of retries if response validation fails (if response_model is used).

#         Returns:
#             A tuple containing:
#                 - The full assistant text response (string).
#                 - An instance of the response_model if requested and successful, otherwise None.
#         """
#         self.append_user_message(message)

#         logger.info(
#             f"Starting async API call to Anthropic (model: {self.model}, response_model: {response_model.__name__ if response_model else 'None'})"
#         )
#         logger.debug(f"Current messages: {self.messages}")
#         logger.debug(f"System prompt: {self.system_prompt}")

#         params = {
#             "model": self.model,
#             "max_tokens": self.max_tokens,
#             "temperature": self.temperature,
#             "messages": self.messages,
#             "system": self.system_prompt,
#             # stream parameter will be set conditionally
#         }

#         model_instance: Optional[T] = None
#         full_text_response = ""

#         try:
#             if response_model:
#                 # --- Non-Streaming Call for Structured Output --- 
#                 logger.debug("Executing NON-STREAMING call with response_model.")
#                 params["stream"] = False
#                 params["response_model"] = response_model
#                 params["max_retries"] = max_retries

#                 # instructor should return the validated model directly here
#                 model_instance = await self.async_client.messages.create(**params) 

#                 # We need to extract the text content from the response separately.
#                 # The returned object should ideally be the model, but instructor
#                 # might attach the raw response. Let's check common attributes.
#                 raw_message = None
#                 if hasattr(model_instance, "_raw_response"): # Check if instructor attached it
#                      raw_message = model_instance._raw_response
#                 elif isinstance(model_instance, BaseModel) and not hasattr(model_instance, 'content'):
#                     # It might just be the model, need separate call or different handling? Let's assume _raw_response for now
#                     logger.warning("Could not find raw response attached to model instance.")
                
#                 if raw_message and hasattr(raw_message, 'content') and isinstance(raw_message.content, list):
#                     for block in raw_message.content:
#                          if hasattr(block, 'text'):
#                               full_text_response += block.text
#                 else:
#                     # Fallback or log warning if text cannot be extracted
#                     logger.warning("Could not extract full text response from non-streaming call.")
#                     # full_text_response = "[Structured data received, text not extracted]"
                
#                 if isinstance(model_instance, response_model):
#                     logger.info(f"Successfully received structured response: {response_model.__name__}")
#                 else:
#                     logger.error(f"Non-streaming call did not return expected model type {response_model.__name__}, got {type(model_instance)}")
#                     # It might be the raw Message object containing the model in a tool_use block? Needs inspection.
#                     model_instance = None # Set to None if not the expected model directly

#                 # Send the full text to the queue *after* the call
#                 if full_text_response:
#                     await queue.add_chunk(full_text_response)

#             else:
#                 # --- Streaming Call for Text Output --- 
#                 logger.debug("Executing STREAMING call.")
#                 params["stream"] = True
#                 response_stream = await self.async_client.messages.create(**params)

#                 async for chunk in response_stream:
#                     chunk_text = None
#                     if chunk.type == "content_block_delta" and chunk.delta.type == "text_delta":
#                         chunk_text = chunk.delta.text
#                     elif chunk.type == "message_delta" and hasattr(chunk.delta, 'text'): 
#                          chunk_text = chunk.delta.text
                    
#                     if chunk_text:
#                         full_text_response += chunk_text
#                         await queue.add_chunk(chunk_text) # Send chunks during stream
                
#                 # No model instance expected in this case
#                 model_instance = None

#             # Append the full text response from the assistant to messages history
#             if full_text_response:
#                 self.append_assistant_message(full_text_response)

#             logger.info("Completed async API call to Anthropic.")
#             return full_text_response, model_instance # Return text and optional model

#         except Exception as e:
#             logger.error(f"Error during Anthropic API call: {e}", exc_info=True)
#             await queue.error(f"Error generating response: {e}")
#             return "", None # Return empty text and None model on error

# # Optional: Define a simple factory function if needed elsewhere
# _instructor_client_instance: Optional[InstructorAnthropicClient] = None

# def get_instructor_client() -> InstructorAnthropicClient:
#     global _instructor_client_instance
#     if _instructor_client_instance is None:
#         _instructor_client_instance = InstructorAnthropicClient()
#     return _instructor_client_instance
