"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { FullPageSpinner } from "@/components/ui/spinner";
import { useAuth } from "@/components/auth/auth-provider";
import { ApiError, orgsApi } from "@/lib/api";
import { ADMIN_ROLES, ROLE_LABELS } from "@/lib/constants";
import { formatDateTime } from "@/lib/utils";
import { cn } from "@/lib/utils";
import type { MemberListResponse, UserRole } from "@/lib/types";

// Matches the dashboard's refresh cadence. "Online" is a 15-minute
// heuristic server-side, so polling faster than this would only produce
// motion, not information.
const REFRESH_INTERVAL_MS = 45_000;

function StatTile({ label, value, sub, tone }: { label: string; value: number; sub?: string; tone?: "green" }) {
  return (
    <Card elevated>
      <CardBody className="py-4">
        <p className="text-xs font-medium uppercase tracking-wide text-ink-500">{label}</p>
        <p className={cn("mt-1 text-2xl font-bold", tone === "green" ? "text-green-600" : "text-ink-900")}>
          {value}
        </p>
        {sub && <p className="mt-0.5 text-xs text-ink-500">{sub}</p>}
      </CardBody>
    </Card>
  );
}

export default function PeoplePage() {
  const { claims } = useAuth();
  const router = useRouter();
  const isAdmin = claims ? ADMIN_ROLES.includes(claims.role) : false;

  const [data, setData] = useState<MemberListResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [roleFilter, setRoleFilter] = useState<UserRole | "">("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (claims && !isAdmin) router.replace("/dashboard");
  }, [claims, isAdmin, router]);

  useEffect(() => {
    if (!isAdmin) return;
    let cancelled = false;

    function load() {
      orgsApi
        .listMembers()
        .then((d) => {
          if (cancelled) return;
          setData(d);
          setError(null);
        })
        .catch((err) => {
          if (cancelled) return;
          setError(err instanceof ApiError ? err.message : "Could not load people.");
          // Never leave the table stuck on "Loading…" beneath an error.
          setData((prev) => prev ?? { total_students: 0, total_staff: 0, students_online: 0, staff_online: 0, members: [] });
        });
    }

    load();
    const interval = setInterval(load, REFRESH_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [isAdmin]);

  const visible = useMemo(() => {
    if (!data) return [];
    const q = search.trim().toLowerCase();
    return data.members.filter((m) => {
      if (roleFilter && m.role !== roleFilter) return false;
      if (!q) return true;
      return m.name.toLowerCase().includes(q) || (m.email ?? "").toLowerCase().includes(q);
    });
  }, [data, roleFilter, search]);

  if (!claims || !isAdmin) return <FullPageSpinner />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-ink-900">People</h1>
        <p className="mt-1 max-w-2xl text-sm text-ink-600">
          Everyone who has joined your workspace using your institution's URL, and who's around right
          now.
        </p>
      </div>

      {error && <Alert tone="error">{error}</Alert>}

      {data && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatTile label="Students" value={data.total_students} />
          <StatTile
            label="Students online"
            value={data.students_online}
            tone="green"
            sub="active in last 15 min"
          />
          <StatTile label="Staff" value={data.total_staff} />
          <StatTile label="Staff online" value={data.staff_online} tone="green" sub="active in last 15 min" />
        </div>
      )}

      <Card>
        <CardHeader className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle>Members{data ? ` (${data.members.length})` : ""}</CardTitle>
          <div className="flex flex-wrap gap-2">
            <Input
              placeholder="Search name or email"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9 w-52"
            />
            <Select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value as UserRole | "")}
              className="h-9 w-36"
            >
              <option value="">All roles</option>
              <option value="reporter">Students</option>
              <option value="resolver">Staff</option>
              <option value="admin">Admins</option>
              <option value="owner">Owner</option>
            </Select>
          </div>
        </CardHeader>
        <CardBody>
          {data === null ? (
            <p className="py-8 text-center text-sm text-ink-500">Loading…</p>
          ) : visible.length === 0 ? (
            <p className="py-8 text-center text-sm text-ink-500">
              {data.members.length === 0
                ? "Nobody has signed up yet. Share your workspace URL so students and staff can join."
                : "Nobody matches that filter."}
            </p>
          ) : (
            <ul className="divide-y divide-ink-100">
              {visible.map((m) => (
                <li key={m.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <span
                      aria-hidden="true"
                      className={cn(
                        "h-2 w-2 shrink-0 rounded-full",
                        m.is_online ? "animate-pulse-ring bg-green-500" : "bg-ink-300"
                      )}
                    />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-ink-900">
                        {m.name}
                        {!m.is_active && (
                          <span className="ml-2 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                            Deactivated
                          </span>
                        )}
                      </p>
                      <p className="truncate text-xs text-ink-500">{m.email ?? "No email"}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-xs">
                    <span className="rounded-full bg-ink-100 px-2.5 py-0.5 font-medium text-ink-700">
                      {ROLE_LABELS[m.role]}
                    </span>
                    <span className={m.is_online ? "font-medium text-green-600" : "text-ink-500"}>
                      {m.is_online ? "Online now" : m.last_seen_at ? `Last seen ${formatDateTime(m.last_seen_at)}` : "Never signed in"}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>

      <p className="text-xs leading-relaxed text-ink-500">
        "Online" means the person's session was active in the last 15 minutes — it's a close
        approximation, not live presence tracking, so someone who just closed their laptop may still
        show as online for a few minutes.
      </p>
    </div>
  );
}
