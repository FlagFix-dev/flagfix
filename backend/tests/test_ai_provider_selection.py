"""
Which AI vendor actually runs is decided by config, not by code — so the
decision itself needs testing. Getting this wrong is expensive in a way
that isn't obvious: a report silently billed to the wrong account, or a
provider that was "pinned" quietly falling through to another vendor
because its key was mistyped.

Pure settings logic, so no database or network is involved.
"""
import pytest

from app.config import Settings

BASE = {"database_url": "postgresql+asyncpg://u:p@localhost/db", "jwt_secret_key": "k"}


def make(**overrides) -> Settings:
    return Settings(**BASE, **overrides)


# --- auto: pick whatever is configured, preferring the free option -------

def test_auto_prefers_gemini_when_both_keys_are_present():
    """Google's free tier needs no payment method, so with a genuine choice
    the cheaper path wins unless someone says otherwise."""
    s = make(gemini_api_key="g", anthropic_api_key="a", voyage_api_key="v")
    assert s.active_ai_provider == "gemini"
    assert s.active_embedding_provider == "gemini"


def test_auto_falls_back_to_the_only_configured_vendor():
    s = make(anthropic_api_key="a", voyage_api_key="v")
    assert s.active_ai_provider == "anthropic"
    assert s.active_embedding_provider == "voyage"


def test_no_keys_means_no_provider():
    s = make()
    assert s.active_ai_provider is None
    assert s.active_embedding_provider is None
    assert s.ai_pipeline_enabled is False


# --- explicit pinning ----------------------------------------------------

def test_pinning_anthropic_wins_over_a_present_gemini_key():
    s = make(ai_provider="anthropic", gemini_api_key="g", anthropic_api_key="a")
    assert s.active_ai_provider == "anthropic"


def test_pinning_gemini_wins_over_a_present_anthropic_key():
    s = make(ai_provider="gemini", gemini_api_key="g", anthropic_api_key="a")
    assert s.active_ai_provider == "gemini"


def test_a_pinned_provider_without_its_key_does_NOT_fall_through():
    """The important one.

    If someone pins Anthropic but the key is missing or mistyped, the
    correct behaviour is "no extraction" (the visible rule-based fallback),
    NOT silently using Google instead. A silent switch would change the
    quality of triage and the account being billed, with nothing on screen
    to explain why.
    """
    s = make(ai_provider="anthropic", gemini_api_key="g")  # no anthropic key
    assert s.active_ai_provider is None

    e = make(embedding_provider="voyage", gemini_api_key="g")  # no voyage key
    assert e.active_embedding_provider is None


def test_provider_names_are_case_and_whitespace_tolerant():
    """These are typed by hand into a hosting dashboard."""
    s = make(ai_provider="  GEMINI ", gemini_api_key="g")
    assert s.active_ai_provider == "gemini"


# --- halves are independent ---------------------------------------------

def test_extraction_and_embeddings_can_run_on_different_vendors():
    s = make(ai_provider="anthropic", embedding_provider="voyage",
             anthropic_api_key="a", voyage_api_key="v")
    assert s.active_ai_provider == "anthropic"
    assert s.active_embedding_provider == "voyage"
    assert s.ai_pipeline_enabled is True


def test_pipeline_is_only_fully_enabled_when_both_halves_have_a_provider():
    only_reading = make(gemini_api_key=None, anthropic_api_key="a")
    assert only_reading.active_ai_provider == "anthropic"
    assert only_reading.active_embedding_provider is None
    assert only_reading.ai_pipeline_enabled is False


# --- reported model names track the active provider ---------------------

def test_reported_models_follow_the_active_provider():
    gem = make(gemini_api_key="g")
    assert gem.active_ai_model == gem.gemini_model
    assert gem.active_embedding_model == gem.gemini_embed_model

    ant = make(anthropic_api_key="a", voyage_api_key="v")
    assert ant.active_ai_model == ant.anthropic_model
    assert ant.active_embedding_model == ant.voyage_embed_model

    none = make()
    assert none.active_ai_model is None
    assert none.active_embedding_model is None


def test_gemini_embeddings_are_requested_at_the_stored_vector_width():
    """A mismatch here wouldn't fail loudly — it would store vectors the
    pgvector column rejects, or worse, silently stop matching."""
    from app.models.problem import EMBEDDING_DIM

    assert EMBEDDING_DIM == 1024, (
        "Gemini is asked for EMBEDDING_DIM dimensions and Voyage's model "
        "returns 1024 natively; changing this needs a migration and a "
        "re-embed of every existing report."
    )
