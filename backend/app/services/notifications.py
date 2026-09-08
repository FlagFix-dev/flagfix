"""
Lightweight notification helper. Every notification is always recorded as
a Notification row (so the in-app "My Reports" / notification feed always
works even if email is unconfigured). Email is a best-effort bonus on top —
sent via Resend if RESEND_API_KEY is set, silently skipped otherwise. A
notification failure must never fail the request that triggered it.
"""
import logging
import uuid
from datetime import datetime, timezone

import httpx
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.models.enums import NotificationType
from app.models.ops import Notification

logger = logging.getLogger("flagfix.notifications")

_SUBJECTS = {
    NotificationType.problem_submitted: "We received your report",
    NotificationType.problem_assigned: "Your report has been assigned",
    NotificationType.problem_in_progress: "Your report is being worked on",
    NotificationType.problem_resolved: "Your report has been marked resolved",
    NotificationType.problem_reopened: "Your report has been reopened",
    NotificationType.sla_breach: "SLA breach on an assigned report",
}


async def notify(
    session: AsyncSession,
    *,
    user_id: uuid.UUID,
    type: NotificationType,
    payload: dict,
    email: str | None = None,
) -> None:
    record = Notification(user_id=user_id, type=type, payload=payload, created_at=datetime.now(timezone.utc))
    session.add(record)

    settings = get_settings()
    if not settings.resend_api_key or not email:
        return

    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            await client.post(
                "https://api.resend.com/emails",
                headers={"Authorization": f"Bearer {settings.resend_api_key}"},
                json={
                    "from": "FlagFix <notifications@flagfix.app>",
                    "to": [email],
                    "subject": _SUBJECTS.get(type, "FlagFix update"),
                    "html": f"<p>{payload.get('message', 'You have an update on FlagFix.')}</p>",
                },
            )
    except Exception:  # noqa: BLE001 — an email provider hiccup must never break the request
        logger.exception("Failed to send notification email (in-app notification was still saved).")
