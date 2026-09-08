"""Organizations, locations, departments, users, and each user's role
within an org. This is the multi-tenant backbone every other table hangs off."""
import uuid
from typing import Optional

from sqlalchemy import Boolean, ForeignKey, String, true
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base
from app.models.base import TimestampMixin, UUIDPKMixin
from app.models.enums import LocationType, OrgPlan, OrgType, UserRole


class Organization(Base, UUIDPKMixin, TimestampMixin):
    __tablename__ = "organizations"

    name: Mapped[str] = mapped_column(String(200), nullable=False)
    slug: Mapped[str] = mapped_column(String(80), unique=True, nullable=False, index=True)
    type: Mapped[OrgType] = mapped_column(nullable=False)
    plan: Mapped[OrgPlan] = mapped_column(nullable=False, default=OrgPlan.starter)

    locations: Mapped[list["Location"]] = relationship(back_populates="organization")
    departments: Mapped[list["Department"]] = relationship(back_populates="organization")


class Location(Base, UUIDPKMixin, TimestampMixin):
    """
    A node in the org's space tree: campus -> building -> floor -> room, plus
    non-room nodes like `corridor` / `common_area` so a report about a shared
    space (not a specific room) still has a precise, pickable location.
    """
    __tablename__ = "locations"

    org_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("organizations.id"), nullable=False, index=True)
    parent_location_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        ForeignKey("locations.id"), nullable=True
    )
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    type: Mapped[LocationType] = mapped_column(nullable=False)
    # Human-readable materialized path e.g. "Block A / Floor 2 / Room 203" — kept
    # denormalized purely so the UI never has to walk the tree just to show a label.
    path: Mapped[str] = mapped_column(String(500), nullable=False)

    organization: Mapped["Organization"] = relationship(back_populates="locations")
    # Self-referential tree: a Location's `parent` and its `children`.
    parent: Mapped[Optional["Location"]] = relationship(
        "Location", remote_side="Location.id", back_populates="children"
    )
    children: Mapped[list["Location"]] = relationship(
        "Location", back_populates="parent"
    )


class Department(Base, UUIDPKMixin, TimestampMixin):
    __tablename__ = "departments"

    org_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("organizations.id"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False)

    organization: Mapped["Organization"] = relationship(back_populates="departments")


class User(Base, UUIDPKMixin, TimestampMixin):
    """
    A person. Deliberately NOT tied to a single org_id — one person (e.g. a
    warden who also studies part-time, or a multi-property manager) can hold
    a role in more than one organization via UserOrgRole below.
    """
    __tablename__ = "users"

    name: Mapped[str] = mapped_column(String(150), nullable=False)
    email: Mapped[Optional[str]] = mapped_column(String(255), unique=True, nullable=True, index=True)
    phone: Mapped[Optional[str]] = mapped_column(String(20), unique=True, nullable=True, index=True)
    password_hash: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, server_default=true(), nullable=False)

    org_roles: Mapped[list["UserOrgRole"]] = relationship(back_populates="user")


class UserOrgRole(Base, UUIDPKMixin, TimestampMixin):
    __tablename__ = "user_org_roles"

    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    org_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("organizations.id"), nullable=False, index=True)
    role: Mapped[UserRole] = mapped_column(nullable=False)
    department_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        ForeignKey("departments.id"), nullable=True
    )
    # A reporter's "home" location (e.g. their hostel room), used only to
    # pre-fill the location picker as a convenience default — never trusted
    # as the actual report location without the reporter confirming it.
    default_location_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        ForeignKey("locations.id"), nullable=True
    )

    user: Mapped["User"] = relationship(back_populates="org_roles")
