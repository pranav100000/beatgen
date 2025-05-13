# Music Generation Service

This directory contains the components for a music generation service.
It is designed to be integrated with the main `pydantic_ai_wrapper` by exposing its functionalities as Pydantic AI tools.

## Key Components:

- `llm_schemas.py`: Defines Pydantic models for structured data exchange with the Language Model (LLM) at various stages of music creation (e.g., determining musical parameters, selecting instruments, generating melody/drum patterns).
- `music_gen_service3.py` (and older versions): Contains the core orchestration logic for music composition. It uses an LLM to make decisions and generate musical ideas in a step-by-step process.
- `music_researcher.py`: A utility to fetch or generate contextual information to aid the LLM in its creative process.
- `midi2.py`, `music_utils.py`, `chord_progression_analysis.py`: Utility modules for MIDI manipulation, music theory calculations, and analysis.
- `prompt_utils.py`: Helper functions for generating prompts for the LLM.
- `music_gen_tools.py`: (Potentially older style) Defines LLM tools as JSON schemas. The newer approach in `llm_schemas.py` with Pydantic models is preferred for integration with `pydantic-ai`.

## Integration with `pydantic_ai_wrapper`:

The core idea is to create a `MusicGenerationAgent` within the `pydantic_ai_wrapper`. This agent will have one or more tools (e.g., a `compose_song` tool) that encapsulate the music generation pipeline.

The `compose_song` tool will:
1.  Receive a user prompt (e.g., "create a happy birthday song in a lo-fi style").
2.  Internally orchestrate a series of calls to the LLM (via the Pydantic AI agent's capabilities) to:
    *   Determine musical parameters (key, tempo, mode, chord progression idea).
    *   Select appropriate instruments (soundfonts).
    *   Generate a chord sequence based on the LLM's idea.
    *   Generate a melody.
    *   Select drum sounds.
    *   Generate a drum pattern.
3.  Utilize the Pydantic models from `llm_schemas.py` as the `output_type` for these internal LLM calls, ensuring structured and validated data.
4.  Leverage the helper modules (`MusicResearcher`, `midi2.py`, etc.) for specific tasks.
5.  Return a structured output representing the composed musical piece.

This approach allows the complex, multi-step music generation process to be exposed as a clean, high-level tool to the `pydantic_ai_wrapper`, while internally using Pydantic AI's features for structured LLM interactions. 