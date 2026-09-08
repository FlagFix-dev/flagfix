"""All fixed vocabularies used across the schema, in one place so a status
name is never typo'd differently in two files."""
import enum


class OrgType(str, enum.Enum):
    school = "school"
    college = "college"
    university = "university"
    hostel = "hostel"
    pg = "pg"


class OrgPlan(str, enum.Enum):
    starter = "starter"
    professional = "professional"
    enterprise = "enterprise"


class UserRole(str, enum.Enum):
    reporter = "reporter"
    resolver = "resolver"
    admin = "admin"
    owner = "owner"


class LocationType(str, enum.Enum):
    campus = "campus"
    building = "building"
    floor = "floor"
    room = "room"
    corridor = "corridor"
    common_area = "common_area"


class ProblemStatus(str, enum.Enum):
    reported = "reported"
    verified = "verified"
    assigned = "assigned"
    in_progress = "in_progress"
    resolved = "resolved"
    closed = "closed"
    reopened = "reopened"


class PriorityBucket(str, enum.Enum):
    critical = "critical"
    high = "high"
    medium = "medium"
    low = "low"


class ClusterStatus(str, enum.Enum):
    open = "open"
    resolved = "resolved"


class RelationshipType(str, enum.Enum):
    duplicate = "duplicate"
    related = "related"
    recurring = "recurring"


class NotificationType(str, enum.Enum):
    problem_submitted = "problem_submitted"
    problem_assigned = "problem_assigned"
    problem_in_progress = "problem_in_progress"
    problem_resolved = "problem_resolved"
    problem_reopened = "problem_reopened"
    sla_breach = "sla_breach"
