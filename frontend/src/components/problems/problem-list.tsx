import Link from "next/link";
import { PriorityBadge } from "./priority-badge";
import { StatusBadge } from "./status-badge";
import { formatDateTime, relativeDue } from "@/lib/utils";
import { formatEstimatedTime, isQuickFix } from "@/lib/constants";
import type { ProblemResponse } from "@/lib/types";

export function ProblemList({
  problems,
  emptyMessage,
}: {
  problems: ProblemResponse[];
  emptyMessage: string;
}) {
  if (problems.length === 0) {
    return <p className="py-8 text-center text-sm text-ink-500">{emptyMessage}</p>;
  }

  return (
    <ul className="divide-y divide-ink-100">
      {problems.map((p) => {
        const due = relativeDue(p.sla_due_at);
        return (
          <li key={p.id}>
            <Link
              href={`/problems/${p.id}`}
              className="flex flex-col gap-2 px-1 py-4 transition-colors hover:bg-ink-50 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="truncate text-sm font-medium text-ink-900">{p.title}</p>
                  {p.safety_flag && (
                    <span title="Potential safety risk" className="text-red-500">
                      ⚠
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-xs text-ink-500">
                  Reported {formatDateTime(p.created_at)}
                  {p.attachments.length > 0 && ` · ${p.attachments.length} attachment${p.attachments.length > 1 ? "s" : ""}`}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {p.estimated_resolution_hours !== null && p.status !== "resolved" && p.status !== "closed" && (
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                      isQuickFix(p.estimated_resolution_hours)
                        ? "bg-green-50 text-green-700"
                        : "bg-ink-100 text-ink-600"
                    }`}
                  >
                    {isQuickFix(p.estimated_resolution_hours) ? "⚡ " : "🛠 "}
                    {formatEstimatedTime(p.estimated_resolution_hours)}
                  </span>
                )}
                <PriorityBadge score={p.priority_score} />
                <StatusBadge status={p.status} />
                {p.status !== "resolved" && p.status !== "closed" && (
                  <span className={`text-xs ${due.overdue ? "font-medium text-red-600" : "text-ink-500"}`}>
                    {due.label}
                  </span>
                )}
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
