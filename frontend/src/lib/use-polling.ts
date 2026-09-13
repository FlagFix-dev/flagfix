"use client";

import { useEffect, useRef } from "react";

/**
 * Runs `callback` immediately, then on an interval — but only while the
 * tab is actually visible.
 *
 * Two reasons this matters beyond tidiness. First, a background tab left
 * open all day would otherwise keep hitting the API every few seconds
 * forever, which on a free-tier backend with a database in another region
 * is real load for nobody's benefit. Second, when the person comes back to
 * the tab they get a fresh fetch immediately rather than staring at data
 * up to a full interval old.
 *
 * The callback is held in a ref so callers don't have to memoise it —
 * passing an inline arrow function won't restart the timer on every
 * render.
 */
export function usePolling(callback: () => void, intervalMs: number, enabled = true): void {
  const savedCallback = useRef(callback);

  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  useEffect(() => {
    if (!enabled) return;

    let timer: ReturnType<typeof setInterval> | null = null;

    const run = () => savedCallback.current();

    const start = () => {
      if (timer !== null) return;
      timer = setInterval(run, intervalMs);
    };

    const stop = () => {
      if (timer === null) return;
      clearInterval(timer);
      timer = null;
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        run(); // catch up on whatever was missed while hidden
        start();
      } else {
        stop();
      }
    };

    run();
    if (document.visibilityState === "visible") start();
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [intervalMs, enabled]);
}
