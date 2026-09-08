import uuid
from typing import Optional

from sqlalchemy import ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base
from app.models.base import TimestampMixin, UUIDPKMixin


class ProblemCategory(Base, UUIDPKMixin, TimestampMixin):
    """
    Org-configurable categories (Plumbing, IT/Network, Electrical, ...).
    `default_department_id` drives deterministic routing (services/routing.py) —
    the LLM's suggested department is only a fallback when this is unset or
    the report is genuinely ambiguous.
    """
    __tablename__ = "problem_categories"

    org_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("organizations.id"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    default_department_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        ForeignKey("departments.id"), nullable=True
    )
