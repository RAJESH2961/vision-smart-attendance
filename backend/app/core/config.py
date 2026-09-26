"""
Application configuration loaded from environment variables.
Uses pydantic-settings for type-safe config with .env file support.
"""

from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    # ── Database ──────────────────────────────────────────────
    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/smart_attendance"

    # ── JWT Authentication ────────────────────────────────────
    SECRET_KEY: str = "your-super-secret-key-change-this-in-production"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 480

    # ── Face Recognition ──────────────────────────────────────
    FACE_SIMILARITY_THRESHOLD: float = 0.45
    FACE_MODEL_NAME: str = "buffalo_l"

    # ── Camera ────────────────────────────────────────────────
    CAMERA_SOURCE: str = "0"

    # ── CORS ──────────────────────────────────────────────────
    CORS_ORIGINS: str = "http://localhost:5173,http://localhost:3000"

    # ── Server ────────────────────────────────────────────────
    HOST: str = "0.0.0.0"
    PORT: int = 8000

    @property
    def cors_origins_list(self) -> List[str]:
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",")]

    @property
    def camera_source_parsed(self):
        """Return int for webcam index or string for RTSP URL."""
        try:
            return int(self.CAMERA_SOURCE)
        except ValueError:
            return self.CAMERA_SOURCE

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()
