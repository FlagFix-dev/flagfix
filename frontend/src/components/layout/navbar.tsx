"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { AccountMenu } from "@/components/layout/account-menu";
import { authApi } from "@/lib/api";
import { ADMIN_ROLES, STAFF_ROLES } from "@/lib/constants";
import { cn } from "@/lib/utils";

export function Navbar() {
  const { claims } = useAuth();
  const pathname = usePathname();
  const isStaff = claims ? STAFF_ROLES.includes(claims.role) : false;
  const isAdmin = claims ? ADMIN_ROLES.includes(claims.role) : false;

  // The JWT carries the user's id and role but not their name, so the
  // avatar's initials need one lookup. Failure is silent and falls back to
  // a neutral placeholder — a nav bar should never surface an error.
  const [displayName, setDisplayName] = useState("");
  useEffect(() => {
    if (!claims) return;
    authApi
      .getProfile()
      .then((p) => setDisplayName(p.name))
      .catch(() => undefined);
  }, [claims]);

  const links = [
    { href: "/dashboard", label: "Dashboard" },
    { href: "/report/new", label: "Report a problem" },
    ...(isStaff ? [{ href: "/clusters", label: "Grouped problems" }] : []),
    // Locations and People are admin/owner only — both require admin
    // server-side, so showing them to a resolver would only produce 403s.
    ...(isAdmin ? [{ href: "/locations", label: "Locations" }] : []),
    ...(isAdmin ? [{ href: "/people", label: "People" }] : []),
  ];

  return (
    <header className="sticky top-0 z-20 border-b border-ink-100/60 bg-surface/70 backdrop-blur-xl backdrop-saturate-150">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
        <div className="flex items-center gap-8">
          <Link href="/dashboard" className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-gradient text-xs font-bold text-white shadow-raised">
              F
            </div>
            <span className="text-base font-semibold text-ink-900">FlagFix</span>
          </Link>
          <nav className="hidden items-center gap-1 sm:flex">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  pathname === link.href ? "bg-brand-50 text-brand-700" : "text-ink-600 hover:bg-ink-50"
                )}
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>

        {/* Everything personal — profile, staff code, theme, docs, log out
            — now lives behind the avatar rather than crowding the bar. */}
        <AccountMenu displayName={displayName || "You"} />
      </div>
      <nav className="flex items-center gap-1 overflow-x-auto border-t border-ink-100 px-4 py-2 sm:hidden">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={cn(
              "shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium",
              pathname === link.href ? "bg-brand-50 text-brand-700" : "text-ink-600"
            )}
          >
            {link.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
