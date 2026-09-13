import { InputHTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/utils";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={cn(
          "h-10 w-full rounded-xl border border-ink-200 bg-surface px-3 text-sm text-ink-900 placeholder:text-ink-400",
          "focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500",
          "disabled:bg-ink-50 disabled:text-ink-400",
          className
        )}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";
