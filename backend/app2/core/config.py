import os
from pydantic import BaseModel
from dotenv import load_dotenv
from typing import List, Optional

# Load environment variables from .env file
load_dotenv()

class AppConfig(BaseModel):
    """Base application configuration"""
    PROJECT_NAME: str = "BeatGen API"
    API_PREFIX: str = "/api"
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
    ORIGINS: List[str] = ["http://localhost:5173"]
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