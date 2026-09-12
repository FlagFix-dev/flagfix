import { ButtonHTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

const variantClasses: Record<Variant, string> = {
  // The primary button is one of the deliberately "raised" surfaces: a
  // gradient fill, a lit top edge (the inset white line), a coloured
  // shadow that reads as the button floating above the page, and a shine
  // sweep on hover. Everything else in the UI stays flatter so this
  // actually draws the eye.
  primary: cn(
    "group relative overflow-hidden bg-brand-gradient text-white",
    "shadow-raised hover:shadow-raised-hover hover:-translate-y-0.5 active:translate-y-0",
    "before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-white/40",
    "disabled:bg-none disabled:bg-brand-300 disabled:shadow-none disabled:hover:translate-y-0"
  ),
  secondary:
    "bg-white text-ink-800 border border-ink-200 shadow-sm hover:bg-ink-50 hover:border-ink-300 hover:shadow-card active:bg-ink-100 disabled:text-ink-400",
  ghost: "bg-transparent text-ink-700 hover:bg-ink-100 active:bg-ink-200",
  danger:
    "bg-gradient-to-br from-red-500 to-red-700 text-white shadow-sm hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 disabled:bg-none disabled:bg-red-300",
};

const sizeClasses: Record<Size, string> = {
  sm: "h-8 px-3 text-sm rounded-lg",
  md: "h-10 px-4 text-sm rounded-xl",
  lg: "h-12 px-6 text-base rounded-xl",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", loading, disabled, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(
          "inline-flex items-center justify-center gap-2 font-medium transition-all duration-200",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2",
          "disabled:cursor-not-allowed",
          variantClasses[variant],
          sizeClasses[size],
          className
        )}
        {...props}
      >
        {/* Light sweep — only rendered for the primary variant, and purely
            decorative, so it's hidden from assistive tech. */}
        {variant === "primary" && !disabled && !loading && (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 -left-full w-1/2 bg-white/25 blur-sm group-hover:animate-shine"
          />
        )}
        {loading && (
          <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
        )}
        <span className="relative">{children}</span>
      </button>
    );
  }
);
Button.displayName = "Button";
