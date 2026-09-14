import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * The FlagFix mark.
 *
 * A checkmark whose rising arm keeps going and plants a flag: the report
 * is raised, and the same gesture resolves it. It reads as a tick first
 * and a flag second, which is the right order for the product — people
 * remember what it does before they remember what it is called.
 *
 * Drawn on a 48-unit grid with a 4-unit safe area. Two things about the
 * geometry are load-bearing and should not be "tidied":
 *
 *  - The gradient uses gradientUnits="userSpaceOnUse". The default,
 *    objectBoundingBox, maps the gradient onto each shape's bounding box
 *    — and a perfectly vertical line has zero width, so there is nothing
 *    to map onto and the shape paints as nothing at all. It fails
 *    silently: no error, just a missing mast.
 *
 *  - Every gradient needs an id unique to the page. Two inline SVGs
 *    sharing an id (a navbar logo and a footer logo, say) means the
 *    second one references the first one's def, and whichever unmounts
 *    first takes the other's fill with it. Hence `gradientId`.
 */

const MARK_PATHS = (
  <>
    {/* Tick, rising into the mast — one continuous stroke. */}
    <path
      d="M7.5 29 L17 38.5 L32.5 23 V9.5"
      fill="none"
      stroke="var(--mark-color)"
      strokeWidth="5.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    {/* The pennant flying from the masthead. */}
    <path d="M32.5 11.5 L43.5 17 L32.5 22.5 Z" fill="var(--mark-color)" />
  </>
);

interface LogoMarkProps {
  className?: string;
  /** Paint the mark in the current text colour instead of the brand
   * gradient — for a footer, a dark background, or a print sheet. */
  mono?: boolean;
  /** Must be unique per rendered instance; see the note above. */
  gradientId?: string;
}

export function LogoMark({ className, mono, gradientId = "flagfix-mark" }: LogoMarkProps) {
  return (
    <svg
      viewBox="0 0 48 48"
      className={cn("h-8 w-8", className)}
      role="img"
      aria-label="FlagFix"
      style={{ ["--mark-color" as string]: mono ? "currentColor" : `url(#${gradientId})` }}
    >
      {!mono && (
        <defs>
          <linearGradient id={gradientId} gradientUnits="userSpaceOnUse" x1="8" y1="8" x2="42" y2="40">
            <stop offset="0" stopColor="#4a68f5" />
            <stop offset="1" stopColor="#7c3aed" />
          </linearGradient>
        </defs>
      )}
      {MARK_PATHS}
    </svg>
  );
}

interface LogoProps extends LogoMarkProps {
  /** Wrap the lockup in a link to the given href. Omit for a plain,
   * non-interactive lockup (an auth screen header, for instance). */
  href?: string;
  /** Hide the wordmark and show the mark alone. */
  markOnly?: boolean;
  size?: "sm" | "md" | "lg";
}

const SIZES = {
  sm: { mark: "h-7 w-7", text: "text-base" },
  md: { mark: "h-8 w-8", text: "text-[1.0625rem]" },
  lg: { mark: "h-10 w-10", text: "text-xl" },
} as const;

/** Mark plus wordmark. The single source of the FlagFix lockup — every
 * screen renders this rather than re-typing the markup, so the logo can
 * never drift between the navbar, the landing page and the auth pages. */
export function Logo({ href, markOnly, size = "md", className, mono, gradientId }: LogoProps) {
  const s = SIZES[size];

  const content = (
    <>
      <LogoMark className={s.mark} mono={mono} gradientId={gradientId} />
      {!markOnly && (
        <span className={cn("font-semibold tracking-tight text-ink-900", s.text)}>FlagFix</span>
      )}
    </>
  );

  const shared = cn("flex items-center gap-2.5", className);

  if (!href) return <span className={shared}>{content}</span>;

  return (
    <Link
      href={href}
      className={cn(
        shared,
        "rounded-lg transition-transform duration-300 hover:-translate-y-0.5",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
      )}
    >
      {content}
    </Link>
  );
}
