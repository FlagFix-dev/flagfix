"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

export type Theme = "light" | "dark" | "system";

/** Shared with the inline no-flash script in app/layout.tsx — both must
 * read and write the same key or the two would disagree on first paint. */
export const THEME_STORAGE_KEY = "flagfix.theme";

interface ThemeContextValue {
  /** What the user chose, including "system". */
  theme: Theme;
  /** What is actually on screen right now, after resolving "system". */
  resolvedTheme: "light" | "dark";
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function systemPrefersDark(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function applyTheme(theme: Theme): "light" | "dark" {
  const resolved = theme === "system" ? (systemPrefersDark() ? "dark" : "light") : theme;
  document.documentElement.classList.toggle("dark", resolved === "dark");
  return resolved;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  // Starts as "system" and is corrected on mount from localStorage. The
  // inline script in layout.tsx has already applied the right class to
  // <html> by this point, so there's no visible flash while this syncs.
  const [theme, setThemeState] = useState<Theme>("system");
  const [resolvedTheme, setResolvedTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    let stored: Theme | null = null;
    try {
      stored = localStorage.getItem(THEME_STORAGE_KEY) as Theme | null;
    } catch {
      // Private browsing or blocked storage — fall back to system.
    }
    const initial: Theme = stored === "light" || stored === "dark" ? stored : "system";
    setThemeState(initial);
    setResolvedTheme(applyTheme(initial));
  }, []);

  // While the user is on "system", follow the OS if they change it (e.g.
  // macOS/Windows switching to dark at sunset) without a page reload.
  useEffect(() => {
    if (theme !== "system" || typeof window === "undefined") return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => setResolvedTheme(applyTheme("system"));
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [theme]);

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
    setResolvedTheme(applyTheme(next));
    try {
      if (next === "system") localStorage.removeItem(THEME_STORAGE_KEY);
      else localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // Not being able to remember the choice shouldn't break the toggle.
    }
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme }}>{children}</ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within <ThemeProvider>");
  return ctx;
}
