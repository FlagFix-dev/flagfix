"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { useTheme, type Theme } from "@/components/theme/theme-provider";
import { ADMIN_ROLES, ROLE_LABELS } from "@/lib/constants";
import { cn } from "@/lib/utils";

/** Initials for the avatar — two letters at most, so "Narayana Kadali"
 * reads as "NK" rather than a cramped run of characters. */
function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const THEME_OPTIONS: { value: Theme; label: string; icon: string }[] = [
  { value: "light", label: "Light", icon: "☀" },
  { value: "dark", label: "Dark", icon: "☾" },
  { value: "system", label: "Auto", icon: "◐" },
];

export function AccountMenu({ displayName }: { displayName: string }) {
  const { claims, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const isAdmin = claims ? ADMIN_ROLES.includes(claims.role) : false;

  // Close on outside click and on Escape — the two things people
  // instinctively try to dismiss a menu.
  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent | TouchEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  if (!claims) return null;

  const itemClass =
    "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm text-ink-700 transition-colors hover:bg-ink-100";

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Account menu"
        className={cn(
          "flex h-9 w-9 items-center justify-center rounded-full bg-brand-gradient text-xs font-bold text-white",
          "shadow-raised transition-transform hover:-translate-y-0.5",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
        )}
      >
        {initialsOf(displayName)}
      </button>

      {open && (
        <div
          role="menu"
          className="animate-fade-up absolute right-0 z-30 mt-2 w-64 origin-top-right rounded-2xl border border-ink-100 bg-surface p-1.5 shadow-raised"
        >
          <div className="border-b border-ink-100 px-2.5 pb-2.5 pt-2">
            <p className="truncate text-sm font-semibold text-ink-900">{displayName}</p>
            <p className="mt-0.5 text-xs text-ink-500">{ROLE_LABELS[claims.role]}</p>
          </div>

          <div className="py-1">
            <Link href="/profile" onClick={() => setOpen(false)} className={itemClass} role="menuitem">
              <span aria-hidden="true">👤</span> My profile
            </Link>

            {isAdmin && (
              <Link
                href="/profile?tab=staff-code"
                onClick={() => setOpen(false)}
                className={itemClass}
                role="menuitem"
              >
                <span aria-hidden="true">🔑</span> Staff code
              </Link>
            )}

            <Link href="/docs" onClick={() => setOpen(false)} className={itemClass} role="menuitem">
              <span aria-hidden="true">📖</span> Docs &amp; help
            </Link>
          </div>

          <div className="border-t border-ink-100 px-2.5 py-2">
            <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-ink-500">Appearance</p>
            <div className="grid grid-cols-3 gap-1">
              {THEME_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setTheme(opt.value)}
                  aria-pressed={theme === opt.value}
                  className={cn(
                    "rounded-lg border px-1.5 py-1.5 text-xs font-medium transition-colors",
                    theme === opt.value
                      ? "border-brand-500 bg-brand-50 text-brand-700"
                      : "border-ink-200 text-ink-600 hover:bg-ink-100"
                  )}
                >
                  <span aria-hidden="true">{opt.icon}</span>
                  <span className="ml-1">{opt.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="border-t border-ink-100 py-1">
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                logout();
              }}
              className={cn(itemClass, "text-red-600 hover:bg-red-50")}
              role="menuitem"
            >
              <span aria-hidden="true">⏻</span> Log out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
