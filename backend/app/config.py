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

    # --- AI provider selection ---
    # FlagFix needs two different AI capabilities, and either can be served
    # by more than one vendor:
    #   * extraction  — reading a report into structured fields (a chat model)
    #   * embedding   — turning a report into a vector so meaning can be
    #                   compared (an embedding model)
    #
    # "auto" picks whichever provider has a key configured, preferring
    # Google, because Google's free tier needs no payment method at all.
    # Set explicitly to pin a provider even when both keys are present.
    ai_provider: str = "auto"  # auto | gemini | anthropic
    embedding_provider: str = "auto"  # auto | gemini | voyage

    # --- Google (Gemini) ---
    # One key serves both capabilities, which is why this is the default:
    # a single account, and no card or UPI needed to start.
    gemini_api_key: str | None = None
    gemini_model: str = "gemini-3.5-flash-lite"
    gemini_embed_model: str = "gemini-embedding-001"

    # --- Anthropic ---
    anthropic_api_key: str | None = None
    # Pinned to a dated snapshot rather than the `claude-haiku-4-5` alias.
    # The alias silently follows the newest snapshot, which means the
    # model could change underneath us mid-evaluation — exactly what you
    # don't want while tuning prompts and judging output quality. Anthropic
    # never changes the weights behind a dated id.
    anthropic_model: str = "claude-haiku-4-5-20251001"
    voyage_api_key: str | None = None
    # voyage-4-lite, not the older voyage-3.5-lite: same price, same 1024
    # dimensions (so no schema change — see EMBEDDING_DIM in
    # models/problem.py), better quality, and critically it carries a
    # 200M-token free allowance that the deprecated 3.5 models no longer do.
    voyage_embed_model: str = "voyage-4-lite"

    # --- AI tuning ---
    # Exposed as settings rather than hard-coded constants so these can be
    # adjusted from the hosting dashboard during evaluation, without a code
    # change and redeploy each time. See services/similarity.py for what
    # they mean and how to tune them.
    similarity_auto_match_threshold: float = 0.82
    similarity_review_threshold: float = 0.70

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
    def active_ai_provider(self) -> str | None:
        """Which provider will actually read reports, or None for neither.

        Resolution is deliberately key-driven rather than name-driven: a
        provider pinned by name but missing its key resolves to None, so a
        typo'd key never silently falls through to the other vendor and
        bills the wrong account.
        """
        choice = (self.ai_provider or "auto").strip().lower()
        if choice == "gemini":
            return "gemini" if self.gemini_api_key else None
        if choice == "anthropic":
            return "anthropic" if self.anthropic_api_key else None
        # auto — prefer Google, whose free tier needs no payment method.
        if self.gemini_api_key:
            return "gemini"
        if self.anthropic_api_key:
            return "anthropic"
        return None

    @property
    def active_embedding_provider(self) -> str | None:
        """Which provider will turn reports into vectors, or None."""
        choice = (self.embedding_provider or "auto").strip().lower()
        if choice == "gemini":
            return "gemini" if self.gemini_api_key else None
        if choice == "voyage":
            return "voyage" if self.voyage_api_key else None
        if self.gemini_api_key:
            return "gemini"
        if self.voyage_api_key:
            return "voyage"
        return None

    @property
    def active_ai_model(self) -> str | None:
        """The model id the active extraction provider will be called with."""
        return {"gemini": self.gemini_model, "anthropic": self.anthropic_model}.get(
            self.active_ai_provider or ""
        )

    @property
    def active_embedding_model(self) -> str | None:
        return {"gemini": self.gemini_embed_model, "voyage": self.voyage_embed_model}.get(
            self.active_embedding_provider or ""
        )

    @property
    def ai_pipeline_enabled(self) -> bool:
        """
        True only when BOTH halves of the pipeline have a usable provider:
        something to read reports, and something to compare them. Each half
        degrades independently (see services/ai_extraction.py and
        services/embeddings.py), so the app runs fine with one, neither, or
        both — this flag is just the honest headline for /health.
        """
        return bool(self.active_ai_provider and self.active_embedding_provider)

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
