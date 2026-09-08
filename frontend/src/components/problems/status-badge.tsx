import { Badge } from "@/components/ui/badge";
import { STATUS_LABELS } from "@/lib/constants";
import type { ProblemStatus } from "@/lib/types";

const TONE_CLASSES: Record<ProblemStatus, string> = {
  reported: "bg-ink-100 text-ink-700",
  verified: "bg-brand-50 text-brand-700",
  assigned: "bg-brand-100 text-brand-800",
  in_progress: "bg-amber-100 text-amber-800",
  resolved: "bg-green-100 text-green-700",
  closed: "bg-ink-200 text-ink-600",
  reopened: "bg-red-100 text-red-700",
};

export function StatusBadge({ status }: { status: ProblemStatus }) {
  return <Badge className={TONE_CLASSES[status]}>{STATUS_LABELS[status]}</Badge>;
}
