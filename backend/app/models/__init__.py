"""
Import every model module here so Alembic's `--autogenerate` and
SQLAlchemy's mapper configuration see the full schema, even though nothing
in this file is used directly.
"""
from app.models.tenancy import Department, Location, Organization, User, UserOrgRole  # noqa: F401
from app.models.catalog import ProblemCategory  # noqa: F401
from app.models.problem import (  # noqa: F401
    Assignment,
    Attachment,
    Problem,
    ProblemCluster,
    ProblemEmbedding,
    ProblemRelationship,
    StatusHistory,
)
from app.models.ops import AuditLog, Feedback, Notification, SLARule  # noqa: F401
