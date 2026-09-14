"use client";

import { usePointerTilt } from "@/lib/use-motion";

/**
 * The closing sequence: the mark assembles itself from its two halves.
 *
 * The important detail is that these are not a drawing that resembles
 * the logo — they are the logo's own two paths, split at the point where
 * the tick's rising arm meets the mast (32.5, 23):
 *
 *   flag  = "M32.5 23 V9.5" plus the pennant triangle
 *   tick  = "M7.5 29 L17 38.5 L32.5 23"
 *
 * Both render inside the same 48-unit viewBox at the same size, so when
 * the two halves land on top of each other they reconstitute the mark
 * exactly, to the pixel. Drawing a separate "combined" logo for the
 * final frame would look identical today and drift the first time the
 * mark is adjusted.
 *
 * Timing lives entirely in CSS keyframes (see globals.css) on a single
 * shared 4.4s timeline, so the two halves cannot desynchronise the way
 * chained JavaScript timeouts do when a tab is backgrounded and the
 * browser throttles its timers.
 */

/** Shared gradient. Each instance needs its own id — see logo.tsx. */
function Gradient({ id }: { id: string }) {
  return (
    <defs>
      <linearGradient id={id} gradientUnits="userSpaceOnUse" x1="8" y1="8" x2="42" y2="40">
        <stop offset="0" stopColor="#4a68f5" />
        <stop offset="1" stopColor="#7c3aed" />
      </linearGradient>
    </defs>
  );
}

const STROKE = {
  fill: "none",
  strokeWidth: 5.5,
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

export function LogoFinale() {
  // Reuse of the hero's tilt: the whole stage leans toward the pointer,
  // so the assembled mark sits in the same 3D space the page opened in.
  const stageRef = usePointerTilt(7);

  return (
    <section
      aria-labelledby="finale-heading"
      className="relative mx-auto max-w-6xl overflow-hidden px-6 pb-20 pt-8 sm:pb-28"
    >
      <h2 id="finale-heading" className="sr-only">
        How FlagFix works, in one mark
      </h2>

      <div className="finale-stage scene" data-reveal>
        <div ref={stageRef} className="scene-tilt relative h-[15rem] sm:h-[17rem]">
          {/* Glow that blooms at the moment the halves meet. */}
          <div aria-hidden="true" className="finale-glow" />

          {/* --- Half one: the flag. --- */}
          <div className="finale-slot">
            <div className="finale-flag">
              <svg viewBox="0 0 48 48" className="finale-svg" aria-hidden="true">
                <Gradient id="finale-flag-grad" />
                {/* The mast is drawn at FULL flagpole length (down to
                    y=38) and retracted to its true length (y=23) as the
                    tick arrives to occupy that space — the pole does not
                    vanish, the tick takes it over.

                    On its own, a mast of only 13.5 units under a pennant
                    reads as a play triangle, not a flag; the first frame
                    has to say "flag" before the word does. Retraction is
                    a stroke-dashoffset animation, which is animatable in
                    CSS, rather than a path morph, which is not: with
                    dasharray 28.5 the offset selects how much of the
                    pole paints, and the final offset of 15 leaves
                    exactly y=9.5 to y=23 — the mark's real geometry. */}
                <path
                  className="finale-mast"
                  d="M32.5 9.5 V38"
                  stroke="url(#finale-flag-grad)"
                  {...STROKE}
                />
                <path d="M32.5 11.5 L43.5 17 L32.5 22.5 Z" fill="url(#finale-flag-grad)" />
              </svg>
            </div>
          </div>

          {/* --- Half two: the tick. --- */}
          <div className="finale-slot">
            <div className="finale-tick">
              <svg viewBox="0 0 48 48" className="finale-svg" aria-hidden="true">
                <Gradient id="finale-tick-grad" />
                <path d="M7.5 29 L17 38.5 L32.5 23" stroke="url(#finale-tick-grad)" {...STROKE} />
              </svg>
            </div>
          </div>

          {/* Captions. Each is tied to the same 4.4s timeline as the half
              it belongs to, rather than to its own timer. */}
          <p className="finale-cap finale-cap-left">
            <span className="finale-cap-label">Flag a problem</span>
            <span className="finale-cap-sub">anyone, in seconds</span>
          </p>
          <p className="finale-cap finale-cap-right">
            <span className="finale-cap-label">Problem solved</span>
            <span className="finale-cap-sub">tracked until it is</span>
          </p>
        </div>
      </div>

      {/* --- What the assembled mark resolves into. --- */}
      <div className="finale-outro mx-auto max-w-xl text-center">
        <p className="display text-[1.6rem] font-bold tracking-tight text-ink-900 sm:text-[2rem]">
          FlagFix
        </p>
        <p className="mt-4 text-[0.95rem] leading-relaxed text-ink-600 sm:text-[1.05rem]">
          &ldquo;Every fix begins with someone bothering to raise a hand.&rdquo;
        </p>
        <p className="mt-3 text-xs uppercase tracking-[0.18em] text-ink-400">
          Raise it. Track it. Close it.
        </p>
      </div>
    </section>
  );
}
