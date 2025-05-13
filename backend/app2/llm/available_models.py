from dataclasses import dataclass
from typing import Optional
import os

@dataclass
class ModelInfo:
    provider_name: str
    display_name: str
    model_name: str
    api_key_env_var: str  # Store the environment variable name instead of the key itself
    api_key: Optional[str] = None
    base_url: Optional[str] = None
    
    def get_api_key(self) -> str:
        """Retrieve the API key only when needed"""
        key = os.getenv(self.api_key_env_var)
        if not key:
            raise ValueError(f"Missing API key: {self.api_key_env_var} not found in environment")
        return key
    

# Example model definitions (API keys should be loaded from env in your test script, not hardcoded)
OPENAI_GPT_3_5_TURBO = ModelInfo(
    provider_name="openai",
    display_name="GPT-3.5 Turbo",
    model_name="gpt-3.5-turbo",
    api_key_env_var="OPENAI_API_KEY"
)

OPENAI_GPT_4O = ModelInfo(
    provider_name="openai",
    display_name="GPT-4o",
    model_name="gpt-4o",
    api_key_env_var="OPENAI_API_KEY"
)

ANTHROPIC_CLAUDE_OPUS = ModelInfo(
    provider_name="anthropic",
    display_name="Claude Opus",
    model_name="claude-3-opus-20240229",
    api_key_env_var="ANTHROPIC_API_KEY"
)

GOOGLE_GEMINI_FLASH = ModelInfo(
    provider_name="google-gla",
    display_name="Gemini Flash 1.5",
    model_name="gemini-1.5-flash",
    api_key_env_var="GEMINI_API_KEY"
)

ALL_MODELS = [
    OPENAI_GPT_3_5_TURBO,
    OPENAI_GPT_4O,
    ANTHROPIC_CLAUDE_OPUS,
    GOOGLE_GEMINI_FLASH,
]