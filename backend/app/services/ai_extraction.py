"""
Step 2 of the AI pipeline (see the implementation plan, Section 8): turn a
raw report into structured fields.

Two providers, one contract. Google (Gemini) and Anthropic (Claude) can
each do this job; which one runs is decided by `settings.active_ai_provider`
(see config.py), so switching vendor is an environment-variable change with
no code change. Both are driven into the SAME `ExtractionResult` shape, and
both are forced to emit schema-valid JSON rather than free text we'd have to
hope parses — Gemini via `response_schema`, Claude via forced tool-use.

Design choices worth knowing about:
  * With no provider key configured, `extract()` returns a safe,
    obviously-generic fallback instead of raising. The whole app therefore
    boots and is testable end-to-end before any API key exists, and a
    provider outage degrades the product (everything lands in "Other /
    Medium priority for a human to triage") instead of breaking it.
  * Retries with backoff on transient network errors (tenacity), but NOT on
    a validation failure — if the model returns something malformed, we
    fall back immediately rather than hammering the API.
  * The category returned here is later mapped against the org's own
    configured categories in services/routing.py — the model is not the
    source of truth for what departments exist.
"""
import json
import logging

from tenacity import retry, retry_if_exception_type, stop_after_attempt, wait_exponential

from app.config import get_settings
from app.schemas.ai import ExtractionResult

logger = logging.getLogger("flagfix.ai_extraction")

_SYSTEM_PROMPT = """You are an operations triage assistant for a campus/hostel \
problem-reporting system called FlagFix. Given a user's report, extract \
structured fields using ONLY information present in the text. Do not invent \
details. Categories must be one of: Infrastructure, IT, Electrical, Plumbing, \
Cleanliness, Security, Hostel/Residence, Other. If the report is vague or you \
are unsure of severity/urgency, set low_confidence to true and pick reasonable \
middle-of-the-road values rather than guessing at extremes."""

_TOOL_SCHEMA = {
    "name": "extract_problem_fields",
    "description": "Record the structured triage fields extracted from a problem report.",
    "input_schema": {
        "type": "object",
        "properties": {
            "title": {"type": "string", "description": "A short summary, 8 words or fewer."},
            "category": {
                "type": "string",
                "enum": ["Infrastructure", "IT", "Electrical", "Plumbing", "Cleanliness",
                         "Security", "Hostel/Residence", "Other"],
            },
            "severity": {"type": "integer", "minimum": 0, "maximum": 100},
            "urgency": {"type": "integer", "minimum": 0, "maximum": 100},
            "safety_flag": {"type": "boolean"},
            "suggested_department": {"type": "string"},
            "reasoning": {"type": "string", "description": "25 words or fewer, shown to an admin."},
            "low_confidence": {"type": "boolean"},
        },
        "required": ["title", "category", "severity", "urgency", "safety_flag",
                      "suggested_department", "reasoning"],
    },
}


def _fallback_result(description: str) -> ExtractionResult:
    """Used when the AI pipeline is disabled or the API call ultimately fails.
    Deliberately mid-priority and clearly generic, so a human admin notices
    and triages it manually rather than it silently vanishing."""
    return ExtractionResult(
        title=(description[:60] + "...") if len(description) > 60 else description,
        category="Other",
        severity=50,
        urgency=50,
        safety_flag=False,
        suggested_department="General Maintenance",
        reasoning="AI extraction unavailable — routed for manual admin triage.",
        low_confidence=True,
    )


@retry(
    retry=retry_if_exception_type((ConnectionError, TimeoutError)),
    wait=wait_exponential(multiplier=1, min=1, max=8),
    stop=stop_after_attempt(3),
    reraise=True,
)
def _call_claude(description: str, landmark: str | None) -> dict:
    import anthropic  # imported lazily so the module still loads without the package during tests

    settings = get_settings()
    client = anthropic.Anthropic(api_key=settings.anthropic_api_key)

    user_text = description if not landmark else f"{description}\n\nLandmark note: {landmark}"

    response = client.messages.create(
        model=settings.anthropic_model,
        max_tokens=400,
        system=_SYSTEM_PROMPT,
        tools=[_TOOL_SCHEMA],
        tool_choice={"type": "tool", "name": "extract_problem_fields"},
        messages=[{"role": "user", "content": user_text}],
    )
    for block in response.content:
        if block.type == "tool_use":
            return block.input
    raise ValueError("Claude did not return a tool_use block")


@retry(
    retry=retry_if_exception_type((ConnectionError, TimeoutError)),
    wait=wait_exponential(multiplier=1, min=1, max=8),
    stop=stop_after_attempt(3),
    reraise=True,
)
def _call_gemini(description: str, landmark: str | None) -> dict:
    from google import genai  # imported lazily, as with anthropic above
    from google.genai import types

    settings = get_settings()
    client = genai.Client(api_key=settings.gemini_api_key)

    user_text = description if not landmark else f"{description}\n\nLandmark note: {landmark}"

    response = client.models.generate_content(
        model=settings.gemini_model,
        contents=user_text,
        config=types.GenerateContentConfig(
            system_instruction=_SYSTEM_PROMPT,
            # Gemini's equivalent of Claude's forced tool-use: the model is
            # constrained to emit JSON matching this schema, so there is no
            # prose to strip and no "sometimes it adds a code fence" class
            # of bug. The Pydantic model IS the schema, which means the
            # contract can't drift from what we parse into.
            response_mime_type="application/json",
            response_schema=ExtractionResult,
            max_output_tokens=400,
            # Triage should be reproducible: the same report shouldn't get a
            # different severity on a re-run.
            temperature=0,
        ),
    )

    text = (response.text or "").strip()
    if not text:
        raise ValueError("Gemini returned an empty response")
    return json.loads(text)


def _extract_with(provider: str, description: str, landmark: str | None) -> dict:
    if provider == "gemini":
        return _call_gemini(description, landmark)
    if provider == "anthropic":
        return _call_claude(description, landmark)
    raise ValueError(f"Unknown AI provider: {provider!r}")


def extract(description: str, landmark: str | None = None) -> ExtractionResult:
    settings = get_settings()
    provider = settings.active_ai_provider
    if provider is None:
        logger.info("AI extraction skipped (no provider key configured) — using fallback.")
        return _fallback_result(description)

    try:
        raw = _extract_with(provider, description, landmark)
        return ExtractionResult.model_validate(raw)
    except Exception:  # noqa: BLE001 — any failure here must degrade gracefully, never 500 the request
        logger.exception("AI extraction failed via %s; using fallback result.", provider)
        return _fallback_result(description)
