import { clearSession, getSession, updateTokens } from "./session";
import type {
  CategoryResponse,
  DepartmentResponse,
  FeedbackRequest,
  LocationCreateRequest,
  LocationResponse,
  OrgCreateRequest,
  ProblemCreateRequest,
  ProblemResponse,
  ProblemStatus,
  StatusChangeRequest,
  TokenResponse,
} from "./types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function extractErrorMessage(res: Response): Promise<string> {
  try {
    const body = await res.json();
    if (typeof body.detail === "string") return body.detail;
    if (Array.isArray(body.detail)) {
      return body.detail.map((d: { msg: string }) => d.msg).join(", ");
    }
  } catch {
    // response wasn't JSON — fall through to the generic message
  }
  return `Request failed (${res.status})`;
}

let refreshInFlight: Promise<boolean> | null = null;

/** Refreshes the access token exactly once even if several requests hit a
 * 401 at the same time — without this guard, a page that fires three
 * requests at once would race three separate refresh calls. */
async function refreshAccessToken(): Promise<boolean> {
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    const session = getSession();
    if (!session) return false;
    try {
      const res = await fetch(`${API_URL}/api/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: session.refreshToken }),
      });
      if (!res.ok) return false;
      const tokens: TokenResponse = await res.json();
      updateTokens(tokens.access_token, tokens.refresh_token);
      return true;
    } catch {
      return false;
    }
  })();

  const result = await refreshInFlight;
  refreshInFlight = null;
  return result;
}

interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  auth?: boolean;
  query?: Record<string, string | undefined>;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, auth = true, query } = options;

  let url = `${API_URL}${path}`;
  if (query) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined) params.set(key, value);
    }
    const qs = params.toString();
    if (qs) url += `?${qs}`;
  }

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (auth) {
    const session = getSession();
    if (session) headers.Authorization = `Bearer ${session.accessToken}`;
  }

  const res = await fetch(url, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401 && auth) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      const session = getSession();
      const retryHeaders = { ...headers };
      if (session) retryHeaders.Authorization = `Bearer ${session.accessToken}`;
      const retryRes = await fetch(url, {
        method,
        headers: retryHeaders,
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
      if (!retryRes.ok) throw new ApiError(await extractErrorMessage(retryRes), retryRes.status);
      if (retryRes.status === 204) return undefined as T;
      return (await retryRes.json()) as T;
    }
    clearSession();
    throw new ApiError("Your session has expired. Please log in again.", 401);
  }

  if (!res.ok) throw new ApiError(await extractErrorMessage(res), res.status);
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

// --- Auth -------------------------------------------------------------

export const authApi = {
  signup: (input: { name: string; email: string; password: string; org_slug: string }) =>
    request<TokenResponse>("/api/auth/signup", { method: "POST", body: input, auth: false }),

  login: (input: { email: string; password: string; org_slug: string }) =>
    request<TokenResponse>("/api/auth/login", { method: "POST", body: input, auth: false }),
};

// --- Organizations ------------------------------------------------------

export const orgsApi = {
  create: (input: OrgCreateRequest) =>
    request<TokenResponse>("/api/orgs", { method: "POST", body: input, auth: false }),

  listLocations: () => request<LocationResponse[]>("/api/orgs/locations"),

  createLocation: (input: LocationCreateRequest) =>
    request<LocationResponse>("/api/orgs/locations", { method: "POST", body: input }),

  listDepartments: () => request<DepartmentResponse[]>("/api/orgs/departments"),

  createDepartment: (input: { name: string }) =>
    request<DepartmentResponse>("/api/orgs/departments", { method: "POST", body: input }),

  listCategories: () => request<CategoryResponse[]>("/api/orgs/categories"),

  createCategory: (input: { name: string; default_department_id?: string | null }) =>
    request<CategoryResponse>("/api/orgs/categories", { method: "POST", body: input }),
};

// --- Problems -------------------------------------------------------------

export const problemsApi = {
  create: (input: ProblemCreateRequest) =>
    request<ProblemResponse>("/api/problems", { method: "POST", body: input }),

  listMine: () => request<ProblemResponse[]>("/api/problems/mine"),

  list: (filters: { status?: ProblemStatus; category_id?: string; location_id?: string } = {}) =>
    request<ProblemResponse[]>("/api/problems", { query: filters }),

  get: (id: string) => request<ProblemResponse>(`/api/problems/${id}`),

  changeStatus: (id: string, input: StatusChangeRequest) =>
    request<ProblemResponse>(`/api/problems/${id}/status`, { method: "POST", body: input }),

  submitFeedback: (id: string, input: FeedbackRequest) =>
    request<ProblemResponse>(`/api/problems/${id}/feedback`, { method: "POST", body: input }),
};
