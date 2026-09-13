import { SelectHTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/utils";

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, children, ...props }, ref) => {
    return (
      <select
        ref={ref}
        className={cn(
          "h-10 w-full rounded-xl border border-ink-200 bg-surface px-3 text-sm text-ink-900",
          "focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500",
          "disabled:bg-ink-50 disabled:text-ink-400",
          className
        )}
        {...props}
      >
        {children}
      </select>
    );
  }
);
Select.displayName = "Select";
