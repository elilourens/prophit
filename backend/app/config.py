"""Configuration settings for the application."""
from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    """Application settings."""
    
    app_name: str = "Prophit Finance API"
    debug: bool = False
    database_url: str = "sqlite:///./prophit.db"
    
    # LLM Provider API Keys (optional, for real providers)
    openai_api_key: str = ""
    anthropic_api_key: str = ""
    google_api_key: str = ""
    crusoe_api_key: str = ""
    crusoe_base_url: str = ""
    crusoe_model: str = ""
    
    class Config:
        env_file = ".env"
        case_sensitive = False


settings = Settings()
