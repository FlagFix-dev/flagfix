"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/auth/auth-provider";

const FEATURES = [
  {
    title: "Report in seconds",
    body: "A photo, a short description, and where it is. That's the whole form.",
  },
  {
    title: "AI understands duplicates",
    body: '"Before Room 303" and "beside Room 303" describing the same broken tile get merged into one issue automatically — not two.',
  },
  {
    title: "Priority that explains itself",
    body: "Every report gets a clear, human-readable reason for its urgency — never a black-box number.",
  },
  {
    title: "Routed to the right team",
    body: "Plumbing goes to maintenance, Wi-Fi issues go to IT — automatically, with an SLA clock attached.",
  },
];

export default function HomePage() {
  const { claims, initializing } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!initializing && claims) router.replace("/dashboard");
  }, [initializing, claims, router]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-brand-50 via-white to-white">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-sm font-bold text-white">
            F
          </div>
          <span className="text-lg font-semibold text-ink-900">FlagFix</span>
        </div>
        <nav className="flex items-center gap-3">
          <Link href="/login">
            <Button variant="ghost">Log in</Button>
          </Link>
          <Link href="/onboarding">
            <Button>Set up your institution</Button>
          </Link>
        </nav>
      </header>

      <main className="mx-auto max-w-6xl px-6 pb-24 pt-10 sm:pt-20">
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-flex items-center rounded-full bg-brand-100 px-3 py-1 text-xs font-medium text-brand-700">
            For colleges, universities, hostels &amp; PGs
          </span>
          <h1 className="mt-6 text-4xl font-bold tracking-tight text-ink-900 sm:text-5xl">
            Every broken thing on campus,
            <br /> tracked until it's actually fixed.
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-ink-600">
            FlagFix turns scattered complaints — texts, walk-ins, forgotten emails — into one
            prioritized queue your maintenance team can actually work through, with AI that
            spots duplicate reports of the same problem automatically.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link href="/onboarding">
              <Button size="lg">Set up your institution</Button>
            </Link>
            <Link href="/signup">
              <Button size="lg" variant="secondary">
                I have an invite — sign up
              </Button>
            </Link>
          </div>
        </div>

        <div className="mt-20 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f) => (
            <div key={f.title} className="rounded-2xl border border-ink-100 bg-white p-5 shadow-card">
              <h3 className="text-sm font-semibold text-ink-900">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-600">{f.body}</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
