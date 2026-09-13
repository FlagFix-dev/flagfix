import type { Config } from "tailwindcss";

// Design tokens for the whole app live here — one source of truth so a
// color or radius never drifts between components. Keep this file as the
// only place that defines brand colors; everything else references them
// by name (bg-brand-600, text-ink-700, etc).
const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  // Theme is driven by a `dark` class on <html>, set before first paint by
  // the inline script in app/layout.tsx (so there's no flash of the wrong
  // theme) and toggled by the account menu.
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // --- Themed tokens -------------------------------------------
        // These resolve through CSS variables defined in globals.css, so
        // the SAME utility class (`bg-surface`, `text-ink-900`) produces
        // the right colour in either theme. That's why dark mode needed
        // almost no changes to individual components: the palette moves
        // underneath them.
        //
        // `ink` is a semantic scale, not a literal one: ink-900 always
        // means "strongest text" and ink-50 always means "page
        // background", so in dark mode the scale is inverted rather than
        // darkened.
        surface: "rgb(var(--surface) / <alpha-value>)",
        ink: {
          50: "rgb(var(--ink-50) / <alpha-value>)",
          100: "rgb(var(--ink-100) / <alpha-value>)",
          200: "rgb(var(--ink-200) / <alpha-value>)",
          300: "rgb(var(--ink-300) / <alpha-value>)",
          400: "rgb(var(--ink-400) / <alpha-value>)",
          500: "rgb(var(--ink-500) / <alpha-value>)",
          600: "rgb(var(--ink-600) / <alpha-value>)",
          700: "rgb(var(--ink-700) / <alpha-value>)",
          800: "rgb(var(--ink-800) / <alpha-value>)",
          900: "rgb(var(--ink-900) / <alpha-value>)",
        },
        brand: {
          // The two lightest brand steps are used as tinted backgrounds,
          // so they have to darken in dark mode; the rest are saturated
          // enough to read correctly on either theme.
          50: "rgb(var(--brand-50) / <alpha-value>)",
          100: "rgb(var(--brand-100) / <alpha-value>)",
          200: "#c1d4ff",
          300: "#9bb6ff",
          400: "#6f8fff",
          500: "#4a68f5",
          600: "#3549d6",
          700: "#2b39ac",
          800: "#252f89",
          900: "#212a6e",
        },
        severity: {
          critical: "#dc2626",
          high: "#ea580c",
          medium: "#ca8a04",
          low: "#16a34a",
        },
        // A second accent alongside `brand` — used sparingly (gradients,
        // highlight chips, the homepage) so the palette reads as
        // "modern SaaS" rather than a single flat blue everywhere.
        accent: {
          50: "rgb(var(--accent-50) / <alpha-value>)",
          100: "rgb(var(--accent-100) / <alpha-value>)",
          400: "#a78bfa",
          500: "#8b5cf6",
          600: "#7c3aed",
          700: "#6d28d9",
        },
      },
      fontFamily: {
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Inter",
          "Roboto",
          "Helvetica Neue",
          "Arial",
          "sans-serif",
        ],
      },
      borderRadius: {
        xl: "0.875rem",
        "2xl": "1.25rem",
        "3xl": "1.75rem",
      },
      backgroundImage: {
        "brand-gradient": "linear-gradient(135deg, #4a68f5 0%, #7c3aed 100%)",
        "brand-gradient-soft": "linear-gradient(135deg, #eef4ff 0%, #f4f0ff 100%)",
      },
      boxShadow: {
        card: "0 1px 2px 0 rgb(16 24 40 / 0.05), 0 1px 3px 0 rgb(16 24 40 / 0.06)",
        "card-hover": "0 4px 6px -1px rgb(16 24 40 / 0.08), 0 2px 4px -2px rgb(16 24 40 / 0.06)",
        // The "some interface 3D" depth accents — used deliberately on a
        // handful of elements (primary buttons, stat tiles, the hero) so
        // the effect reads as intentional, not applied everywhere.
        raised: "0 8px 16px -4px rgb(53 73 214 / 0.25), 0 2px 4px -2px rgb(53 73 214 / 0.15)",
        "raised-hover": "0 12px 24px -6px rgb(53 73 214 / 0.32), 0 4px 8px -2px rgb(53 73 214 / 0.2)",
        glow: "0 0 0 1px rgb(255 255 255 / 0.08) inset, 0 8px 24px -6px rgb(124 58 237 / 0.35)",
      },
    },
  },
  plugins: [],
};

export default config;
