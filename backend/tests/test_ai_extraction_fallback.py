"""
Verifies the AI pipeline degrades safely with no API keys configured —
this is the exact situation the app is in before real keys are wired in,
and it must never crash a report submission.
"""
from app.services import ai_extraction, embeddings


def test_extraction_falls_back_without_api_key(monkeypatch):
    monkeypatch.setattr("app.services.ai_extraction.get_settings", lambda: _NoKeySettings())
    result = ai_extraction.extract("The Wi-Fi in Block A has been down since yesterday.")
    assert result.low_confidence is True
    assert result.category == "Other"
    assert 0 <= result.severity <= 100
    assert 0 <= result.urgency <= 100


def test_embedding_returns_none_without_api_key(monkeypatch):
    monkeypatch.setattr("app.services.embeddings.get_settings", lambda: _NoKeySettings())
    assert embeddings.embed("some report text") is None


class _NoKeySettings:
    anthropic_api_key = None
    voyage_api_key = None
    anthropic_model = "claude-haiku-4-5"
    voyage_embed_model = "voyage-3.5-lite"
