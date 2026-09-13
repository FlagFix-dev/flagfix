"""
Verifies the AI pipeline degrades safely with no provider keys configured
— the exact situation the app is in before keys are wired in, and after a
key is revoked or a provider has an outage. It must never crash a report
submission.

These build a REAL Settings object rather than a hand-rolled stub. An
earlier version used a small fake class listing the settings it thought
mattered; when provider selection moved into Settings the fake silently
went stale and the tests started failing for a reason that had nothing to
do with the behaviour under test. A real object can't drift from the real
resolution logic.
"""
import pytest

from app.config import Settings
from app.services import ai_extraction, embeddings

BASE = {"database_url": "postgresql+asyncpg://u:p@localhost/db", "jwt_secret_key": "k"}


def _no_keys() -> Settings:
    """Settings with every AI provider key absent."""
    return Settings(
        **BASE,
        gemini_api_key=None,
        anthropic_api_key=None,
        voyage_api_key=None,
    )


def test_extraction_falls_back_without_any_provider_key(monkeypatch):
    monkeypatch.setattr("app.services.ai_extraction.get_settings", _no_keys)

    result = ai_extraction.extract("The Wi-Fi in Block A has been down since yesterday.")

    # The fallback must be recognisable as a fallback, not quietly pass for
    # real analysis — the UI keys off exactly these values to warn admins.
    assert result.low_confidence is True
    assert result.category == "Other"
    assert result.severity == 50
    assert result.urgency == 50
    assert "unavailable" in result.reasoning.lower()


def test_embedding_returns_none_without_any_provider_key(monkeypatch):
    monkeypatch.setattr("app.services.embeddings.get_settings", _no_keys)
    assert embeddings.embed("some report text") is None


def test_extraction_falls_back_when_the_provider_call_fails(monkeypatch):
    """A configured key is not a guarantee: quota, outage or a revoked key
    all raise. A report must still be saved."""
    monkeypatch.setattr(
        "app.services.ai_extraction.get_settings",
        lambda: Settings(**BASE, gemini_api_key="looks-real-but-isnt"),
    )

    def _boom(*_args, **_kwargs):
        raise RuntimeError("provider exploded")

    monkeypatch.setattr("app.services.ai_extraction._call_gemini", _boom)

    result = ai_extraction.extract("Tap leaking in the second floor washroom.")
    assert result.low_confidence is True
    assert result.category == "Other"


def test_embedding_returns_none_when_the_provider_call_fails(monkeypatch):
    """Losing the vector costs duplicate-matching for that one report; it
    must never cost the report itself."""
    monkeypatch.setattr(
        "app.services.embeddings.get_settings",
        lambda: Settings(**BASE, gemini_api_key="looks-real-but-isnt"),
    )

    def _boom(*_args, **_kwargs):
        raise RuntimeError("provider exploded")

    monkeypatch.setattr("app.services.embeddings._call_gemini", _boom)

    assert embeddings.embed("some report text") is None


def test_model_version_records_the_active_model(monkeypatch):
    """Stored beside every vector, so it's possible to tell later which
    model produced it — the question you must answer before re-embedding
    after a provider switch."""
    monkeypatch.setattr(
        "app.services.embeddings.get_settings",
        lambda: Settings(**BASE, gemini_api_key="g"),
    )
    assert embeddings.model_version().startswith("gemini-embedding")

    monkeypatch.setattr("app.services.embeddings.get_settings", _no_keys)
    assert embeddings.model_version() == "none"
