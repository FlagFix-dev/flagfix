"use client";

import { useEffect, useRef, type MutableRefObject, type RefObject } from "react";

/**
 * Shared motion primitives for the marketing page.
 *
 * Both hooks follow the same rule: never call setState from a scroll or
 * pointer event. React re-rendering at 60fps is the usual reason a
 * "fancy" landing page feels cheap on a mid-range Android, so movement
 * here is applied by writing CSS custom properties and class names
 * directly, at most once per animation frame.
 */

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/**
 * Reveals every `[data-reveal]` element inside `root` as it scrolls into
 * view, once each.
 *
 * Elements are unobserved after revealing so the observer's work shrinks
 * as the user scrolls, and the whole thing degrades to "everything
 * visible" if IntersectionObserver is missing — the content matters more
 * than the animation.
 */
export function useReveal(root: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    const container = root.current;
    if (!container) return;

    const nodes = Array.from(
      container.querySelectorAll<HTMLElement>("[data-reveal]")
    );
    if (nodes.length === 0) return;

    const showAll = () => nodes.forEach((n) => n.classList.add("is-revealed"));

    if (prefersReducedMotion() || typeof IntersectionObserver === "undefined") {
      showAll();
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.classList.add("is-revealed");
          observer.unobserve(entry.target);
        }
      },
      // Fire a little before the element is fully on screen, so the
      // motion finishes as it settles rather than starting late.
      { threshold: 0.12, rootMargin: "0px 0px -8% 0px" }
    );

    nodes.forEach((n) => observer.observe(n));
    return () => observer.disconnect();
  }, [root]);
}

/**
 * Tilts an element toward the pointer, in real 3D.
 *
 * Returns a ref to attach to the element carrying `.scene-tilt`. The
 * handler is bound to that element (not the window) so it costs nothing
 * while the pointer is elsewhere on the page.
 *
 * Skipped entirely on touch devices: there is no hover there, so the
 * only thing a pointer handler would add is a tap that makes the card
 * lurch. `(pointer: fine)` is the honest test for "has a mouse".
 */
export function usePointerTilt(maxDegrees = 9): MutableRefObject<HTMLDivElement | null> {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (prefersReducedMotion()) return;
    if (!window.matchMedia("(pointer: fine)").matches) return;

    let frame = 0;
    let pending: { x: number; y: number } | null = null;

    const apply = () => {
      frame = 0;
      if (!pending) return;
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;

      // Pointer position as -0.5 … +0.5 across the element.
      const px = (pending.x - rect.left) / rect.width - 0.5;
      const py = (pending.y - rect.top) / rect.height - 0.5;

      // Y-axis rotation follows horizontal movement, X-axis follows
      // vertical movement and is inverted — pushing the pointer up should
      // tip the far edge away, the way a physical panel would.
      el.style.setProperty("--ry", `${(px * maxDegrees * 2).toFixed(2)}deg`);
      el.style.setProperty("--rx", `${(-py * maxDegrees).toFixed(2)}deg`);
    };

    const onMove = (event: PointerEvent) => {
      pending = { x: event.clientX, y: event.clientY };
      // Coalesce: a mouse can emit far more events than there are frames.
      if (!frame) frame = requestAnimationFrame(apply);
    };

    const onLeave = () => {
      pending = null;
      if (frame) {
        cancelAnimationFrame(frame);
        frame = 0;
      }
      el.style.setProperty("--rx", "0deg");
      el.style.setProperty("--ry", "0deg");
    };

    el.addEventListener("pointermove", onMove, { passive: true });
    el.addEventListener("pointerleave", onLeave);

    return () => {
      if (frame) cancelAnimationFrame(frame);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerleave", onLeave);
    };
  }, [maxDegrees]);

  return ref;
}

/**
 * Adds `className` to the target once the page has scrolled past
 * `offset` pixels. Used to give the sticky header a border and a frosted
 * background only after it stops sitting over the hero.
 */
export function useScrolledPast(
  ref: RefObject<HTMLElement | null>,
  className: string,
  offset = 12
): void {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    let frame = 0;
    const update = () => {
      frame = 0;
      el.classList.toggle(className, window.scrollY > offset);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };

    update(); // correct on load, e.g. a restored scroll position
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
    };
  }, [ref, className, offset]);
}
