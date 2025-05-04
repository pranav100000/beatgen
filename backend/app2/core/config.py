import os
from pydantic import BaseModel
from dotenv import load_dotenv
from typing import List, Optional
import logging # Add logging import

# Load environment variables from .env file
load_dotenv()

# Setup basic logging configuration for settings verification
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class AppConfig(BaseModel):
    """Base application configuration"""
    PROJECT_NAME: str = "BeatGen API"
    API_PREFIX: str = "/api"
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
    ORIGINS: List[str] = ["http://localhost:5173", "http://192.168.1.235:5173", "https://localhost:5173", "https://169.254.70.78:5173", "*"]
    ALLOW_CREDENTIALS: bool = True
    ALLOW_METHODS: List[str] = ["*"]
    ALLOW_HEADERS: List[str] = ["*"]

class DatabaseConfig(BaseModel):
    """Database configuration"""
    URL: str = os.getenv("DATABASE_URL", "")

class Settings(BaseModel):
    """Main settings container"""
    app: AppConfig = AppConfig()
    supabase: SupabaseConfig = SupabaseConfig()
    jwt: JWTConfig = JWTConfig()
    cors: CORSConfig = CORSConfig()
    db: DatabaseConfig = DatabaseConfig()
    
    class Config:
        env_file = ".env"

# Create settings instance
settings = Settings()

# Log the loaded settings for verification
logger.info(f"Loaded Settings - App Name: {settings.app.PROJECT_NAME}")
logger.info(f"Loaded Settings - API Prefix: {settings.app.API_PREFIX}")
logger.info(f"Loaded Settings - Base URL: {settings.app.BASE_URL}")
logger.info(f"Loaded Settings - Frontend Base URL: {settings.app.FRONTEND_BASE_URL}")
logger.info(f"Loaded Settings - Debug: {settings.app.DEBUG}")
logger.info(f"Loaded Settings - Supabase URL: {settings.supabase.URL[:10]}...") # Don't log full URL/keys
logger.info(f"Loaded Settings - CORS Origins: {settings.cors.ORIGINS}")
logger.info(f"Loaded Settings - DB URL: {'Set' if settings.db.URL else 'Not Set'}")