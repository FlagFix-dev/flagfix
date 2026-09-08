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
    <div className="min-h-screen bg-ink-50">
      <Navbar />
      <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
    </div>
  );
}
