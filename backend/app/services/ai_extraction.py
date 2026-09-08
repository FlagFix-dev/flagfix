"""
Step 2 of the AI pipeline (see the implementation plan, Section 8): turn a
raw report into structured fields using Claude, via forced tool-use so the
model can only reply with valid, schema-shaped JSON — never free text we'd
have to hope parses correctly.

Design choices worth knowing about:
  * If ANTHROPIC_API_KEY is not set, `extract()` returns a safe, obviously-
    generic fallback instead of raising. This means the whole app boots and
    is testable end-to-end on day one, before any API key exists, and an
    outage on Anthropic's side degrades the product (everything lands in
    "Other / Medium priority for a human to triage") instead of breaking it.
  * Retries with backoff on transient network errors (tenacity), but NOT on
    a validation failure — if the model returns something malformed, we
    fall back immediately rather than hammering the API.
  * The category returned here is later mapped against the org's own
    configured categories in services/routing.py — the LLM is not the
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


def extract(description: str, landmark: str | None = None) -> ExtractionResult:
    settings = get_settings()
    if not settings.anthropic_api_key:
        logger.info("AI extraction skipped (no ANTHROPIC_API_KEY set) — using fallback.")
        return _fallback_result(description)

    try:
        raw = _call_claude(description, landmark)
        return ExtractionResult.model_validate(raw)
    except Exception:  # noqa: BLE001 — any failure here must degrade gracefully, never 500 the request
        logger.exception("AI extraction failed; using fallback result.")
        return _fallback_result(description)
