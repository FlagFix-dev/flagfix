"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { FullPageSpinner } from "@/components/ui/spinner";
import { PriorityBadge } from "@/components/problems/priority-badge";
import { StatusBadge } from "@/components/problems/status-badge";
import { useAuth } from "@/components/auth/auth-provider";
import { ApiError, orgsApi, problemsApi } from "@/lib/api";
import { ALLOWED_TRANSITIONS, STATUS_LABELS, STAFF_ROLES, formatEstimatedTime } from "@/lib/constants";
import { formatDateTime, relativeDue } from "@/lib/utils";
import type { LocationResponse, ProblemResponse, ProblemStatus } from "@/lib/types";

// Same lightweight "keep it feeling live" approach as the dashboard — a
// plain re-fetch, not a websocket, so a reporter watching this page sees a
// staff progress update without having to manually reload.
const REFRESH_INTERVAL_MS = 20_000;

const QUICK_PROGRESS_NOTES = ["Work started", "Technician on the way", "Almost done", "Waiting on parts"];

/** A 0-100 value the AI extracted, drawn as a bar so staff can see at a
 * glance how strong the signal was rather than parsing a bare number. */
function MeterTile({ label, value }: { label: string; value: number }) {
  const tone = value >= 75 ? "bg-red-500" : value >= 50 ? "bg-amber-500" : "bg-green-500";
  return (
    <div className="rounded-xl bg-ink-50 p-3">
      <p className="text-xs text-ink-500">{label}</p>
      <p className="mt-1 text-sm font-semibold text-ink-900">{value}/100</p>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-ink-200">
        <div className={`h-full rounded-full ${tone}`} style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
      </div>
    </div>
  );
}

