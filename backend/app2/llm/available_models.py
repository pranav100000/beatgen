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

OPENAI_GPT_O3 = ModelInfo(
    provider_name="openai",
    display_name="o3",
    model_name="o3",
    api_key_env_var="OPENAI_API_KEY"
)

ANTHROPIC_CLAUDE_3_7_SONNET = ModelInfo(
    provider_name="anthropic",
    display_name="Claude 3.7 Sonnet",
    model_name="claude-3-7-sonnet-latest",
    api_key_env_var="ANTHROPIC_API_KEY"
)

GOOGLE_GEMINI_FLASH = ModelInfo(
    provider_name="google-gla",
    display_name="Gemini Pro 2.5",
    model_name="gemini-2.5-pro-exp-03-25",
    api_key_env_var="GEMINI_API_KEY"
)

OPENROUTER_DEEPSEEK_R1 = ModelInfo(
    provider_name="openrouter", 
    display_name="Deepseek R1",
    model_name="deepseek/deepseek-r1", 
    api_key_env_var="OPENROUTER_API_KEY",
    base_url="https://openrouter.ai/api/v1"
)

OPENROUTER_DEEPSEEK_V3 = ModelInfo(
    provider_name="openrouter", 
    display_name="Deepseek V3",
    model_name="deepseek/deepseek-chat-v3-0324",
    api_key_env_var="OPENROUTER_API_KEY",
    base_url="https://openrouter.ai/api/v1"
)

OPENROUTER_LLAMA_4_MAVERICK = ModelInfo(
    provider_name="openrouter", 
    display_name="Llama 4 Maverick",
    model_name="meta-llama/llama-4-maverick", 
    api_key_env_var="OPENROUTER_API_KEY",
    base_url="https://openrouter.ai/api/v1"
)

OPENROUTER_LLAMA_4_SCOUT = ModelInfo(
    provider_name="openrouter", 
    display_name="Llama 4 Scout",
    model_name="meta-llama/llama-4-scout", 
    api_key_env_var="OPENROUTER_API_KEY",
    base_url="https://openrouter.ai/api/v1"
)

ALL_MODELS = [
    OPENAI_GPT_3_5_TURBO,
    OPENAI_GPT_4O,
    OPENAI_GPT_O3,
    ANTHROPIC_CLAUDE_3_7_SONNET,
    GOOGLE_GEMINI_FLASH,
    OPENROUTER_DEEPSEEK_R1,
    OPENROUTER_DEEPSEEK_V3,
    OPENROUTER_LLAMA_4_MAVERICK,
    OPENROUTER_LLAMA_4_SCOUT
]

def get_model_by_name(model_name: str) -> ModelInfo:
    match model_name:
        case "gpt-3.5-turbo":
            return OPENAI_GPT_3_5_TURBO
        case "gpt-4o":
            return OPENAI_GPT_4O
        case "o3":
            return OPENAI_GPT_O3
        case "claude-3.7-sonnet":
            return ANTHROPIC_CLAUDE_3_7_SONNET
        case "gemini-2.5-pro":
            return GOOGLE_GEMINI_FLASH
        case "deepseek-r1":
            return OPENROUTER_DEEPSEEK_R1
        case "deepseek-v3":
            return OPENROUTER_DEEPSEEK_V3
        case "llama-4-maverick":
            return OPENROUTER_LLAMA_4_MAVERICK
        case "llama-4-scout":
            return OPENROUTER_LLAMA_4_SCOUT
        case _:
            raise ValueError(f"Model not found: {model_name}")

