"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { Textarea } from "@/components/ui/textarea";
import { FullPageSpinner } from "@/components/ui/spinner";
import { PriorityBadge } from "@/components/problems/priority-badge";
import { StatusBadge } from "@/components/problems/status-badge";
import { useAuth } from "@/components/auth/auth-provider";
import { ApiError, orgsApi, problemsApi } from "@/lib/api";
import { ALLOWED_TRANSITIONS, STATUS_LABELS, STAFF_ROLES } from "@/lib/constants";
import { formatDateTime, relativeDue } from "@/lib/utils";
import type { LocationResponse, ProblemResponse, ProblemStatus } from "@/lib/types";

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
  const nextSteps = ALLOWED_TRANSITIONS[problem.status];
  const canGiveFeedback = !isStaff && problem.status === "resolved" && !feedbackSubmitted;

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

          <dl className="grid grid-cols-2 gap-4 border-t border-ink-100 pt-4 text-sm">
            <div>
              <dt className="text-ink-500">Location</dt>
              <dd className="mt-0.5 text-ink-900">{location?.path ?? "—"}</dd>
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
