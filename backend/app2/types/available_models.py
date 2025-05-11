from enum import Enum


class ModelType(str, Enum):
    ANTHROPIC_CLAUDE_3_OPUS = "anthropic:claude-3-opus-20240229"
    ANTHROPIC_CLAUDE_3_5_SONNET = "anthropic:claude-3-5-sonnet-20240620"
    OPENAI_GPT_4O = "openai:gpt-4o"
    OPENAI_GPT_4O_MINI = "openai:gpt-4o-mini"
    OPENAI_GPT_3_5_TURBO = "openai:gpt-3.5-turbo"
    OPENAI_GPT_3_5_TURBO_MINI = "openai:gpt-3.5-turbo-mini"

    # TODO: Add more models as needed
