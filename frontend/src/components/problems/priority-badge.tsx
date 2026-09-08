import { Badge } from "@/components/ui/badge";
import { priorityBucketFor } from "@/lib/constants";
import type { PriorityBucket } from "@/lib/types";

const LABELS: Record<PriorityBucket, string> = {
  critical: "Critical",
  high: "High",
  medium: "Medium",
  low: "Low",
};

const DOT_CLASSES: Record<PriorityBucket, string> = {
  critical: "bg-severity-critical",
  high: "bg-severity-high",
  medium: "bg-severity-medium",
  low: "bg-severity-low",
};

const TONE_CLASSES: Record<PriorityBucket, string> = {
  critical: "bg-red-50 text-red-700",
  high: "bg-orange-50 text-orange-700",
  medium: "bg-yellow-50 text-yellow-800",
  low: "bg-green-50 text-green-700",
};

export function PriorityBadge({ score }: { score: number }) {
  const bucket = priorityBucketFor(score);
  return (
    <Badge className={TONE_CLASSES[bucket]}>
      <span className={`mr-1.5 h-1.5 w-1.5 rounded-full ${DOT_CLASSES[bucket]}`} />
      {LABELS[bucket]}
      <span className="ml-1 opacity-60">· {score}</span>
    </Badge>
  );
}
