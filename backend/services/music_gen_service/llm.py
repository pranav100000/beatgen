# import os
# import asyncio
# import logging
# from typing import Dict, Any, Optional
# import tempfile

# from anthropic import Anthropic
# from app.mcp_service.prompts import generate_music
# from app.services.instruments import get_all_soundfonts, get_instrument_metadata

# logger = logging.getLogger(__name__)


# class LLMService:
#     """
#     Service for interacting with LLMs to generate music.
#     """

#     def __init__(
#         self, api_key: Optional[str] = None, model: str = "claude-3-sonnet-20240229"
#     ):
#         """
#         Initialize the LLM service.

#         Args:
#             api_key: Anthropic API key (or None to use environment variable)
#             model: Model ID to use
#         """
#         self.api_key = api_key or os.environ.get("ANTHROPIC_API_KEY")
#         if not self.api_key:
#             logger.warning(
#                 "No API key provided for LLM service. Set ANTHROPIC_API_KEY in environment."
#             )

#         self.model = model
#         self.client = Anthropic(api_key=self.api_key) if self.api_key else None

#     async def generate_music_instructions(
#         self,
#         description: str,
#         key: Optional[str] = None,
#         tempo: Optional[int] = None,
#         duration: Optional[int] = None,
#         genre: Optional[str] = None,
#     ) -> Dict[str, Any]:
#         """
#         Generate music instructions based on a text description.

#         Args:
#             description: Text description of the desired music
#             key: Optional musical key constraint
#             tempo: Optional tempo constraint (BPM)
#             duration: Optional duration constraint (seconds)
#             genre: Optional genre constraint

#         Returns:
#             Dictionary with detailed music generation instructions
#         """
#         # For testing without API key, return a mock response
#         if not self.client:
#             logger.warning("Using mock LLM response (no API key available)")
#             return {
#                 "title": f"Music inspired by: {description[:30]}",
#                 "tempo": tempo or 120,
#                 "key": key or "C major",
#                 "instruments": [],
#             }

#         # Create a complete prompt with all constraints
#         full_description = description
#         constraints = []

#         if key:
#             constraints.append(f"Key: {key}")
#         if tempo:
#             constraints.append(f"Tempo: {tempo} BPM")
#         if duration:
#             constraints.append(f"Duration: approximately {duration} seconds")
#         if genre:
#             constraints.append(f"Genre: {genre}")

#         if constraints:
#             full_description += "\n\nAdditional constraints:\n" + "\n".join(constraints)

#         # Get the prompt template
#         prompt = generate_music(full_description)

#         # Collect instrument metadata to help the LLM make better choices
#         instrument_info = get_instrument_metadata()
#         # Limit the number of soundfonts to avoid overwhelming the context
#         soundfonts = get_all_soundfonts()[:20]

#         # Create a prompt that includes instrument information
#         system_prompt = f"""You are AutoCompose, an AI music composer. 
# Create MIDI music based on text descriptions. 
# Use your knowledge of music theory to create high-quality compositions.

# Available instruments information:
# {instrument_info}

# Sample of available soundfonts:
# {soundfonts}
# """

#         # Call the LLM
#         try:
#             response = self.client.messages.create(
#                 model=self.model,
#                 max_tokens=4000,
#                 temperature=0.7,
#                 system=system_prompt,
#                 messages=[{"role": "user", "content": prompt}],
#             )

#             # For a real implementation, we would parse the LLM's response
#             # to extract the music description. This is a placeholder.
#             return {
#                 "title": f"Music inspired by: {description[:30]}",
#                 "tempo": tempo or 120,
#                 "key": key or "C major",
#                 "instruments": [],
#                 "llm_response": response.content[0].text,
#             }

#         except Exception as e:
#             logger.error(f"Error calling LLM API: {str(e)}")
#             # Fallback to mock response on error
#             return {
#                 "title": f"Music inspired by: {description[:30]}",
#                 "tempo": tempo or 120,
#                 "key": key or "C major",
#                 "instruments": [],
#             }

#     async def run_mcp_session(self, description: str) -> Dict[str, Any]:
#         """
#         Run a Model Context Protocol session with the model.

#         This uses our run_mcp_session.py script to generate a complete music
#         description based on the provided text.

#         Args:
#             description: Text description of the desired music

#         Returns:
#             Dictionary with results from the MCP session including a music description
#         """
#         import json
#         import os
#         import sys

#         logger.info(f"Starting MCP session for description: {description[:100]}...")

