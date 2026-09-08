import pytest

from app.models.enums import ProblemStatus
from app.services.workflow import InvalidTransitionError, assert_valid_transition


def test_happy_path_transitions_are_all_valid():
    path = [
        ProblemStatus.reported,
        ProblemStatus.assigned,
        ProblemStatus.in_progress,
        ProblemStatus.resolved,
        ProblemStatus.closed,
    ]
    for current, target in zip(path, path[1:]):
        assert_valid_transition(current, target)  # must not raise


def test_cannot_skip_straight_from_reported_to_closed():
    with pytest.raises(InvalidTransitionError):
        assert_valid_transition(ProblemStatus.reported, ProblemStatus.closed)


def test_closed_is_terminal():
    for target in ProblemStatus:
        if target == ProblemStatus.closed:
            continue
        with pytest.raises(InvalidTransitionError):
            assert_valid_transition(ProblemStatus.closed, target)


def test_resolved_can_reopen_on_reporter_disagreement():
    assert_valid_transition(ProblemStatus.resolved, ProblemStatus.reopened)  # must not raise


def test_reopened_goes_back_into_the_active_workflow():
    assert_valid_transition(ProblemStatus.reopened, ProblemStatus.assigned)  # must not raise
