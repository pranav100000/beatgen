import logging
import os
from typing import Optional
from openai import OpenAI
from dotenv import load_dotenv


logger = logging.getLogger(__name__)

load_dotenv()


class PerplexityClient:
    def __init__(self, api_key: Optional[str] = None):
        """
        Initialize the music researcher.

        Args:
            api_key: Perplexity API key. If not provided, uses PERPLEXITY_API_KEY env variable.
        """
        self.api_key = api_key or os.environ.get("PERPLEXITY_API_KEY")
        if not self.api_key:
            logger.warning(
                "Perplexity API key not provided. Research enhancement will be disabled."
            )
        else:
            self.client = OpenAI(
                api_key=self.api_key, base_url="https://api.perplexity.ai"
            )
            logger.debug("Initialized OpenAI client with Perplexity base URL")

    # Define the function to run in the executor
    def call_perplexity(self, messages: list[dict]):
        print("[DIRECT PRINT] Inside executor: Making Perplexity API call")
        logger.debug("Inside executor: Making Perplexity API call")
        try:
            return self.client.chat.completions.create(
                model="sonar-pro", messages=messages, temperature=0.1, max_tokens=1000
            )
        except Exception as e:
            print(f"[DIRECT PRINT] Error inside executor: {str(e)}")
            logger.error(f"Error inside executor: {str(e)}")
            raise
