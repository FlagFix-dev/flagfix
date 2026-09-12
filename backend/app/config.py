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

    # --- Object storage (any S3-compatible provider) ---
    # Deliberately provider-agnostic rather than hard-coded to one vendor:
    # Supabase Storage, Cloudflare R2, Backblaze B2 and AWS S3 all speak the
    # same S3 protocol, so switching provider later is an environment-variable
    # change with no code change. The endpoint is given in full for exactly
    # that reason (vendors each shape their hostnames differently).
    #
    # Supabase Storage (what FlagFix uses today):
    #   STORAGE_ENDPOINT_URL = https://<project-ref>.storage.supabase.co/storage/v1/s3
    #   STORAGE_REGION       = the project's region, e.g. ap-south-1
    #   STORAGE_PUBLIC_BASE_URL =
    #       https://<project-ref>.supabase.co/storage/v1/object/public/<bucket>
    storage_endpoint_url: str | None = None
    storage_region: str = "auto"
    storage_access_key_id: str | None = None
    storage_secret_access_key: str | None = None
    storage_bucket_name: str = "flagfix-attachments"
    # The bucket's public base URL. Attachment URLs are built as
    # f"{storage_public_base_url}/{object_key}", so this must be set for
    # uploaded photos/videos to actually be viewable.
    storage_public_base_url: str | None = None

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

    @property
    def storage_configured(self) -> bool:
        """Same graceful-degradation philosophy as the AI pipeline: photo/
        video upload only turns on once every storage setting is present.
        Until then, reports can still be submitted — just without media."""
        return bool(
            self.storage_endpoint_url
            and self.storage_access_key_id
            and self.storage_secret_access_key
            and self.storage_public_base_url
        )


@lru_cache
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]  # values come from env/.env
