import type { Config } from "tailwindcss";

// Design tokens for the whole app live here — one source of truth so a
// color or radius never drifts between components. Keep this file as the
// only place that defines brand colors; everything else references them
// by name (bg-brand-600, text-ink-700, etc).
const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eef4ff",
          100: "#dfe9ff",
          200: "#c1d4ff",
          300: "#9bb6ff",
          400: "#6f8fff",
          500: "#4a68f5",
          600: "#3549d6",
          700: "#2b39ac",
          800: "#252f89",
          900: "#212a6e",
        },
        ink: {
          50: "#f7f8fa",
          100: "#eef0f4",
          200: "#dde1e8",
          300: "#c3c9d4",
          400: "#98a1b3",
          500: "#707b91",
          600: "#545e74",
          700: "#3f475c",
          800: "#282e3d",
          900: "#161a24",
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
          50: "#f4f0ff",
          100: "#e9e0ff",
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
