"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FullPageSpinner } from "@/components/ui/spinner";
import { PriorityBadge } from "@/components/problems/priority-badge";
import { useAuth } from "@/components/auth/auth-provider";
import { ApiError, problemsApi } from "@/lib/api";
import { STAFF_ROLES } from "@/lib/constants";
import { formatDateTime } from "@/lib/utils";
import type { AiStatusResponse, ClusterResponse } from "@/lib/types";

/**
 * The grouped view: separate reports that the similarity engine decided
 * are describing the same underlying problem.
 *
 * This page is the visible proof of the one thing in FlagFix that a
 * keyword rule genuinely cannot do — recognising that "wifi dead on 2nd
 * floor" and "cannot connect near room 214" are one problem. It stays
 * honest when the engine is switched off: rather than showing an empty
 * page that implies "no duplicates found", it says plainly that grouping
 * is not running.
 */
export default function ClustersPage() {
  const { claims } = useAuth();
  const router = useRouter();
  const isStaff = claims ? STAFF_ROLES.includes(claims.role) : false;

  const [clusters, setClusters] = useState<ClusterResponse[] | null>(null);
  const [aiStatus, setAiStatus] = useState<AiStatusResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    if (claims && !isStaff) router.replace("/dashboard");
  }, [claims, isStaff, router]);

  useEffect(() => {
    if (!isStaff) return;
    problemsApi
      .listClusters()
      .then(setClusters)
      .catch((err) => {
        setError(err instanceof ApiError ? err.message : "Could not load grouped problems.");
        // Without this the page shows "Loading…" indefinitely beneath the
        // error message.
        setClusters([]);
      });
    problemsApi.aiStatus().then(setAiStatus).catch(() => undefined);
  }, [isStaff]);

  if (!claims || !isStaff) return <FullPageSpinner />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-ink-900">Grouped problems</h1>
        <p className="mt-1 max-w-2xl text-sm text-ink-600">
          When several people report the same thing in different words, FlagFix groups those reports
          into one underlying problem — so you see <strong>one job to fix</strong>, not fifteen
          tickets, and you can tell which problems are quietly generating the most complaints.
        </p>
      </div>

      {error && <Alert tone="error">{error}</Alert>}

      {aiStatus && !aiStatus.similarity_enabled && (
        <Alert tone="info">
          <strong>Grouping is currently switched off.</strong> Reports are being saved and
          prioritised normally, but they aren't being matched against each other, because no
          embedding API key is configured. Add <code className="font-mono text-xs">VOYAGE_API_KEY</code>{" "}
          in your backend's environment variables to turn this on — nothing else needs to change.
        </Alert>
      )}

      {clusters === null ? (
        <p className="py-8 text-center text-sm text-ink-500">Loading…</p>
      ) : clusters.length === 0 ? (
        <Card>
          <CardBody className="py-10 text-center">
            <p className="text-sm text-ink-600">
              No grouped problems yet
              {aiStatus && !aiStatus.similarity_enabled
                ? " — grouping is switched off, see above."
                : " — every report so far looks like a distinct issue."}
            </p>
          </CardBody>
        </Card>
      ) : (
        <div className="space-y-4">
          {clusters.map((c) => (
            <Card key={c.id} elevated lift>
              <CardHeader className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <CardTitle>{c.canonical_title}</CardTitle>
                  <p className="mt-1 text-xs text-ink-500">
                    First reported {formatDateTime(c.first_reported_at)} · last{" "}
                    {formatDateTime(c.last_reported_at)}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <PriorityBadge score={c.top_priority_score} />
                  {c.status === "resolved" ? (
                    <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700">
                      Resolved
                    </span>
                  ) : (
                    <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800">
                      Open
                    </span>
                  )}
                </div>
              </CardHeader>

              <CardBody className="space-y-4">
                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-xl bg-brand-gradient-soft p-3 text-center">
                    <p className="text-2xl font-bold text-brand-700">{c.report_count}</p>
                    <p className="text-xs text-ink-600">separate reports</p>
                  </div>
                  <div className="rounded-xl bg-brand-gradient-soft p-3 text-center">
                    <p className="text-2xl font-bold text-brand-700">{c.affected_users_estimate}</p>
                    <p className="text-xs text-ink-600">people affected</p>
                  </div>
                  <div
                    className={`rounded-xl p-3 text-center ${
                      c.recurrence_count > 0 ? "bg-red-50" : "bg-ink-50"
                    }`}
                  >
                    <p
                      className={`text-2xl font-bold ${
                        c.recurrence_count > 0 ? "text-red-600" : "text-ink-700"
                      }`}
                    >
                      {c.recurrence_count}
                    </p>
                    <p className="text-xs text-ink-600">times it came back</p>
                  </div>
                </div>

                {c.recurrence_count > 0 && (
                  <Alert tone="error">
                    This problem has returned {c.recurrence_count}{" "}
                    {c.recurrence_count === 1 ? "time" : "times"} after being marked resolved — the
                    underlying cause probably hasn't been fixed.
                  </Alert>
                )}

                <div>
                  <button
                    type="button"
                    onClick={() => setExpanded(expanded === c.id ? null : c.id)}
                    className="text-sm font-medium text-brand-600 hover:underline"
                  >
                    {expanded === c.id ? "Hide" : "Show"} the {c.members.length} report
                    {c.members.length === 1 ? "" : "s"} behind this
                  </button>

                  {expanded === c.id && (
                    <ul className="mt-3 animate-fade-up divide-y divide-ink-100 rounded-xl border border-ink-100">
                      {c.members.map((m) => (
                        <li key={m.id} className="px-3 py-2.5">
                          <Link href={`/problems/${m.id}`} className="block hover:opacity-80">
                            <p className="text-sm font-medium text-ink-900">{m.title}</p>
                            <p className="mt-0.5 line-clamp-2 text-xs text-ink-600">{m.description}</p>
                            <p className="mt-1 text-xs text-ink-400">
                              {formatDateTime(m.created_at)}
                              {m.custom_location ? ` · ${m.custom_location}` : ""}
                            </p>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}

      <Card glass>
        <CardBody>
          <p className="text-sm font-medium text-ink-900">Why this can't be done with keyword rules</p>
          <p className="mt-1.5 text-sm leading-relaxed text-ink-600">
            These reports share almost no words in common. Matching them requires comparing what the
            sentences <em>mean</em>, which is what the embedding model does — it converts each report
            into a list of numbers representing its meaning, then measures the distance between them.
            A keyword rule would need someone to predict every phrasing in advance, in every language
            and spelling your reporters actually use.
          </p>
          <Link href="/dashboard">
            <Button variant="secondary" size="sm" className="mt-3">
              Back to dashboard
            </Button>
          </Link>
        </CardBody>
      </Card>
    </div>
  );
}
