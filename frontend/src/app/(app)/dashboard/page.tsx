"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { Select } from "@/components/ui/select";
import { FullPageSpinner } from "@/components/ui/spinner";
import { ProblemList } from "@/components/problems/problem-list";
import { useAuth } from "@/components/auth/auth-provider";
import { ApiError, problemsApi } from "@/lib/api";
import { STATUS_LABELS, STAFF_ROLES } from "@/lib/constants";
import { priorityBucketFor } from "@/lib/constants";
import type { ProblemResponse, ProblemStatus } from "@/lib/types";

function StatTile({ label, value, tone }: { label: string; value: number; tone?: "danger" | "warning" }) {
  const valueClass = tone === "danger" ? "text-red-600" : tone === "warning" ? "text-amber-600" : "text-ink-900";
  return (
    <Card>
      <CardBody className="py-4">
        <p className="text-xs font-medium uppercase tracking-wide text-ink-500">{label}</p>
        <p className={`mt-1 text-2xl font-bold ${valueClass}`}>{value}</p>
      </CardBody>
    </Card>
  );
}

export default function DashboardPage() {
  const { claims } = useAuth();
  const isStaff = claims ? STAFF_ROLES.includes(claims.role) : false;

  const [problems, setProblems] = useState<ProblemResponse[] | null>(null);
  const [statusFilter, setStatusFilter] = useState<ProblemStatus | "">("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!claims) return;
    const fetcher = isStaff
      ? problemsApi.list({ status: statusFilter || undefined })
      : problemsApi.listMine();
    fetcher
      .then(setProblems)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Could not load reports."));
  }, [claims, isStaff, statusFilter]);

  const stats = useMemo(() => {
    if (!problems) return null;
    const open = problems.filter((p) => p.status !== "resolved" && p.status !== "closed");
    const critical = open.filter((p) => priorityBucketFor(p.priority_score) === "critical");
    const overdue = open.filter((p) => p.sla_due_at && new Date(p.sla_due_at) < new Date());
    return { open: open.length, critical: critical.length, overdue: overdue.length };
  }, [problems]);

  if (!claims) return <FullPageSpinner />;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-ink-900">
            {isStaff ? "All reports" : "Your reports"}
          </h1>
          <p className="mt-1 text-sm text-ink-600">
            {isStaff
              ? "Sorted by priority — the reports that need attention most are at the top."
              : "Everything you've reported, and where it stands."}
          </p>
        </div>
        <Link href="/report/new">
          <Button>Report a problem</Button>
        </Link>
      </div>

      {error && <Alert tone="error">{error}</Alert>}

      {isStaff && stats && (
        <div className="grid grid-cols-3 gap-4">
          <StatTile label="Open reports" value={stats.open} />
          <StatTile label="Critical" value={stats.critical} tone="danger" />
          <StatTile label="Past SLA" value={stats.overdue} tone="warning" />
        </div>
      )}

      <Card>
        <CardHeader className="flex items-center justify-between">
          <CardTitle>{isStaff ? "Queue" : "My reports"}</CardTitle>
          {isStaff && (
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as ProblemStatus | "")}
              className="h-9 w-44"
            >
              <option value="">All statuses</option>
              {Object.entries(STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          )}
        </CardHeader>
        <CardBody>
          {problems === null ? (
            <p className="py-8 text-center text-sm text-ink-500">Loading…</p>
          ) : (
            <ProblemList
              problems={problems}
              emptyMessage={
                isStaff ? "Nothing matches this filter." : "You haven't reported anything yet."
              }
            />
          )}
        </CardBody>
      </Card>
    </div>
  );
}
