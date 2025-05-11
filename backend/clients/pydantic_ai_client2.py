import os
import logging
from typing import Type, TypeVar, Optional, List, Dict, Any, Generic, Callable, Awaitable, AsyncIterator, Union
from dataclasses import dataclass

from pydantic import BaseModel
from pydantic_ai import Agent, RunContext
# from pydantic_ai.streaming import Partial # Previous attempt, ModuleNotFoundError
# TODO: Find the correct import path for Partial based on the pydantic-ai version

# from pydantic_ai.types import Partial # This was causing ModuleNotFoundError
# Uncomment exception imports for proper error handling
from pydantic_ai.exceptions import UserError, ModelHTTPError, AgentRunError

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
        # Fix the type assignment
        self.deps_type = deps_type if deps_type else DefaultAgentDependencies
        self.llm_init_kwargs = llm_init_kwargs or {}

        agent_params: Dict[str, Any] = {
            "model": self.model_id,
            "system_prompt": self._system_prompt_content,
            **self.llm_init_kwargs,
        }
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
        Updates the system prompt and re-initializes the agent.
        """
        logger.info(f"System prompt changed. Re-initializing PydanticAI Agent.")
        self._system_prompt_content = system_prompt
        
        # Re-initialize the agent with the new system prompt
        agent_params: Dict[str, Any] = {
            "model": self.model_id,
            "system_prompt": self._system_prompt_content,
            **self.llm_init_kwargs,
        }
        agent_params["deps_type"] = self.deps_type
        
        # Improved tool preservation logic
        existing_tools = []
        if hasattr(self.agent, 'tools'):
            for tool_name, tool in self.agent.tools.items():
                if hasattr(tool, 'fn'):
                    existing_tools.append(tool.fn)
                else:
                    existing_tools.append(tool)

        self.agent = Agent(**agent_params) # type: ignore
        
        # Re-register tools
        for tool_func in existing_tools:
            try:
                self.register_tool(tool_func)
            except Exception as e:
                logger.error(f"Failed to re-register tool: {str(e)}")

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

    # Add method to format conversation history for the agent
    def _prepare_conversation_history(self) -> List[Dict[str, str]]:
        """
        Converts internal message history to a format suitable for the Agent.
        Customize based on PydanticAI's specific requirements.
        """
        formatted_messages = []
        for msg in self.messages:
            content = msg["content"]
            if isinstance(content, dict) or isinstance(content, list):
                # Convert complex objects to string if needed
                formatted_content = str(content)
            else:
                formatted_content = content
            
            formatted_messages.append({
                "role": msg["role"],
                "content": formatted_content
            })
        return formatted_messages

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
        try:
            if message:
                self.append_user_message(message)

            # Find the last user message for the query
            query_message_content = None
            for msg in reversed(self.messages):
                if msg["role"] == "user":
                    query_message_content = msg["content"]
                    break
            
            if not query_message_content:
                raise ValueError("No user message available to send as query. Please provide a message or ensure history has a user message.")

            current_output_type = response_model or self.default_output_type
            final_llm_run_kwargs = llm_run_kwargs or {}
            
            # Get conversation history - Uncomment and adapt if PydanticAI supports it
            # conversation_history = self._prepare_conversation_history()
            
            run_args: Dict[str, Any] = {}
            if deps:
                run_args["deps"] = deps
            
            # output_type is only for non-streaming .run() method.
            if current_output_type and not stream: 
                run_args["output_type"] = current_output_type
            
            # If the agent supports conversation history:
            # run_args["messages"] = conversation_history
            
            logger.info(
                f"Running PydanticAI agent query: '{str(query_message_content)[:50]}...'. "
                f"Model: {self.model_id}. "
                f"Expecting: {current_output_type.__name__ if current_output_type else 'text'}. "
                f"Stream: {stream}. LLM run kwargs: {final_llm_run_kwargs}"
            )

            if stream and queue:
                try:
                    # Make a copy of llm_run_kwargs to modify for run_stream if needed
                    stream_kwargs = final_llm_run_kwargs.copy()
                    if "retries" in stream_kwargs: # run_stream might not support retries
                        del stream_kwargs["retries"]
                        logger.debug("Removed 'retries' from kwargs for run_stream call.")

                    # Explicitly handle deps for run_stream if it's in run_args
                    current_deps = run_args.get("deps")
                    
                    # Agent.run_stream() is likely an async context manager
                    async_cm = None
                    if current_deps:
                        async_cm = self.agent.run_stream(
                            query_message_content, deps=current_deps, **stream_kwargs 
                        )
                    else:
                        async_cm = self.agent.run_stream(
                            query_message_content, **stream_kwargs
                        )
                    
                    text_accumulator: List[str] = []
                    final_streamed_object: Any = None

                    async with async_cm as run_result: # run_result is likely StreamedRunResult
                        # We need to iterate over an attribute of run_result that is an async iterable
                        # Trying run_result.events as a common convention
                        async for chunk in run_result.events: 
                            logger.debug(f"Stream chunk type: {type(chunk)}, content: {str(chunk)[:100]}")
                            try:
                                # TODO: Ensure Partial is correctly imported if this logic is to be used
                                # if isinstance(chunk, Partial): 
                                #     await queue.add_chunk(chunk.model_dump_json()) 
                                #     final_streamed_object = chunk
                                if isinstance(chunk, BaseModel): # Check for BaseModel first
                                    await queue.add_chunk(chunk.model_dump_json())
                                    final_streamed_object = chunk
                                elif isinstance(chunk, list): # list of BaseModels
                                    processed_list = []
                                    for item in chunk:
                                        if isinstance(item, BaseModel):
                                            await queue.add_chunk(item.model_dump_json())
                                            processed_list.append(item)
                                        else:
                                            await queue.add_chunk(str(item))
                                            processed_list.append(str(item))
                                    final_streamed_object = processed_list
                                else:  # Plain string chunk
                                    chunk_str = str(chunk)
                                    await queue.add_chunk(chunk_str)
                                    text_accumulator.append(chunk_str)
                            except Exception as e:
                                logger.error(f"Error processing stream chunk: {e}")
                                await queue.add_chunk(f"Error processing stream chunk: {str(e)}")
                    
                    await queue.add_chunk(None)  # Signal end of message for SSE

                    if final_streamed_object:
                        self.append_assistant_message(final_streamed_object)
                        return final_streamed_object # type: ignore
                    else:
                        assistant_response_text = "".join(text_accumulator)
                        self.append_assistant_message(assistant_response_text)
                        return assistant_response_text
                except Exception as e:
                    error_msg = f"Streaming error: {str(e)}"
                    logger.error(error_msg)
                    if queue:
                        await queue.add_chunk(error_msg)
                        await queue.add_chunk(None)
                    raise
            else:  # Non-streaming
                # For non-streaming, self.agent is used, and run_args CAN contain 'output_type'
                # and final_llm_run_kwargs can contain 'retries' if supported by .run()
                result = await self.agent.run(
                    query_message_content, **run_args, **final_llm_run_kwargs
                )
                output_data = result.output
                self.append_assistant_message(output_data)

                if queue:
                    if isinstance(output_data, BaseModel):
                        await queue.add_chunk(output_data.model_dump_json())
                    elif isinstance(output_data, list):
                        for item in output_data:
                            await queue.add_chunk(item.model_dump_json() if isinstance(item, BaseModel) else str(item))
                    else:
                        await queue.add_chunk(str(output_data))
                    await queue.add_chunk(None)
                return output_data # type: ignore
        except UserError as e:
            error_msg = f"User error: {str(e)}"
            logger.error(error_msg)
            if queue:
                await queue.add_chunk(error_msg)
                await queue.add_chunk(None)
            raise
        except ModelHTTPError as e:
            error_msg = f"Model error: {str(e)}"
            logger.error(error_msg)
            if queue:
                await queue.add_chunk(error_msg)
                await queue.add_chunk(None)
            raise
        except AgentRunError as e:
            error_msg = f"LLM agent run error: {str(e)}"
            logger.error(error_msg)
            if queue:
                await queue.add_chunk(error_msg)
                await queue.add_chunk(None)
            raise
        except Exception as e:
            error_msg = f"Unexpected error: {str(e)}"
            logger.error(error_msg)
            if queue:
                await queue.add_chunk(error_msg)
                await queue.add_chunk(None)
            raise

    def register_tool(self, tool_func: Callable[..., Awaitable[Any]]):
        """
        Registers an async tool function with the PydanticAI agent.
        The tool's docstring and type hints are used to generate its schema for the LLM.
        If the tool needs dependencies, its first argument should be `ctx: RunContext[YourDepsType]`.
        """
        try:
            self.agent.tool(tool_func)
            logger.info(f"Registered tool: {getattr(tool_func, '__name__', 'N/A')}")
        except Exception as e:
            logger.error(f"Failed to register tool {getattr(tool_func, '__name__', 'N/A')}: {str(e)}")
            raise

    def get_model_id(self) -> str:
        return self.model_id