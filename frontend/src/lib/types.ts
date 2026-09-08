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
  owner_name: string;
  owner_email: string;
  owner_password: string;
}

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
}

export interface ProblemCreateRequest {
  description: string;
  location_id: string;
  landmark?: string | null;
  attachment_urls: string[];
}

export interface ProblemResponse {
  id: string;
  title: string;
  description: string;
  landmark: string | null;
  location_id: string;
  category_id: string | null;
  department_id: string | null;
  status: ProblemStatus;
  severity: number;
  urgency: number;
  safety_flag: boolean;
  priority_score: number;
  priority_reasons: Record<string, unknown>;
  cluster_id: string | null;
  sla_due_at: string | null;
  sla_breached: boolean;
  created_at: string;
  resolved_at: string | null;
}

export interface StatusChangeRequest {
  to_status: ProblemStatus;
  note?: string | null;
}

export interface FeedbackRequest {
  resolved_confirmed: boolean;
  rating?: number | null;
  comment?: string | null;
}

export interface ApiErrorBody {
  detail: string | { msg: string }[];
}
