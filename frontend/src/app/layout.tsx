import type { Metadata } from "next";
import { AuthProvider } from "@/components/auth/auth-provider";
import { ThemeProvider } from "@/components/theme/theme-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: "FlagFix",
  description: "AI-powered problem reporting and resolution for campuses, hostels, and PGs.",
};

/**
 * Runs before the browser paints anything, so a dark-mode user never sees
 * a white flash while React hydrates. It has to be inline and blocking for
 * that reason — a deferred script would run too late to matter. Kept
 * deliberately tiny, and wrapped in try/catch because localStorage throws
 * outright in some privacy modes.
 */
const NO_FLASH_THEME_SCRIPT = `
(function () {
  try {
    var stored = localStorage.getItem('flagfix.theme');
    var dark = stored === 'dark' ||
      (!stored && window.matchMedia('(prefers-color-scheme: dark)').matches);
    if (dark) document.documentElement.classList.add('dark');
  } catch (e) {}
})();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: NO_FLASH_THEME_SCRIPT }} />
      </head>
      <body className="bg-ink-50 font-sans text-ink-900 antialiased">
        <ThemeProvider>
          <AuthProvider>{children}</AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
