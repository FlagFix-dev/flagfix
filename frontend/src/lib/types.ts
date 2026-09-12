/**
 * These types mirror the backend's Pydantic schemas and enums field-for-
 * field (see backend/app/schemas/*.py and backend/app/models/enums.py).
 * Keeping them hand-aligned like this — rather than importing across the
 * Python/TypeScript boundary — means a schema change on the backend will
 * show up as a type error here instead of a silent runtime mismatch.
 */

export type OrgType = "school" | "college" | "university" | "hostel" | "pg";

export type UserRole = "reporter" | "resolver" | "admin" | "owner";

export type LocationType =
  | "campus"
  | "building"
  | "floor"
  | "room"
  | "corridor"
  | "common_area";

export type ProblemStatus =
  | "reported"
  | "verified"
  | "assigned"
  | "in_progress"
  | "resolved"
  | "closed"
  | "reopened";

export type PriorityBucket = "critical" | "high" | "medium" | "low";

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export interface JwtPayload {
  sub: string;
  org_id: string;
  role: UserRole;
  exp: number;
  type: "access" | "refresh";
}

export interface OrgCreateRequest {
  org_name: string;
  org_slug: string;
  org_type: OrgType;
  address: string;
  city: string;
  state: string;
  num_blocks?: number | null;
  owner_name: string;
  owner_email: string;
  owner_password: string;
}

/** The two roles a person can claim for themselves on the signup form.
 * `admin`/`owner` are never offered here — see backend/app/api/auth.py's
 * signup(), which enforces the same restriction server-side regardless of
 * what a client sends. */
export type SelfSignupRole = "reporter" | "resolver";

export interface LocationResponse {
  id: string;
  name: string;
  type: LocationType;
  parent_location_id: string | null;
  path: string;
}

export interface LocationCreateRequest {
  name: string;
  type: LocationType;
  parent_location_id?: string | null;
}

export interface DepartmentResponse {
  id: string;
  name: string;
}

export interface CategoryResponse {
  id: string;
  name: string;
  default_department_id: string | null;
  /** Rough "how long this usually takes" heuristic in hours — see
   * backend/app/api/orgs.py's seeded defaults. Not an SLA promise. */
  typical_resolution_hours: number | null;
}

export interface AttachmentInput {
  url: string;
  content_type: string;
}

export interface AttachmentResponse {
  id: string;
  url: string;
  content_type: string;
}

export interface ProblemCreateRequest {
  description: string;
  location_id: string;
  landmark?: string | null;
  attachments: AttachmentInput[];
}

export interface ProblemResponse {
  id: string;
  title: string;
  description: string;
  landmark: string | null;
  location_id: string;
  category_id: string | null;
  department_id: string | null;
  assigned_to_user_id: string | null;
  status: ProblemStatus;
  severity: number;
  urgency: number;
  safety_flag: boolean;
  priority_score: number;
  priority_reasons: Record<string, unknown>;
  cluster_id: string | null;
  estimated_resolution_hours: number | null;
  latest_update: string | null;
  latest_update_at: string | null;
  attachments: AttachmentResponse[];
  sla_due_at: string | null;
  sla_breached: boolean;
  created_at: string;
  resolved_at: string | null;
}

export interface StatusChangeRequest {
  to_status: ProblemStatus;
  note?: string | null;
}

export interface ProgressUpdateRequest {
  message: string;
}

export interface FeedbackRequest {
  resolved_confirmed: boolean;
  rating?: number | null;
  comment?: string | null;
}

export interface OrgProfileResponse {
  id: string;
  name: string;
  slug: string;
  type: OrgType;
  address: string | null;
  city: string | null;
  state: string | null;
  num_blocks: number | null;
  staff_code: string | null;
}

export interface OrgStatsResponse {
  total_staff: number;
  staff_online: number;
  total_reports: number;
  pending: number;
  accepted: number;
  resolved: number;
  closed: number;
}

export interface ApiErrorBody {
  detail: string | { msg: string }[];
}
