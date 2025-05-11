import os
import logging
from typing import Type, TypeVar, Optional, List, Dict, Any, Generic, Callable, Awaitable, AsyncIterator, Union
from dataclasses import dataclass

from pydantic import BaseModel
from pydantic_ai import Agent, RunContext
# from pydantic_ai.exceptions import UserError, ModelError, LLMError # For more specific error handling

# Assuming SSEQueueManager is correctly imported from your project structure
from app2.sse.sse_queue_manager import SSEQueueManager

logger = logging.getLogger(__name__)

# Define generic types
Dependencies = TypeVar("Dependencies")
ResponseModelType = TypeVar("ResponseModelType", bound=BaseModel)

# Example placeholder for dependencies if your tools/prompts need them
@dataclass
class DefaultAgentDependencies:
    pass


class PydanticAgentWrapper(Generic[Dependencies]):
    def __init__(
        self,
        model_id: str,  # e.g., "anthropic:claude-3-opus-20240229", "openai:gpt-4o"
        system_prompt: str = "",
        default_output_type: Optional[Type[BaseModel]] = None,
        deps_type: Optional[Type[Dependencies]] = None,
        initial_tools: Optional[List[Callable[..., Awaitable[Any]]]] = None,
        # Kwargs for the LLM __init__ via PydanticAI Agent constructor (e.g., temperature, max_tokens for some models)
        llm_init_kwargs: Optional[Dict[str, Any]] = None,
    ):
        self.model_id = model_id
        self._system_prompt_content = system_prompt
        self.default_output_type = default_output_type
        self.deps_type = deps_type if deps_type else Type[DefaultAgentDependencies] # Provide a default if None
        self.llm_init_kwargs = llm_init_kwargs or {}

        agent_params: Dict[str, Any] = {
            "model": self.model_id,
            "system_prompt": self._system_prompt_content,
            **self.llm_init_kwargs,
        }
        if self.default_output_type:
            agent_params["output_type"] = self.default_output_type
        
        # PydanticAI Agent[Deps, Out] - Deps must be provided if tools use RunContext[Deps]
        # If no specific deps_type is given, it might default or we should provide a placeholder
        agent_params["deps_type"] = self.deps_type

        self.agent: Agent[Dependencies, Any] = Agent(**agent_params) # type: ignore

        if initial_tools:
            for tool_func in initial_tools:
                self.register_tool(tool_func)

        self.messages: List[Dict[str, Any]] = []
        logger.info(
            f"PydanticAgentWrapper initialized for model: {self.model_id} "
            f"with system prompt: '{system_prompt[:50]}...'"
        )

    def set_system_prompt(self, system_prompt: str):
        """
        Updates the system prompt.
        Note: For PydanticAI.Agent, if the system_prompt is a static string,
        changing it after initialization might require re-creating the Agent instance
        or ensuring the Agent uses this updated prompt in its subsequent calls.
        This implementation updates a local copy and re-initializes the agent.
        Alternatively, use a dynamic system prompt function with the agent.
        """
        logger.info(f"System prompt changed. Re-initializing PydanticAI Agent.")
        self._system_prompt_content = system_prompt
        # Re-initialize the agent with the new system prompt
        agent_params: Dict[str, Any] = {
            "model": self.model_id,
            "system_prompt": self._system_prompt_content,
            **self.llm_init_kwargs,
        }
        if self.default_output_type:
            agent_params["output_type"] = self.default_output_type
        agent_params["deps_type"] = self.deps_type
        
        # Preserve registered tools
        existing_tools = list(self.agent.tools.values()) if self.agent and hasattr(self.agent, 'tools') else []

        self.agent = Agent(**agent_params) # type: ignore
        for tool_func in existing_tools:
            self.register_tool(tool_func.fn if hasattr(tool_func, 'fn') else tool_func) # tool_func might be a Tool object


    def append_user_message(self, content: str):
        self.messages.append({"role": "user", "content": content})

    def append_assistant_message(self, content: Any):
        if isinstance(content, BaseModel):
            # Storing as dict for broader compatibility if messages are passed around
            self.messages.append({"role": "assistant", "content": content.model_dump()})
        elif isinstance(content, list) and all(isinstance(item, BaseModel) for item in content):
             self.messages.append({"role": "assistant", "content": [item.model_dump() for item in content]})
        else:
            self.messages.append({"role": "assistant", "content": str(content)})

    def get_messages(self) -> List[Dict[str, Any]]:
        return self.messages

    def clear_messages(self):
        self.messages = []
        logger.info("Conversation history cleared.")

    async def send_message_async(
        self,
        message: Optional[str] = None,
        response_model: Optional[Type[ResponseModelType]] = None,
        deps: Optional[Dependencies] = None,
        # Kwargs for the LLM run method (e.g., anthropic's "thinking")
        llm_run_kwargs: Optional[Dict[str, Any]] = None,
        queue: Optional[SSEQueueManager] = None,
        stream: bool = False,
    ) -> Union[ResponseModelType, str, List[ResponseModelType]]:
        if message:
            self.append_user_message(message)

        if not self.messages or self.messages[-1]["role"] != "user":
            # This can happen if only append_assistant_message was called prior, or empty history.
            # PydanticAI.run expects a user query.
            # We will use the *last* user message from history for the query.
            # If `message` was provided, it's already appended.
             pass


        # Find the last user message to use as the query for PydanticAI Agent.run()
        query_message_content = None
        for msg in reversed(self.messages):
            if msg["role"] == "user":
                query_message_content = msg["content"]
                break
        
        if not query_message_content:
            # This case should ideally be prevented by ensuring a user message exists.
            # If `message` arg was None and history is empty or only has assistant messages.
            raise ValueError("No user message available to send as query. Please provide a message or ensure history has a user message.")


        current_output_type = response_model or self.default_output_type
        final_llm_run_kwargs = llm_run_kwargs or {}

        # Prepare run_args: output_type is only for non-streaming .run()
        # For .run_stream(), the agent instance itself must be configured.
        run_args: Dict[str, Any] = {}
        if deps:
            run_args["deps"] = deps
        
        if current_output_type and not stream: 
            run_args["output_type"] = current_output_type
        
        logger.info(
            f"Running PydanticAI agent query: '{str(query_message_content)[:50]}...'. "
            f"Model: {self.model_id}. "
            f"Expecting: {current_output_type.__name__ if current_output_type else 'text'}. "
            f"Stream: {stream}. LLM run kwargs: {final_llm_run_kwargs}"
        )

        if stream and queue:
            agent_for_stream = self.agent
            agent_output_type_configured = self.default_output_type # What self.agent is typically configured with

            # Determine if a temporary agent with a specific output_type is needed for this stream
            needs_temp_agent = False
            if current_output_type is not None:
                if current_output_type != agent_output_type_configured:
                    needs_temp_agent = True
            # If current_output_type is None, but agent_output_type_configured is not,
            # it means we want plain text stream, but agent might be default configured for a model.
            # However, pydantic-ai agent with output_type=None should stream text.
            # The main case for temp agent is when current_output_type (from response_model) is a specific
            # model that differs from self.default_output_type.

            if needs_temp_agent:
                logger.info(f"Creating temporary PydanticAI Agent for streaming with output_type: {current_output_type.__name__}")
                temp_agent_params: Dict[str, Any] = {
                    "model": self.model_id,
                    "system_prompt": self._system_prompt_content, # Current system prompt
                    "output_type": current_output_type,         # Crucial: set desired output type
                    "deps_type": self.deps_type,
                    **self.llm_init_kwargs,
                }
                # Create the temporary agent
                temp_agent: Agent[Dependencies, Any] = Agent(**temp_agent_params) # type: ignore
                
                # Copy tools from the main agent to the temporary agent
                if hasattr(self.agent, 'tools') and self.agent.tools:
                    for tool_obj in self.agent.tools.values(): # self.agent.tools.values() are Tool objects
                        if hasattr(tool_obj, 'fn'):
                            temp_agent.tool(tool_obj.fn) # Register the original function
                        else:
                            logger.warning(f"Could not transfer tool to temporary agent: {tool_obj}")
                agent_for_stream = temp_agent
            
            # Call run_stream on the appropriately configured agent (self.agent or temp_agent)
            # **run_args here should NOT contain 'output_type' as run_stream doesn't take it.
            # The 'deps' argument is fine if run_stream supports it (pydantic-ai docs needed or test).
            # Assuming 'deps' is fine for run_stream, if not, it should also be excluded from run_args when stream=True.
            # For now, we assume 'deps' is okay based on the generic run_args preparation.
            stream_iterator = agent_for_stream.run_stream(
                query_message_content, **run_args, **final_llm_run_kwargs # output_type is not in run_args if stream=True
            )
            
            # Accumulator for text if the stream yields strings or for reconstructing partials
            text_accumulator: List[str] = []
            final_streamed_object: Any = None 

            async for chunk in stream_iterator:
                logger.debug(f"Stream chunk type: {type(chunk)}, content: {str(chunk)[:100]}")
                if isinstance(chunk, Partial):
                    # For partial Pydantic objects, send the partial JSON.
                    # The client-side would need to handle reconstruction or display updates.
                    # PydanticAI aims to yield the full object at the end too.
                    await queue.add_chunk(chunk.model_dump_json()) 
                    # final_streamed_object = chunk # A Partial object, wait for full
                elif isinstance(chunk, BaseModel):
                    await queue.add_chunk(chunk.model_dump_json())
                    final_streamed_object = chunk # This is likely the full object
                elif isinstance(chunk, list): # list of BaseModels
                    processed_list = []
                    for item in chunk:
                        if isinstance(item, BaseModel):
                            await queue.add_chunk(item.model_dump_json())
                            processed_list.append(item)
                        else: # Should not happen if output_type is List[BaseModel]
                            await queue.add_chunk(str(item))
                            processed_list.append(str(item))
                    final_streamed_object = processed_list
                else:  # Plain string chunk
                    chunk_str = str(chunk)
                    await queue.add_chunk(chunk_str)
                    text_accumulator.append(chunk_str)
            
            await queue.add_chunk(None)  # Signal end of message for SSE

            if final_streamed_object: # A Pydantic model (or list) was fully streamed
                self.append_assistant_message(final_streamed_object)
                return final_streamed_object # type: ignore
            else: # Text response accumulated
                assistant_response_text = "".join(text_accumulator)
                self.append_assistant_message(assistant_response_text)
                return assistant_response_text
        else:  # Non-streaming
            # For non-streaming, self.agent is used, and run_args CAN contain 'output_type'
            result = await self.agent.run(
                query_message_content, **run_args, **final_llm_run_kwargs
            )
            output_data = result.output # This will be PydanticModel or str
            self.append_assistant_message(output_data)

            if queue: # Send the single final response if queue is provided
                if isinstance(output_data, BaseModel):
                    await queue.add_chunk(output_data.model_dump_json())
                elif isinstance(output_data, list):
                     for item in output_data:
                         await queue.add_chunk(item.model_dump_json() if isinstance(item, BaseModel) else str(item))
                else:
                    await queue.add_chunk(str(output_data))
                await queue.add_chunk(None)
            return output_data # type: ignore

    def register_tool(self, tool_func: Callable[..., Awaitable[Any]]):
        """
        Registers an async tool function with the PydanticAI agent.
        The tool's docstring and type hints are used to generate its schema for the LLM.
        If the tool needs dependencies, its first argument should be `ctx: RunContext[YourDepsType]`.
        """
        self.agent.tool(tool_func)
        logger.info(f"Registered tool: {getattr(tool_func, '__name__', 'N/A')}")

    def get_model_id(self) -> str:
        return self.model_id