export default function ProblemDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { claims } = useAuth();
  const isStaff = claims ? STAFF_ROLES.includes(claims.role) : false;

  const [problem, setProblem] = useState<ProblemResponse | null>(null);
  const [locations, setLocations] = useState<LocationResponse[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [transitioning, setTransitioning] = useState<ProblemStatus | null>(null);
  const [accepting, setAccepting] = useState(false);
  const [progressNote, setProgressNote] = useState("");
  const [postingProgress, setPostingProgress] = useState(false);

  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);
  const [feedbackComment, setFeedbackComment] = useState("");
  const [submittingFeedback, setSubmittingFeedback] = useState<"yes" | "no" | null>(null);

  async function load() {
    try {
      const [p, locs] = await Promise.all([problemsApi.get(params.id), orgsApi.listLocations()]);
      setProblem(p);
      setLocations(locs);
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) setNotFound(true);
      else setError(err instanceof ApiError ? err.message : "Could not load this report.");
    }
  }

  useEffect(() => {
    load();
    const interval = setInterval(load, REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  async function handleTransition(to: ProblemStatus) {
    setError(null);
    setTransitioning(to);
    try {
      const updated = await problemsApi.changeStatus(params.id, { to_status: to });
      setProblem(updated);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not update status.");
    } finally {
      setTransitioning(null);
    }
  }

  async function handleAccept() {
    setError(null);
    setAccepting(true);
    try {
      const updated = await problemsApi.accept(params.id);
      setProblem(updated);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not accept this report.");
    } finally {
      setAccepting(false);
    }
  }

  async function handlePostProgress(message: string) {
    if (!message.trim()) return;
    setError(null);
    setPostingProgress(true);
    try {
      const updated = await problemsApi.postProgress(params.id, { message: message.trim() });
      setProblem(updated);
      setProgressNote("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not post that update.");
    } finally {
      setPostingProgress(false);
    }
  }

  async function handleFeedback(confirmed: boolean) {
    setError(null);
    setSubmittingFeedback(confirmed ? "yes" : "no");
    try {
      const updated = await problemsApi.submitFeedback(params.id, {
        resolved_confirmed: confirmed,
        comment: feedbackComment || null,
      });
      setProblem(updated);
      setFeedbackSubmitted(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not submit your feedback.");
    } finally {
      setSubmittingFeedback(null);
    }
  }

  if (notFound) {
    return (
      <div className="mx-auto max-w-lg text-center">
        <p className="text-ink-600">This report doesn't exist, or you don't have access to it.</p>
        <Button className="mt-4" variant="secondary" onClick={() => router.push("/dashboard")}>
          Back to dashboard
        </Button>
      </div>
    );
  }

  if (!problem) return <FullPageSpinner />;

  const location = locations.find((l) => l.id === problem.location_id);
  const due = relativeDue(problem.sla_due_at);
  const reasons = (problem.priority_reasons?.reasons as string[] | undefined) ?? [];
  // `assigned` is deliberately excluded from the status buttons: taking
  // ownership happens through "Accept this problem" (which records WHO
  // accepted it). Offering it here would let staff mark a problem assigned
  // to nobody, which the server now rejects anyway.
  const nextSteps = ALLOWED_TRANSITIONS[problem.status].filter((s) => s !== "assigned");
  const canGiveFeedback = !isStaff && problem.status === "resolved" && !feedbackSubmitted;
  const canAccept = isStaff && !problem.assigned_to_user_id && (problem.status === "reported" || problem.status === "verified");
  const canPostProgress = isStaff && problem.status !== "resolved" && problem.status !== "closed";

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <button
        onClick={() => router.push("/dashboard")}
        className="text-sm text-ink-500 hover:text-ink-700"
      >
        ← Back
      </button>

      {error && <Alert tone="error">{error}</Alert>}

      <Card>
        <CardBody className="space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-lg font-semibold text-ink-900">{problem.title}</h1>
              <p className="mt-1 text-sm text-ink-500">Reported {formatDateTime(problem.created_at)}</p>
            </div>
            <div className="flex items-center gap-2">
              <PriorityBadge score={problem.priority_score} />
              <StatusBadge status={problem.status} />
            </div>
          </div>

          <div>
            <p className="text-sm text-ink-700">{problem.description}</p>
          </div>

          {problem.attachments.length > 0 && (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {problem.attachments.map((a) => {
                // Defence in depth. The server already refuses any URL
                // outside our storage bucket, but this view renders
                // user-submitted values as a live href/src — so anything
                // that isn't plain https is dropped here too rather than
                // trusted. A `javascript:` href would otherwise execute on
                // our own origin when a staff member clicks it.
                const src = /^https:\/\//i.test(a.url) ? a.url : "";
                if (!src) return null;
                return a.content_type.startsWith("video/") ? (
                  <video
                    key={a.id}
                    src={src}
                    controls
                    className="aspect-square rounded-xl border border-ink-100 object-cover"
                  />
                ) : (
                  <a key={a.id} href={src} target="_blank" rel="noreferrer noopener">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={src} alt="" className="aspect-square rounded-xl border border-ink-100 object-cover" />
                  </a>
                );
              })}
            </div>
          )}

          <dl className="grid grid-cols-2 gap-4 border-t border-ink-100 pt-4 text-sm">
            <div>
              <dt className="text-ink-500">Location</dt>
              <dd className="mt-0.5 text-ink-900">
                {location?.path ?? problem.custom_location ?? "—"}
                {problem.custom_location && (
                  <span className="ml-1.5 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                    described by reporter
                  </span>
                )}
              </dd>
            </div>
            {problem.landmark && (
              <div>
                <dt className="text-ink-500">Exact spot</dt>
                <dd className="mt-0.5 text-ink-900">{problem.landmark}</dd>
              </div>
            )}
            <div>
              <dt className="text-ink-500">SLA</dt>
              <dd className={`mt-0.5 ${due.overdue ? "font-medium text-red-600" : "text-ink-900"}`}>
                {due.label}
              </dd>
            </div>
            {problem.estimated_resolution_hours !== null && (
              <div>
                <dt className="text-ink-500">Typical time for this kind of issue</dt>
                <dd className="mt-0.5 text-ink-900">{formatEstimatedTime(problem.estimated_resolution_hours)}</dd>
              </div>
            )}
            {problem.safety_flag && (
              <div>
                <dt className="text-ink-500">Safety</dt>
                <dd className="mt-0.5 font-medium text-red-600">⚠ Potential safety risk</dd>
              </div>
            )}
          </dl>

          {reasons.length > 0 && (
            <div className="rounded-xl bg-ink-50 p-3">
              <p className="text-xs font-medium uppercase tracking-wide text-ink-500">Why this priority</p>
              <ul className="mt-1.5 space-y-1 text-sm text-ink-700">
                {reasons.map((r, i) => (
                  <li key={i}>• {r}</li>
                ))}
              </ul>
            </div>
          )}
        </CardBody>
      </Card>

      {/* The AI's own working, shown rather than hidden. Staff only: a
          reporter doesn't need to see triage internals, but the people
          acting on the score absolutely do — a score nobody can question
          is a score nobody should trust. */}
      {isStaff && (
        <Card elevated>
          <CardHeader className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle>AI analysis</CardTitle>
            {problem.ai_low_confidence ? (
              <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800">
                Low confidence — please verify
              </span>
            ) : (
              <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700">
                Confident
              </span>
            )}
          </CardHeader>
          <CardBody className="space-y-4">
            {problem.ai_reasoning && (
              <div className="rounded-xl border-l-4 border-l-accent-400 bg-accent-50/60 p-3">
                <p className="text-xs font-medium uppercase tracking-wide text-accent-700">
                  What the AI read from this report
                </p>
                <p className="mt-1 text-sm italic text-ink-800">"{problem.ai_reasoning}"</p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <MeterTile label="Severity" value={problem.severity} />
              <MeterTile label="Urgency" value={problem.urgency} />
              <div className="rounded-xl bg-ink-50 p-3">
                <p className="text-xs text-ink-500">Safety risk</p>
                <p
                  className={`mt-1 text-sm font-semibold ${
                    problem.safety_flag ? "text-red-600" : "text-ink-700"
                  }`}
                >
                  {problem.safety_flag ? "⚠ Flagged" : "None detected"}
                </p>
              </div>
              <div className="rounded-xl bg-ink-50 p-3">
                <p className="text-xs text-ink-500">Priority score</p>
                <p className="mt-1 text-sm font-semibold text-ink-900">{problem.priority_score}/100</p>
              </div>
            </div>

            <p className="text-xs leading-relaxed text-ink-500">
              Severity, urgency and safety are read from the reporter's free text by the language
              model. The priority score itself is then calculated by a fixed, auditable formula from
              those values plus how many people are affected and whether the problem has recurred —
              so the same inputs always produce the same score.
            </p>
          </CardBody>
        </Card>
      )}

      {problem.latest_update && (
        <Card elevated className="border-l-4 border-l-brand-500">
          <CardBody className="flex items-start gap-3 py-4">
            <span className="mt-0.5 flex h-2 w-2 shrink-0 animate-pulse rounded-full bg-brand-500" />
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-brand-600">Live update</p>
              <p className="mt-0.5 text-sm text-ink-800">{problem.latest_update}</p>
              {problem.latest_update_at && (
                <p className="mt-0.5 text-xs text-ink-400">{formatDateTime(problem.latest_update_at)}</p>
              )}
            </div>
          </CardBody>
        </Card>
      )}

      {canAccept && (
        <Card>
          <CardBody className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-ink-700">Nobody's taken this one yet.</p>
            <Button loading={accepting} onClick={handleAccept}>
              Accept this problem
            </Button>
          </CardBody>
        </Card>
      )}

      {isStaff && nextSteps.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Update status</CardTitle>
          </CardHeader>
          <CardBody className="flex flex-wrap gap-2">
            {nextSteps.map((step) => (
              <Button
                key={step}
                variant={step === "resolved" ? "primary" : "secondary"}
                loading={transitioning === step}
                onClick={() => handleTransition(step)}
              >
                Mark {STATUS_LABELS[step].toLowerCase()}
              </Button>
            ))}
          </CardBody>
        </Card>
      )}

      {canPostProgress && (
        <Card>
          <CardHeader>
            <CardTitle>Post a live update</CardTitle>
          </CardHeader>
          <CardBody className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {QUICK_PROGRESS_NOTES.map((note) => (
                <button
                  key={note}
                  type="button"
                  onClick={() => handlePostProgress(note)}
                  disabled={postingProgress}
                  className="rounded-full border border-ink-200 px-3 py-1.5 text-xs font-medium text-ink-700 transition-colors hover:border-brand-400 hover:bg-brand-50 hover:text-brand-700 disabled:opacity-50"
                >
                  {note}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                placeholder="Or write your own, e.g. 'Technician arriving in 30 minutes'"
                value={progressNote}
                onChange={(e) => setProgressNote(e.target.value)}
                maxLength={300}
              />
              <Button loading={postingProgress} onClick={() => handlePostProgress(progressNote)}>
                Post
              </Button>
            </div>
          </CardBody>
        </Card>
      )}

      {canGiveFeedback && (
        <Card>
          <CardHeader>
            <CardTitle>Was this actually fixed?</CardTitle>
          </CardHeader>
          <CardBody className="space-y-3">
            <Textarea
              placeholder="Optional comment"
              rows={2}
              value={feedbackComment}
              onChange={(e) => setFeedbackComment(e.target.value)}
            />
            <div className="flex gap-2">
              <Button loading={submittingFeedback === "yes"} onClick={() => handleFeedback(true)}>
                Yes, it's fixed
              </Button>
              <Button
                variant="secondary"
                loading={submittingFeedback === "no"}
                onClick={() => handleFeedback(false)}
              >
                No, still broken
              </Button>
            </div>
          </CardBody>
        </Card>
      )}

      {feedbackSubmitted && (
        <Alert tone="success">Thanks — your feedback has been recorded.</Alert>
      )}
    </div>
  );
}
