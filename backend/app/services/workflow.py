"""The resolution workflow's status state machine (Section 9 of the
implementation plan). Enforced here, server-side, so no client can push a
problem into an invalid state — e.g. jumping straight from `reported` to
`closed`, skipping resolution and the confirmation step entirely."""
from app.models.enums import ProblemStatus

_ALLOWED_TRANSITIONS: dict[ProblemStatus, set[ProblemStatus]] = {
    ProblemStatus.reported: {ProblemStatus.verified, ProblemStatus.assigned},
    ProblemStatus.verified: {ProblemStatus.assigned},
    ProblemStatus.assigned: {ProblemStatus.in_progress},
    ProblemStatus.in_progress: {ProblemStatus.resolved},
    ProblemStatus.resolved: {ProblemStatus.closed, ProblemStatus.reopened},
    ProblemStatus.reopened: {ProblemStatus.assigned, ProblemStatus.in_progress},
    ProblemStatus.closed: set(),  # terminal
}


class InvalidTransitionError(Exception):
    pass


def assert_valid_transition(current: ProblemStatus, target: ProblemStatus) -> None:
    allowed = _ALLOWED_TRANSITIONS.get(current, set())
    if target not in allowed:
        raise InvalidTransitionError(
            f"Cannot move a problem from '{current.value}' to '{target.value}'. "
            f"Valid next steps from '{current.value}': {sorted(s.value for s in allowed) or 'none (terminal state)'}"
        )