#         # Create a temporary file to store the MCP response
#         with tempfile.NamedTemporaryFile(
#             mode="w+", suffix=".json", delete=False
#         ) as tmp:
#             tmp_path = tmp.name

#             try:
#                 # Our run_mcp_session.py script path
#                 mcp_script_path = os.path.join(os.getcwd(), "run_mcp_session.py")

#                 if not os.path.exists(mcp_script_path):
#                     logger.error(f"MCP script not found at: {mcp_script_path}")
#                     raise FileNotFoundError(
#                         f"MCP script not found at: {mcp_script_path}"
#                     )

#                 # Run the MCP script, passing the description and output path
#                 logger.info(f"Running MCP script: {mcp_script_path}")

#                 cmd = [sys.executable, mcp_script_path, description, tmp_path]

#                 # Run the script as a subprocess
#                 process = await asyncio.create_subprocess_exec(
#                     *cmd, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE
#                 )

#                 stdout, stderr = await process.communicate()

#                 if process.returncode != 0:
#                     stderr_text = stderr.decode() if stderr else "Unknown error"
#                     logger.error(
#                         f"MCP script error (exit code {process.returncode}): {stderr_text}"
#                     )
#                     raise ValueError(f"MCP script failed: {stderr_text}")

#                 # Check if the output file exists
#                 if not os.path.exists(tmp_path):
#                     logger.error(f"MCP script did not create output file: {tmp_path}")
#                     raise FileNotFoundError(
#                         f"MCP script did not create output file: {tmp_path}"
#                     )

#                 # Read the output file
#                 with open(tmp_path, "r") as f:
#                     file_content = f.read()
#                     if not file_content:
#                         logger.error("MCP script output file is empty")
#                         raise ValueError("MCP script output file is empty")

#                     try:
#                         result = json.loads(file_content)
#                     except json.JSONDecodeError as e:
#                         logger.error(f"Invalid JSON in MCP script output: {e}")
#                         logger.debug(f"Output content: {file_content[:500]}")
#                         raise ValueError(f"Invalid JSON in MCP script output: {e}")

#                 # Validate result structure
#                 if "status" not in result:
#                     logger.error("MCP script output missing 'status' field")
#                     raise ValueError("MCP script output missing 'status' field")

#                 if result["status"] != "success":
#                     logger.error(
#                         f"MCP script reported error: {result.get('error', 'Unknown error')}"
#                     )
#                     raise ValueError(
#                         f"MCP script error: {result.get('error', 'Unknown error')}"
#                     )

#                 if "music_description" not in result:
#                     logger.error("MCP script output missing 'music_description' field")
#                     raise ValueError(
#                         "MCP script output missing 'music_description' field"
#                     )

#                 # Verify music_description structure
#                 music_description = result["music_description"]

#                 # These are the essential fields for a valid music description
#                 required_fields = ["title", "tempo", "instruments"]
#                 for field in required_fields:
#                     if field not in music_description:
#                         logger.error(
#                             f"Music description missing required field: {field}"
#                         )
#                         raise ValueError(
#                             f"Music description missing required field: {field}"
#                         )

#                 # Check if we have any instruments
#                 if not music_description["instruments"]:
#                     logger.warning("Music description has empty instruments list")

#                 # Log what was generated
#                 logger.info(
#                     f"Generated music description: {music_description['title']}"
#                 )
#                 logger.info(
#                     f"Number of instruments: {len(music_description.get('instruments', []))}"
#                 )

#                 return result

#             except Exception as e:
#                 logger.error(f"Error running MCP session: {str(e)}")
#                 # Return error information plus a minimal valid music description
#                 # so the API won't crash completely
#                 return {
#                     "status": "error",
#                     "error": str(e),
#                     "music_description": {
#                         "title": f"Error generating music from: {description[:30]}",
#                         "tempo": 120,
#                         "key": "C major",
#                         "time_signature": [4, 4],
#                         "instruments": [],
#                     },
#                 }
#             finally:
#                 # Clean up the temporary file
#                 if os.path.exists(tmp_path):
#                     try:
#                         # Just for debugging, keep the file for now
#                         pass  # os.unlink(tmp_path)
#                     except Exception as e:
#                         logger.warning(
#                             f"Failed to delete temporary file {tmp_path}: {e}"
#                         )


# # Create a singleton instance
# llm_service = LLMService()

# # Export functions for easier access
# generate_music_instructions = llm_service.generate_music_instructions
# run_mcp_session = llm_service.run_mcp_session
