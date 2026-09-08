import { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type Tone = "error" | "success" | "info";

const toneClasses: Record<Tone, string> = {
  error: "bg-red-50 text-red-800 border-red-200",
  success: "bg-green-50 text-green-800 border-green-200",
  info: "bg-brand-50 text-brand-800 border-brand-200",
};

interface AlertProps extends HTMLAttributes<HTMLDivElement> {
  tone?: Tone;
}

export function Alert({ className, tone = "info", ...props }: AlertProps) {
  return (
    <div
      role="alert"
      className={cn("rounded-xl border px-4 py-3 text-sm", toneClasses[tone], className)}
      {...props}
    />
  );
}
