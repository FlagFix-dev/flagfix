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
  /** Send exactly one of these two: a picked location, or a written one
   * (when the reporter chooses "Somewhere else — not in this list"). The
   * backend rejects both-or-neither. */
  location_id?: string | null;
  custom_location?: string | null;
  landmark?: string | null;
  attachments: AttachmentInput[];
}

export interface ProblemResponse {
  id: string;
  title: string;
  description: string;
  landmark: string | null;
  location_id: string | null;
  custom_location: string | null;
  ai_reasoning: string | null;
  ai_low_confidence: boolean;
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

export interface UserProfile {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  role: UserRole;
  org_id: string;
  org_name: string;
  org_slug: string;
  created_at: string;
}

/** Email is deliberately not editable — it's the login identity and is
 * globally unique, so changing it safely needs email verification. */
export interface ProfileUpdateRequest {
  name: string;
  phone?: string | null;
}

export interface MemberResponse {
  id: string;
  name: string;
  email: string | null;
  role: UserRole;
  is_active: boolean;
  last_seen_at: string | null;
  is_online: boolean;
  joined_at: string;
}

export interface MemberListResponse {
  total_students: number;
  total_staff: number;
  students_online: number;
  staff_online: number;
  members: MemberResponse[];
}

export type ClusterStatus = "open" | "resolved";

export interface ClusterMemberResponse {
  id: string;
  title: string;
  description: string;
  created_at: string;
  status: ProblemStatus;
  location_id: string | null;
  custom_location: string | null;
}

/** One underlying problem that several separate reports turned out to be
 * describing — the visible output of the similarity engine. */
export interface ClusterResponse {
  id: string;
  canonical_title: string;
  status: ClusterStatus;
  report_count: number;
  affected_users_estimate: number;
  recurrence_count: number;
  first_reported_at: string;
  last_reported_at: string;
  category_id: string | null;
  location_id: string | null;
  top_priority_score: number;
  members: ClusterMemberResponse[];
}

/** Whether the AI pipeline is actually running, or whether reports are
 * going through the rule-based fallback. */
export interface AiStatusResponse {
  extraction_enabled: boolean;
  similarity_enabled: boolean;
  extraction_model: string | null;
  embedding_model: string | null;
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
