"""
Step 6 of the AI pipeline: turn severity/urgency/safety/affected-users/
recurrence into one explainable priority score plus a plain-language
"why" — never just a bare number. See the implementation plan, Section 8.4.

This is pure, deterministic, and has no network calls or DB dependency,
which is deliberate: it's the one part of the AI pipeline that's trivial
to unit test exhaustively (see tests/test_priority.py), and correctness
here matters a lot more than the LLM's exact wording does.
"""
from app.models.enums import PriorityBucket


def compute_priority(
    *,
    severity: int,
    urgency: int,
    safety_flag: bool,
    affected_users_estimate: int,
    recurrence_count: int,
) -> tuple[int, PriorityBucket, dict]:
    severity = _clamp(severity)
    urgency = _clamp(urgency)
    affected_component = min(affected_users_estimate * 10, 100)
    recurrence_component = min(recurrence_count * 20, 100)
    safety_component = 100 if safety_flag else 0

    score = round(
        0.30 * severity
        + 0.20 * urgency
        + 0.20 * safety_component
        + 0.15 * affected_component
        + 0.15 * recurrence_component
    )
    score = _clamp(score)

    bucket = _bucket_for(score)
    reasons = _explain(
        severity=severity,
        urgency=urgency,
        safety_flag=safety_flag,
        affected_users_estimate=affected_users_estimate,
        recurrence_count=recurrence_count,
        score=score,
    )
    return score, bucket, reasons


def _clamp(value: int) -> int:
    return max(0, min(100, value))


def _bucket_for(score: int) -> PriorityBucket:
    if score >= 85:
        return PriorityBucket.critical
    if score >= 65:
        return PriorityBucket.high
    if score >= 40:
        return PriorityBucket.medium
    return PriorityBucket.low


def _explain(
    *, severity: int, urgency: int, safety_flag: bool, affected_users_estimate: int,
    recurrence_count: int, score: int,
) -> dict:
    """Plain-language reasons, rendered directly in the admin UI as the
    "Why is this priority?" callout. Always includes at least one reason,
    even for a Low-priority report, so the score is never a black box."""
    reasons: list[str] = []
    if safety_flag:
        reasons.append("Potential safety risk detected")
    if affected_users_estimate >= 3:
        reasons.append(f"{affected_users_estimate} people appear to be affected")
    if recurrence_count > 0:
        reasons.append(f"This problem has recurred {recurrence_count} time(s) after being resolved before")
    if urgency >= 75:
        reasons.append("Marked highly urgent")
    if severity >= 75:
        reasons.append("Marked highly severe")
    if not reasons:
        reasons.append("Routine report, no safety, urgency, or recurrence signals detected")

    return {"reasons": reasons, "score": score}
