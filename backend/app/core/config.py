from typing import Optional
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    SUPABASE_URL: str = ""
    SUPABASE_SERVICE_KEY: str = ""
    SUPABASE_STORAGE_BUCKET: str = "pointclouds"
    CORS_ORIGINS: list[str] = ["http://localhost:5173", "http://localhost:3000"]
    DATABASE_URL: Optional[str] = None  # For migrations

    class Config:
        env_file = ".env"
        extra = "ignore"  # Ignore extra env vars


settings = Settings()
