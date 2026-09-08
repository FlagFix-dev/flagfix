import { decodeJwtPayload } from "./utils";
import type { JwtPayload } from "./types";

/**
 * All local session state lives under one storage key so there's a single
 * place to clear on logout and a single shape to reason about. Nothing
 * sensitive beyond the JWTs themselves is stored — no passwords, ever.
 */
const STORAGE_KEY = "flagfix.session";

interface StoredSession {
  accessToken: string;
  refreshToken: string;
  orgSlug: string;
}

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

export function saveSession(session: StoredSession): void {
  if (!isBrowser()) return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

export function getSession(): StoredSession | null {
  if (!isBrowser()) return null;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredSession;
  } catch {
    return null;
  }
}

export function clearSession(): void {
  if (!isBrowser()) return;
  window.localStorage.removeItem(STORAGE_KEY);
}

export function updateTokens(accessToken: string, refreshToken: string): void {
  const current = getSession();
  if (!current) return;
  saveSession({ ...current, accessToken, refreshToken });
}

/** The decoded (unverified) claims of the current access token — used only
 * for UI decisions like "which nav links to show", never for security. */
export function getCurrentClaims(): JwtPayload | null {
  const session = getSession();
  if (!session) return null;
  return decodeJwtPayload<JwtPayload>(session.accessToken);
}

export function isLoggedIn(): boolean {
  return getSession() !== null;
}
