from app.models.enums import PriorityBucket
from app.services.priority import compute_priority


def test_routine_low_priority_report():
    score, bucket, reasons = compute_priority(
        severity=20, urgency=15, safety_flag=False, affected_users_estimate=1, recurrence_count=0
    )
    assert bucket == PriorityBucket.low
    assert score < 40
    assert "Routine report" in reasons["reasons"][0]


def test_safety_flag_alone_pushes_priority_up_significantly():
    without_safety, _, _ = compute_priority(
        severity=50, urgency=50, safety_flag=False, affected_users_estimate=1, recurrence_count=0
    )
    with_safety, _, reasons = compute_priority(
        severity=50, urgency=50, safety_flag=True, affected_users_estimate=1, recurrence_count=0
    )
    assert with_safety > without_safety
    assert any("safety" in r.lower() for r in reasons["reasons"])


def test_exposed_wire_style_report_is_critical():
    # Mirrors the worked example from the implementation plan (Section 8.4):
    # maxed severity/urgency/safety plus a widely-affecting issue (10+ people,
    # which saturates the affected-users component at 100) crosses the
    # Critical threshold (>=85) exactly as the documented formula intends.
    score, bucket, _ = compute_priority(
        severity=100, urgency=100, safety_flag=True, affected_users_estimate=10, recurrence_count=0
    )
    assert bucket == PriorityBucket.critical
    assert score >= 85


def test_first_report_of_a_severe_safety_hazard_is_critical_immediately():
    """The single most important property of this scorer.

    A live exposed wire reported by ONE person must be Critical straight
    away. Under a pure weighted average it scored 72 (High) and only
    reached Critical once ~10 people had reported it — which is backwards:
    the first report of a physical hazard is the one that most needs a
    fast response, not the tenth.
    """
    score, bucket, reasons = compute_priority(
        severity=90, urgency=90, safety_flag=True, affected_users_estimate=1, recurrence_count=0
    )
    assert bucket == PriorityBucket.critical
    assert score >= 85
    assert any("Critical automatically" in r for r in reasons["reasons"])


def test_any_safety_risk_is_at_least_high_even_when_mild():
    """A safety flag on an otherwise unremarkable report still can't be
    triaged as Low/Medium and left for three days."""
    score, bucket, reasons = compute_priority(
        severity=30, urgency=30, safety_flag=True, affected_users_estimate=1, recurrence_count=0
    )
    assert bucket == PriorityBucket.high
    assert score >= 65
    assert any("High automatically" in r for r in reasons["reasons"])


def test_safety_floor_never_lowers_an_already_higher_score():
    """The floor only ever raises. A widely-reported, recurring hazard
    must keep its earned score rather than being pulled down to 85."""
    score, bucket, _ = compute_priority(
        severity=100, urgency=100, safety_flag=True, affected_users_estimate=50, recurrence_count=5
    )
    assert bucket == PriorityBucket.critical
    assert score >= 85


def test_no_safety_flag_means_no_floor():
    """A non-safety report is still governed purely by the weighted
    formula — the floor must not leak into ordinary reports."""
    score, bucket, _ = compute_priority(
        severity=30, urgency=30, safety_flag=False, affected_users_estimate=1, recurrence_count=0
    )
    assert bucket == PriorityBucket.low
    assert score < 40


def test_recurrence_raises_priority_even_with_modest_severity():
    fresh, fresh_bucket, _ = compute_priority(
        severity=40, urgency=40, safety_flag=False, affected_users_estimate=1, recurrence_count=0
    )
    recurring, recurring_bucket, reasons = compute_priority(
        severity=40, urgency=40, safety_flag=False, affected_users_estimate=1, recurrence_count=3
    )
    assert recurring > fresh
    assert any("recurred" in r for r in reasons["reasons"])


def test_score_is_always_clamped_to_0_100():
    score, _, _ = compute_priority(
        severity=999, urgency=999, safety_flag=True, affected_users_estimate=999, recurrence_count=999
    )
    assert 0 <= score <= 100


def test_affected_users_estimate_increases_priority():
    few, _, _ = compute_priority(
        severity=50, urgency=50, safety_flag=False, affected_users_estimate=1, recurrence_count=0
    )
    many, _, reasons = compute_priority(
        severity=50, urgency=50, safety_flag=False, affected_users_estimate=20, recurrence_count=0
    )
    assert many > few
    assert any("affected" in r for r in reasons["reasons"])
