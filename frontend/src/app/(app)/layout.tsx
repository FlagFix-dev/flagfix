"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/auth-provider";
import { Navbar } from "@/components/layout/navbar";
import { FullPageSpinner } from "@/components/ui/spinner";

/** Every route under (app) requires a logged-in session. This layout is
 * the single gate — individual pages never need to re-check auth. */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { claims, initializing } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!initializing && !claims) router.replace("/login");
  }, [initializing, claims, router]);

  if (initializing || !claims) return <FullPageSpinner />;

  return (
    <div className="relative min-h-screen bg-ink-50">
      {/* Ambient colour wash behind the whole app. Fixed and non-
          interactive, it gives the glass surfaces (navbar, cards)
          something to actually refract, which is what stops "frosted
          glass" from just looking like grey. */}
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="orb animate-float-slow -left-24 -top-24 h-80 w-80 bg-brand-300" />
        <div className="orb animate-float-slower right-[-6rem] top-32 h-96 w-96 bg-accent-400" />
        <div className="orb left-1/3 top-[60%] h-72 w-72 bg-brand-200 opacity-40" />
      </div>

      <div className="relative">
        <Navbar />
        <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
      </div>
    </div>
  );
}
