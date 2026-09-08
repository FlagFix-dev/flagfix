"""
Central application configuration.

Every setting is read from environment variables (via a local .env file in
development, or the hosting platform's Environment Variables dashboard in
production). Nothing secret is ever hard-coded here — that is the whole
point of this file existing.
"""
from functools import lru_cache
from typing import List

from pydantic import AnyUrl, Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # --- App ---
    environment: str = Field(default="development")
    allowed_origins: str = Field(default="http://localhost:3000")

    # --- Database ---
    database_url: str

    # --- Redis ---
    redis_url: str = "redis://localhost:6379/0"

    # --- Auth ---
    jwt_secret_key: str
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 30
    refresh_token_expire_days: int = 30

    # --- AI providers ---
    anthropic_api_key: str | None = None
    anthropic_model: str = "claude-haiku-4-5"
    voyage_api_key: str | None = None
    voyage_embed_model: str = "voyage-3.5-lite"

    # --- Object storage ---
    r2_account_id: str | None = None
    r2_access_key_id: str | None = None
    r2_secret_access_key: str | None = None
    r2_bucket_name: str = "flagfix-attachments"

    # --- Email ---
    resend_api_key: str | None = None

    @property
    def cors_origins(self) -> List[str]:
        return [o.strip() for o in self.allowed_origins.split(",") if o.strip()]

    @property
    def is_production(self) -> bool:
        return self.environment.lower() == "production"

    @property
    def ai_pipeline_enabled(self) -> bool:
        """
        The AI pipeline (classification + embeddings) only runs when both
        provider keys are configured. This lets the app boot and be tested
        end-to-end (with a safe rule-based fallback, see services/ai_extraction.py
        and services/embeddings.py) before real API keys are wired in —
        exactly the situation during initial local setup.
        """
        return bool(self.anthropic_api_key and self.voyage_api_key)


@lru_cache
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]  # values come from env/.env
