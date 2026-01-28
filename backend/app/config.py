"""
ZAFESYS Suite - Configuration
"""
from pydantic_settings import BaseSettings
from functools import lru_cache
from typing import List


class Settings(BaseSettings):
    # App
    APP_NAME: str = "ZAFESYS Suite"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = False

    # Database
    DATABASE_URL: str = "postgresql://postgres:password@localhost:5432/zafesys_suite"

    # JWT
    SECRET_KEY: str = "your-super-secret-key-change-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440  # 24 hours

    # CORS - Includes all environments: local dev, Vercel, Flutter app
    CORS_ORIGINS: str = "http://localhost:5173,http://localhost:3000,http://localhost:8080,https://zafesys-suite.vercel.app,https://zafesys-suite-git-main-soccompraloenacasa-ui.vercel.app,https://zafesys-suite-soccompraloenacasa-ui.vercel.app"

    # ElevenLabs
    ELEVENLABS_WEBHOOK_SECRET: str = ""
    ELEVENLABS_AGENT_ID: str = ""

    # Google Ads OAuth
    GOOGLE_ADS_CLIENT_ID: str = ""
    GOOGLE_ADS_CLIENT_SECRET: str = ""
    GOOGLE_ADS_DEVELOPER_TOKEN: str = ""
    GOOGLE_ADS_REDIRECT_URI: str = ""

    class Config:
        env_file = ".env"
        case_sensitive = True

    @property
    def cors_origins_list(self) -> List[str]:
        """Parse CORS_ORIGINS into a list."""
        if self.CORS_ORIGINS == "*":
            return ["*"]
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]


@lru_cache()
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
