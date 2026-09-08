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
      },
      boxShadow: {
        card: "0 1px 2px 0 rgb(16 24 40 / 0.05), 0 1px 3px 0 rgb(16 24 40 / 0.06)",
        "card-hover": "0 4px 6px -1px rgb(16 24 40 / 0.08), 0 2px 4px -2px rgb(16 24 40 / 0.06)",
      },
    },
  },
  plugins: [],
};

export default config;
