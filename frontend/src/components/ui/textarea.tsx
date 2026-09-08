import { TextareaHTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/utils";

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        className={cn(
          "w-full rounded-xl border border-ink-200 bg-white px-3 py-2 text-sm text-ink-900 placeholder:text-ink-400",
          "focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500",
          "disabled:bg-ink-50 disabled:text-ink-400",
          className
        )}
        {...props}
      />
    );
  }
);
Textarea.displayName = "Textarea";
