import type { LocationType, OrgType, PriorityBucket, ProblemStatus, UserRole } from "./types";

export const ORG_TYPE_LABELS: Record<OrgType, string> = {
  school: "School",
  college: "College",
  university: "University",
  hostel: "Hostel",
  pg: "PG / Co-living",
};

export const LOCATION_TYPE_LABELS: Record<LocationType, string> = {
  campus: "Campus",
  building: "Building",
  floor: "Floor",
  room: "Room",
  corridor: "Corridor",
  common_area: "Common area",
};

export const STATUS_LABELS: Record<ProblemStatus, string> = {
  reported: "Reported",
  verified: "Verified",
  assigned: "Assigned",
  in_progress: "In progress",
  resolved: "Resolved",
  closed: "Closed",
  reopened: "Reopened",
};

/** Mirrors backend/app/services/workflow.py exactly — the UI should only
 * ever offer a transition the server will actually accept. Keep these two
 * lists in sync if the workflow changes. */
export const ALLOWED_TRANSITIONS: Record<ProblemStatus, ProblemStatus[]> = {
  reported: ["verified", "assigned"],
  verified: ["assigned"],
  assigned: ["in_progress"],
  in_progress: ["resolved"],
  resolved: ["closed", "reopened"],
  reopened: ["assigned", "in_progress"],
  closed: [],
};

export const ROLE_LABELS: Record<UserRole, string> = {
  reporter: "Reporter",
  resolver: "Resolver",
  admin: "Admin",
  owner: "Owner",
};

/** Mirrors backend/app/services/priority.py's _bucket_for thresholds. */
export function priorityBucketFor(score: number): PriorityBucket {
  if (score >= 85) return "critical";
  if (score >= 65) return "high";
  if (score >= 40) return "medium";
  return "low";
}

export const STAFF_ROLES: UserRole[] = ["resolver", "admin", "owner"];

/** Copy for the "how many blocks" field on the onboarding form — worded to
 * match how each institution type actually talks about its own layout. */
export const NUM_BLOCKS_LABEL: Record<OrgType, string> = {
  school: "Number of buildings/blocks",
  college: "Number of buildings/blocks",
  university: "Number of buildings/blocks",
  hostel: "Number of hostel blocks",
  pg: "Number of blocks/wings",
};

export const NUM_BLOCKS_HINT: Record<OrgType, string> = {
  school: "e.g. Main Building, Science Block, Admin Block",
  college: "e.g. Main Building, Library Block, Hostel Block",
  university: "e.g. Academic Block, Library, Hostel Block A",
  hostel: "e.g. Block A, Block B, Block C",
  pg: "e.g. Wing A, Wing B, Ground Floor",
};
