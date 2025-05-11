import os
from pydantic import BaseModel
from dotenv import load_dotenv
from typing import List
import logging  # Add logging import

# Load environment variables from .env file
load_dotenv()

# Setup basic logging configuration for settings verification
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class AppConfig(BaseModel):
    """Base application configuration"""

    PROJECT_NAME: str = "BeatGen API"
    BASE_URL: str = os.getenv("BASE_URL")
    FRONTEND_BASE_URL: str = os.getenv("FRONTEND_BASE_URL")
    DEBUG: bool = os.getenv("DEBUG", "False").lower() in ("true", "1", "yes")


class SupabaseConfig(BaseModel):
    """Supabase configuration"""

    URL: str = os.getenv("SUPABASE_URL", "")
    KEY: str = os.getenv("SUPABASE_KEY", "")
    JWT_SECRET: str = os.getenv("SUPABASE_JWT_SECRET", "")


class JWTConfig(BaseModel):
    """JWT authentication configuration"""

    SECRET_KEY: str = os.getenv("JWT_SECRET_KEY", "")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30


class CORSConfig(BaseModel):
    """CORS configuration"""

    ORIGINS: List[str] = [
        "http://localhost:5173",
        "http://192.168.1.235:5173",
        "https://localhost:5173",
        "https://169.254.70.78:5173",
        "*",
    ]
    ALLOW_CREDENTIALS: bool = True
    ALLOW_METHODS: List[str] = ["*"]
    ALLOW_HEADERS: List[str] = ["*"]


class DatabaseConfig(BaseModel):
    """Database configuration"""

    URL: str = os.getenv("DATABASE_URL", "")


class AudioConfig(BaseModel):
    """Audio processing and DAW configuration"""

    DEFAULT_SAMPLER_BASE_NOTE: int = 60  # Middle C (C4) in MIDI notation
    DEFAULT_SAMPLER_GRAIN_SIZE: float = 0.1
    DEFAULT_SAMPLER_OVERLAP: float = 0.1
    DEFAULT_BPM: int = 120
    DEFAULT_TIME_SIGNATURE: str = "4/4"
    SAMPLE_RATE: int = 44100  # Standard CD-quality sample rate
    BIT_DEPTH: int = 16  # Standard CD-quality bit depth
    DEFAULT_VELOCITY: int = 100  # MIDI velocity (0-127)
    BUFFER_SIZE: int = 1024
    PPQ: int = 480


class Settings(BaseModel):
    """Main settings container"""

    app: AppConfig = AppConfig()
    supabase: SupabaseConfig = SupabaseConfig()
    jwt: JWTConfig = JWTConfig()
    cors: CORSConfig = CORSConfig()
    db: DatabaseConfig = DatabaseConfig()
    audio: AudioConfig = AudioConfig()

    class Config:
        env_file = ".env"


# Create settings instance
settings = Settings()

# Log the loaded settings for verification
logger.info(f"Loaded Settings - App Name: {settings.app.PROJECT_NAME}")
logger.info(f"Loaded Settings - Base URL: {settings.app.BASE_URL}")
logger.info(f"Loaded Settings - Frontend Base URL: {settings.app.FRONTEND_BASE_URL}")
logger.info(f"Loaded Settings - Debug: {settings.app.DEBUG}")
logger.info(
    f"Loaded Settings - Supabase URL: {settings.supabase.URL[:10]}..."
)  # Don't log full URL/keys
logger.info(f"Loaded Settings - CORS Origins: {settings.cors.ORIGINS}")
logger.info(f"Loaded Settings - DB URL: {'Set' if settings.db.URL else 'Not Set'}")
