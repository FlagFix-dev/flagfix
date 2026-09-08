import { type ClassValue, clsx } from "clsx";

/** Merge conditional class names — the one helper every component uses
 * instead of hand-building template strings. */
export function cn(...inputs: ClassValue[]): string {
  return clsx(inputs);
}

/** Decode a JWT's payload without verifying the signature — fine here
 * because the frontend never trusts this for authorization, only to read
 * non-secret claims (role, exp) for UI decisions. The backend is the only
 * thing that actually verifies tokens. */
export function decodeJwtPayload<T>(token: string): T | null {
  try {
    const base64Url = token.split(".")[1];
    if (!base64Url) return null;
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const json = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + c.charCodeAt(0).toString(16).padStart(2, "0"))
        .join("")
    );
    return JSON.parse(json) as T;
  } catch {
    return null;
  }
}

export function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function relativeDue(iso: string | null): { label: string; overdue: boolean } {
  if (!iso) return { label: "No SLA set", overdue: false };
  const due = new Date(iso).getTime();
  const now = Date.now();
  const diffMs = due - now;
  const overdue = diffMs < 0;
  const abs = Math.abs(diffMs);
  const hours = Math.round(abs / (1000 * 60 * 60));
  if (hours < 1) return { label: overdue ? "Just missed SLA" : "Due within the hour", overdue };
  if (hours < 24) return { label: `${overdue ? "Overdue by" : "Due in"} ${hours}h`, overdue };
  const days = Math.round(hours / 24);
  return { label: `${overdue ? "Overdue by" : "Due in"} ${days}d`, overdue };
}
