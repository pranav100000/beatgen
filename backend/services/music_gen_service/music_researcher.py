"""
Simple music research service that uses Perplexity to enhance music descriptions.
Uses OpenAI client library to connect to Perplexity's API.
"""
import os
import logging
import sys
from typing import Dict, Any, Optional
from openai import OpenAI
from dotenv import load_dotenv
import asyncio
# Set up detailed logging with DEBUG level
logger = logging.getLogger(__name__)
logger.setLevel(logging.DEBUG)

# If no handlers, add one to ensure logs are visible
if not logger.handlers:
    handler = logging.StreamHandler()
    handler.setFormatter(logging.Formatter(
        '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    ))
    logger.addHandler(handler)

# Explicitly ensure we're not propagating to root logger
# This ensures our log settings aren't overridden
logger.propagate = False  # Uncommenting this is critical!

# Force a direct print to ensure visibility
print("[RESEARCH MODULE] MusicResearcher module initialized, stdout handler added")

# Log through logger too
logger.info("MusicResearcher module initialized with custom handler")
load_dotenv()

class MusicResearcher:
    """
    Simple service for enhancing music descriptions with musical context.
    """
    def __init__(self, api_key: Optional[str] = None):
        """
        Initialize the music researcher.
        
        Args:
            api_key: Perplexity API key. If not provided, uses PERPLEXITY_API_KEY env variable.
        """
        self.api_key = api_key or os.environ.get("PERPLEXITY_API_KEY")
        if not self.api_key:
            logger.warning("Perplexity API key not provided. Research enhancement will be disabled.")
        else:
            self.client = OpenAI(api_key=self.api_key, base_url="https://api.perplexity.ai")
            logger.debug(f"Initialized OpenAI client with Perplexity base URL")
        
    async def enhance_description(self, description: str) -> Dict[str, Any]:
        """
        Enhance a music description with musical context from research.
        
        Args:
            description: The original user description of the music
            
        Returns:
            Dictionary with original description and enhanced content
        """
        logger.debug(f"enhance_description called with: {description[:50]}...")
        
        # Return unenhanced if no API key
        if not self.api_key:
            print(f"[DIRECT PRINT] Skipping research enhancement (no API key)")
            logger.info("Skipping research enhancement (no API key)")
            return {"original": description, "enhanced": None}
        
        try:
            # Research the music style
            print(f"[DIRECT PRINT] Researching musical context for: {description[:40]}...")
            logger.info(f"Researching musical context for: {description[:40]}...")
            research_content = await self._research_music(description)
            
            logger.info(f"Research complete, got {len(research_content)} chars")
            
            # Create enhanced result
            return {
                "original": description,
                "enhanced": research_content,
                "prompt_addition": f"\n\nMusical context information:\n{research_content}"
            }
            
        except Exception as e:
            logger.error(f"Error researching music description: {str(e)}")
            # Return original if research fails
            return {"original": description, "enhanced": None}
        
    async def research_chord_progression(self, description: str) -> str:
        """Research chord progression using Perplexity."""
        logger.debug(f"Beginning research_chord_progression for: {description[:50]}...")
        print(f"[DIRECT PRINT] Beginning research_chord_progression for: {description[:50]}...")
        return await self._research_chord_progression(description)
    
    async def _research_music(self, description: str) -> str:
        """Research musical characteristics using Perplexity."""
        logger.debug(f"Beginning _research_music for: {description[:50]}...")
        print(f"[DIRECT PRINT] Beginning _research_music for: {description[:50]}...")
        messages = [
            {
                "role": "system",
                "content": "You are a music expert who provides concise bullet-pointed information about music genres and styles."
            },
            {
                "role": "user",
                "content": f"""As a music expert, provide key information about this musical style:
                
                "{description}"
                
                Please include:
                - Genre classification and subgenres
                - Typical tempo range (in BPM)
                - Common instruments and their roles
                - 2-3 notable reference tracks
                - Production techniques common in this style
                
                Format your response as a simple set of bullet points under clear headings.
                Be specific and concise with factual information."""
            }
        ]
        
        try:
            # Using asyncio to run the synchronous code in a non-blocking way
            print(f"[DIRECT PRINT] Inside _research_music: Setting up async execution for Perplexity API call")
            logger.debug("Setting up async execution for Perplexity API call")
            
            # Define the function to run in the executor
            def call_perplexity():
                print(f"[DIRECT PRINT] Inside executor: Making Perplexity API call")
                logger.debug("Inside executor: Making Perplexity API call")
                try:
                    return self.client.chat.completions.create(
                        model="sonar-pro",
                        messages=messages,
                        temperature=0.1,
                        max_tokens=1000
                    )
                except Exception as e:
                    print(f"[DIRECT PRINT] Error inside executor: {str(e)}")
                    logger.error(f"Error inside executor: {str(e)}")
                    raise
            
            # Run the synchronous function in the default executor
            logger.debug("Submitting API call to executor")
            response = await asyncio.get_event_loop().run_in_executor(None, call_perplexity)
            
            logger.debug("Got response from Perplexity")
            result = response.choices[0].message.content
            logger.debug(f"Extracted content, length: {len(result)} chars")
            return result
            
        except Exception as e:
            logger.error(f"Error in _research_music: {str(e)}")
            logger.error("Exception details:", exc_info=True)
            raise

    async def _research_chord_progression(self, description: str) -> str:
        """Research chord progression using Perplexity."""
        logger.debug(f"Beginning _research_chord_progression for: {description[:50]}...")
        print(f"[DIRECT PRINT] Beginning _research_chord_progression for: {description[:50]}...")
        
        messages = [
            {
                "role": "system",
                "content": "You are a music expert who has specific expertise in chord progressions. You are given a description of a musical style and you need to provide a chord progression for that style."
            },
            {
                "role": "user",
                "content": f"""As a music expert, provide key information about this musical style:
                
                "{description}"
                
                Please include:
                - Most common chord progressions used in this style ranked by popularity
                - Details about why each chord progression is used in this style
                - References to specific tracks that use these chord progressions
                
                Format your response as a simple set of bullet points under clear headings.
                Be specific and concise with factual information."""
            }
        ]
        
        try:
            # Using asyncio to run the synchronous code in a non-blocking way
            print(f"[DIRECT PRINT] Inside _research_chord_progression: Setting up async execution for Perplexity API call")
            logger.debug("Setting up async execution for Perplexity API call")
            
            # Define the function to run in the executor
            def call_perplexity():
                print(f"[DIRECT PRINT] Inside executor: Making Perplexity API call")
                logger.debug("Inside executor: Making Perplexity API call")
                try:
                    return self.client.chat.completions.create(
                        model="sonar-pro",
                        messages=messages,
                        temperature=0.1,
                        max_tokens=1000
                    )
                except Exception as e:
                    print(f"[DIRECT PRINT] Error inside executor: {str(e)}")
                    logger.error(f"Error inside executor: {str(e)}")
                    raise
            
            # Run the synchronous function in the default executor
            logger.debug("Submitting API call to executor")
            response = await asyncio.get_event_loop().run_in_executor(None, call_perplexity)
            
            logger.debug("Got response from Perplexity")
            result = response.choices[0].message.content
            logger.debug(f"Extracted content, length: {len(result)} chars")
            return result
            
        except Exception as e:
            logger.error(f"Error in _research_chord_progression: {str(e)}")
            logger.error("Exception details:", exc_info=True)
            raise
        
        

# Create a singleton instance
music_researcher = MusicResearcher()