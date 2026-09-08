"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/components/auth/auth-provider";
import { Button } from "@/components/ui/button";
import { ROLE_LABELS, STAFF_ROLES } from "@/lib/constants";
import { cn } from "@/lib/utils";

export function Navbar() {
  const { claims, logout } = useAuth();
  const pathname = usePathname();
  const isStaff = claims ? STAFF_ROLES.includes(claims.role) : false;

  const links = [
    { href: "/dashboard", label: "Dashboard" },
    { href: "/report/new", label: "Report a problem" },
    ...(isStaff ? [{ href: "/locations", label: "Locations" }] : []),
  ];

  return (
    <header className="sticky top-0 z-10 border-b border-ink-100 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
        <div className="flex items-center gap-8">
          <Link href="/dashboard" className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-600 text-xs font-bold text-white">
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

        <div className="flex items-center gap-3">
          {claims && (
            <span className="hidden text-sm text-ink-500 sm:inline">{ROLE_LABELS[claims.role]}</span>
          )}
          <Button variant="secondary" size="sm" onClick={logout}>
            Log out
          </Button>
        </div>
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
