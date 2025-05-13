from typing import Optional, Any, Dict, Type, List, Union, AsyncGenerator, Sequence

from pydantic_ai.messages import ModelMessage

from app2.sse.sse_queue_manager import SSEQueueManager

from .history import MessageHistory, ChatMessage
from .adapters.base_adapter import ProviderAdapter
from .adapters.openai_adapter import OpenAIAdapter
from .adapters.anthropic_adapter import AnthropicAdapter
from .adapters.gemini_adapter import GeminiAdapter
# Import other adapters as they are created, e.g.:
# from .adapters.gemini_adapter import GeminiAdapter

from .config import get_provider_config
from .streaming import AnyStreamEvent, TextDeltaEvent

import json
from json_repair import repair_json


class ChatSession:
    """
    Manages a chat conversation, including history and provider interaction.
    """

    def __init__(
        self,
        provider_name: str,
        model_name: str,
        queue: SSEQueueManager,
        system_prompt: Optional[str] = None, # Will be passed to Pydantic AI Agent
        api_key: Optional[str] = None,
        base_url: Optional[str] = None,
        **provider_kwargs: Any
    ) -> None:
        """
        Initializes a new chat session.

        Args:
            provider_name: The name of the LLM provider (e.g., "openai", "anthropic").
            model_name: The specific model name to use (e.g., "gpt-4o", "claude-3-opus").
            system_prompt: An optional system prompt for the Pydantic AI agent.
            api_key: Optional API key for the provider.
            base_url: Optional base URL for the provider (e.g., for OpenAI-compatible or Ollama).
            **provider_kwargs: Additional keyword arguments to pass to the provider adapter's constructor
                                 and subsequently to the Pydantic AI provider setup.
        """
        self.message_history = MessageHistory()
        self.current_provider_name = provider_name
        self.current_model_name = model_name
        self.queue = queue
        self.current_system_prompt = system_prompt
        self.current_api_key = api_key # Store for potential re-use or if adapter needs it explicitly
        self.current_base_url = base_url
        self.current_provider_kwargs = provider_kwargs

        self.adapter: Optional[ProviderAdapter] = self._load_adapter(
            provider_name,
            model_name,
            api_key,
            base_url,
            **provider_kwargs
        )

    def _get_adapter_class(self, provider_name: str) -> Type[ProviderAdapter]:
        """
        Returns the adapter class based on the provider name.
        This acts as a simple factory.
        """
        # Normalize provider name for matching (e.g., case-insensitive)
        normalized_provider = provider_name.lower()
        
        if normalized_provider == "openai" or \
           normalized_provider.endswith("-openai-compatible") or \
           normalized_provider in ["openrouter", "grok", "perplexity", "fireworks", "together", "ollama"]:
            # Includes common OpenAI-compatible providers by name for clarity
            # and a generic suffix for others.
            return OpenAIAdapter
        elif normalized_provider == "anthropic":
            return AnthropicAdapter
        elif normalized_provider.startswith("gemini") or \
             normalized_provider == "google-gla" or \
             normalized_provider == "google-vertex":
            # ChatSession user can specify "gemini", "google-gla", or "google-vertex"
            # The GeminiAdapter itself will use original_provider_name to pick the backend.
            return GeminiAdapter
        else:
            raise ValueError(f"Unsupported provider: {provider_name}")

    def _load_adapter(
        self,
        provider_name: str,
        model_name: str,
        api_key: Optional[str] = None,
        base_url: Optional[str] = None,
        **provider_kwargs: Any
    ) -> ProviderAdapter:
        """
        Loads and initializes the appropriate provider adapter.
        """
        adapter_class = self._get_adapter_class(provider_name)
        
        # Pass original_provider_name so adapter can use it for config lookup if needed
        # e.g. Ollama using OpenAIAdapter might look for OLLAMA_BASE_URL
        kwargs_for_adapter = provider_kwargs.copy()
        kwargs_for_adapter['original_provider_name'] = provider_name 
        
        # If system_prompt is part of current_provider_kwargs, ensure it's passed
        if self.current_system_prompt and 'system_prompt' not in kwargs_for_adapter:
            kwargs_for_adapter['system_prompt'] = self.current_system_prompt

        return adapter_class(
            model_name=model_name,
            api_key=api_key,
            base_url=base_url,
            **kwargs_for_adapter
        )

    def _prepare_pydantic_ai_history(self) -> List[ModelMessage]:
        """
        Converts the internal chat history to the format expected by Pydantic AI agents,
        using the current adapter's formatting logic.
        This prepares the history *before* adding the current user prompt.
        """
        if not self.adapter:
            raise RuntimeError("Adapter not loaded.")
        return self.adapter.format_pydantic_ai_messages(self.message_history.get_messages())
    
    async def send_message_async(
        self,
        user_prompt_content: str,
        stream: bool = False,
        model_settings: Optional[Dict[str, Any]] = None,
        usage_limits: Optional[Dict[str, Any]] = None,
        expect_json: bool = False,
    ) -> Union[Any, AsyncGenerator[AnyStreamEvent, None]]:
        """
        Sends a message from the user to the LLM and gets a response, potentially streaming.

        Args:
            user_prompt_content: The text of the user's message.
            stream: Whether to stream the response. Defaults to False.
            model_settings: Optional dictionary of model-specific settings.
            usage_limits: Optional dictionary of usage limits for the request.
            expect_json: If True, will attempt to parse and repair JSON output from the LLM.

        Returns:
            If stream is False, returns the complete assistant response content.
            If stream is True, returns an async generator yielding AnyStreamEvent objects.
        """
        if not self.adapter:
            raise RuntimeError("ChatSession adapter not initialized.")

        # Prepare history for Pydantic AI *before* adding the current user message to our internal history
        # This history will be passed to the Pydantic AI agent.
        pydantic_ai_formatted_history = self._prepare_pydantic_ai_history()

        # Add the current user's message to our internal history
        self.message_history.add_message(role="user", content=user_prompt_content)

        # Get model_settings and usage_limits from session if not provided, allowing override
        final_model_settings = model_settings # or self.current_model_settings if we store them
        final_usage_limits = usage_limits # or self.current_usage_limits

        response_content_for_history: Any
        if stream:
            async def stream_wrapper() -> AsyncGenerator[AnyStreamEvent, None]:
                nonlocal response_content_for_history
                full_response_text_chunks = []
                last_yielded_text = "" # For calculating true deltas
                try:
                    async_gen = await self.adapter.send_message_async(
                        user_prompt=user_prompt_content,
                        history=pydantic_ai_formatted_history,
                        stream=True,
                        model_settings=final_model_settings,
                        usage_limits=final_usage_limits
                    )
                    if not hasattr(async_gen, '__aiter__'):
                        raise TypeError("Adapter did not return an async generator for streaming.")
                        
                    async for event in async_gen:
                        if isinstance(event, TextDeltaEvent):
                            # Adapter provides event.delta, which might be full text or true delta
                            # We will calculate the true delta to yield for streaming to frontend
                            current_chunk_from_adapter = event.delta
                            full_response_text_chunks.append(current_chunk_from_adapter) # For history, always append what adapter gave

                            actual_delta_to_yield = ""
                            if current_chunk_from_adapter.startswith(last_yielded_text):
                                actual_delta_to_yield = current_chunk_from_adapter[len(last_yielded_text):]
                            else:
                                # Discontinuity or first chunk, yield the whole current chunk from adapter as is
                                actual_delta_to_yield = current_chunk_from_adapter 
                            
                            if actual_delta_to_yield: # Only yield if there's new text
                                yield actual_delta_to_yield # Yielding the string delta
                            
                            last_yielded_text = current_chunk_from_adapter # Update tracker with the full chunk received
                        
                        # else: # Handle other event types if necessary, e.g., tool calls from adapter
                        #     yield event # Yield other event types as is

                    response_content_for_history = "".join(full_response_text_chunks)
                except Exception as e:
                    response_content_for_history = f"Error during streaming: {e}"
                    self.message_history.add_message(role="assistant", content=response_content_for_history)
                    raise
                else:
                    if full_response_text_chunks:
                         self.message_history.add_message(role="assistant", content=response_content_for_history)
            
            return stream_wrapper()
        else:
            response_content_for_history = await self.adapter.send_message_async(
                user_prompt=user_prompt_content,
                history=pydantic_ai_formatted_history,
                stream=False,
                model_settings=final_model_settings,
                usage_limits=final_usage_limits
            )
            # Add the assistant's response to our internal history
            self.message_history.add_message(role="assistant", content=response_content_for_history)
            
            print("DEBUG: response_content_for_history: ", response_content_for_history)
            if expect_json:
                try:
                    # Just test if it parses, but return the string
                    json_object = json.loads(response_content_for_history)
                    # The string response_content_for_history has successfully parsed.
                    # Whether json_object is a list or dict, response_content_for_history is the
                    # string that yielded it. This string is what we want to return.
                    # No further modification of response_content_for_history is needed here.
                    # The old problematic block for list handling is removed.
                    print(f"DEBUG: JSON loaded successfully: {response_content_for_history}")
                    return response_content_for_history
                except json.JSONDecodeError:
                    try:
                        repaired = repair_json(response_content_for_history)
                        # Test if repaired parses, but return the repaired string
                        json.loads(repaired)
                        print(f"DEBUG: Repaired JSON loaded successfully: {repaired}")
                        return repaired
                    except Exception as repair_exc:
                        print(f"JSON repair failed: {repair_exc}")
                        raise
            return response_content_for_history

    def send_message_sync(
        self,
        user_prompt_content: str,
        model_settings: Optional[Dict[str, Any]] = None,
        usage_limits: Optional[Dict[str, Any]] = None,
        expect_json: bool = False,
    ) -> Any:
        """
        Sends a message synchronously and gets a complete response.
        Streaming is not supported in the sync version.

        Args:
            user_prompt_content: The text of the user's message.
            model_settings: Optional dictionary of model-specific settings.
            usage_limits: Optional dictionary of usage limits for the request.
            expect_json: If True, will attempt to parse and repair JSON output from the LLM.

        Returns:
            The complete assistant response content.
        """
        import asyncio

        try:
            loop = asyncio.get_running_loop()
        except RuntimeError:  # No running event loop
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            return loop.run_until_complete(
                self.send_message_async(
                    user_prompt_content=user_prompt_content,
                    stream=False,
                    model_settings=model_settings,
                    usage_limits=usage_limits,
                    expect_json=expect_json
                )
            )
        else: # Existing loop
            # If called from within an async context that has a running loop,
            # but this sync function is blocking it.
            # This is a common issue. For true sync behavior in an async world,
            # one might run the async call in a separate thread.
            # However, Pydantic AI's `run_sync` for agents does something similar to this.
            return loop.run_until_complete(
                 self.send_message_async(
                    user_prompt_content=user_prompt_content,
                    stream=False,
                    model_settings=model_settings,
                    usage_limits=usage_limits,
                    expect_json=expect_json
                )
            )

    def switch_provider(
        self,
        new_provider_name: str,
        new_model_name: str,
        new_api_key: Optional[str] = None,
        new_base_url: Optional[str] = None,
        # We could also allow changing system_prompt on switch, but for now, it uses the session's current_system_prompt
        # new_system_prompt: Optional[str] = None, 
        **new_provider_kwargs: Any
    ) -> None:
        """
        Switches the LLM provider and/or model being used for the chat session.
        The existing message history is preserved.

        Args:
            new_provider_name: The name of the new LLM provider.
            new_model_name: The specific model name for the new provider.
            new_api_key: Optional API key for the new provider. If None, will try to use existing or env vars.
            new_base_url: Optional base URL for the new provider.
            **new_provider_kwargs: Additional keyword arguments for the new provider adapter.
        """
        print(f"Switching provider to {new_provider_name} with model {new_model_name}")

        # Update current provider details
        self.current_provider_name = new_provider_name
        self.current_model_name = new_model_name
        
        # If new_api_key or new_base_url are explicitly provided, they should override previous ones.
        # If they are None, the _load_adapter method (and subsequently the adapter itself)
        # will try to use any existing self.current_api_key/base_url or fetch from config.
        # So, we should update self.current_api_key and self.current_base_url if new values are given.
        if new_api_key is not None:
            self.current_api_key = new_api_key
        if new_base_url is not None:
            self.current_base_url = new_base_url
        
        # Update provider_kwargs, new ones take precedence
        self.current_provider_kwargs.update(new_provider_kwargs)

        # Load the new adapter
        # _load_adapter will use the updated self.current_ values including system_prompt
        self.adapter = self._load_adapter(
            provider_name=self.current_provider_name,
            model_name=self.current_model_name,
            api_key=self.current_api_key, # Pass the potentially updated current key
            base_url=self.current_base_url, # Pass the potentially updated current base_url
            **self.current_provider_kwargs
        )

        # The existing self.message_history is preserved and will be used by the new adapter.
        print(f"Provider switched successfully to {self.current_provider_name}.")

    # --- End of class --- 