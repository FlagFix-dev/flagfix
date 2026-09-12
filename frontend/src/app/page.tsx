"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { useAuth } from "@/components/auth/auth-provider";

const FEATURES = [
  {
    title: "Report in seconds",
    body: "Photos, a short video, a clear description, and where it is. That's the whole form.",
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

const AI_STEPS = [
  {
    step: "01",
    title: "Understand",
    body: "Reads the description and extracts category, severity, urgency, and safety risk — using only what's actually written, never guessed.",
  },
  {
    step: "02",
    title: "Connect",
    body: "Compares the meaning of new reports against recent ones, so differently-worded reports of the same problem get linked together.",
  },
  {
    step: "03",
    title: "Prioritize",
    body: "Combines severity, urgency, safety risk, how many people are affected, and whether it keeps recurring into one explainable score.",
  },
  {
    step: "04",
    title: "Route",
    body: "Matches the detected category against your institution's own departments, so the right team sees it first — no manual sorting.",
  },
];

const FAQS = [
  {
    q: "Do I need to already have a fixed list of problem categories?",
    a: "No — every new institution starts with a sensible default set (IT, Electrical, Plumbing, Cleanliness, Security, Hostel/Residence, Infrastructure, Other), each with a rough \"how long this usually takes\" estimate. You can adjust these later.",
  },
  {
    q: "How does FlagFix tell students and staff apart?",
    a: "At signup, staff enter an institute staff code that only your admin/owner has (shown on the Locations page) — students never see or need it. Staff and admins see the full report queue and AI analysis; students only see their own reports.",
  },
  {
    q: "What happens if the AI is briefly unavailable?",
    a: "Reports never get blocked. If the AI pipeline is unreachable, a report is still saved and routed for manual review instead of being lost or rejected.",
  },
  {
    q: "Can staff show live progress on a report?",
    a: 'Yes — staff can accept a report and post quick updates like "Technician on the way" or "Almost done," which reporters and admins see immediately on the report page.',
  },
];

export default function HomePage() {
  const { claims, initializing } = useAuth();
  const router = useRouter();
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  useEffect(() => {
    if (!initializing && claims) router.replace("/dashboard");
  }, [initializing, claims, router]);

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-b from-brand-50 via-white to-white">
      {/* Ambient depth behind the hero — soft, slow-drifting colour that
          gives the page a sense of space without competing with text. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-[720px] overflow-hidden">
        <div className="orb animate-float-slow -left-32 -top-32 h-[26rem] w-[26rem] bg-brand-300" />
        <div className="orb animate-float-slower right-[-8rem] top-10 h-[30rem] w-[30rem] bg-accent-400" />
        <div className="orb left-1/2 top-64 h-72 w-72 -translate-x-1/2 bg-brand-200 opacity-40" />
      </div>

      <header className="relative mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-gradient text-sm font-bold text-white shadow-raised">
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

      <main className="relative mx-auto max-w-6xl px-6 pb-24 pt-10 sm:pt-20">
        <div className="mx-auto max-w-3xl animate-fade-up text-center">
          <span className="inline-flex items-center rounded-full bg-brand-100 px-3 py-1 text-xs font-medium text-brand-700">
            For colleges, universities, hostels &amp; PGs
          </span>
          <h1 className="mt-6 text-4xl font-bold tracking-tight text-ink-900 sm:text-5xl">
            Every broken thing on campus,
            <br />
            <span className="bg-brand-gradient bg-clip-text text-transparent">tracked until it's actually fixed.</span>
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

        <div className="tilt-parent mt-20 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f, i) => (
            <div
              key={f.title}
              style={{ animationDelay: `${i * 70}ms` }}
              className="tilt-card animate-fade-up rounded-2xl border border-ink-100 bg-white p-5 shadow-card"
            >
              <h3 className="text-sm font-semibold text-ink-900">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-600">{f.body}</p>
            </div>
          ))}
        </div>

        {/* --- The concrete "here is what the AI actually does" demo. Shows
            five differently-worded reports collapsing into one problem,
            which is the single clearest way to explain the product. --- */}
        <section className="mt-28">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight text-ink-900">
              Ten complaints are often one problem
            </h2>
            <p className="mt-3 text-ink-600">
              These five reports share almost no words. FlagFix reads what they mean, not which words
              they used — and files them as a single job for your team.
            </p>
          </div>

          <div className="mt-10 grid items-center gap-6 lg:grid-cols-[1fr_auto_1fr]">
            <div className="space-y-2.5">
              {[
                "wifi not working in block a",
                "Internet gone on 2nd floor",
                "cannot connect to campus wifi :(",
                "network is extremely slow today",
                "no wifi near room 214",
              ].map((t, i) => (
                <div
                  key={t}
                  style={{ animationDelay: `${i * 80}ms` }}
                  className="animate-fade-up rounded-xl border border-ink-100 bg-white px-4 py-2.5 text-sm text-ink-700 shadow-card"
                >
                  "{t}"
                </div>
              ))}
            </div>

            <div className="flex items-center justify-center text-3xl text-brand-400 lg:flex-col">
              <span className="hidden lg:block">↓</span>
              <span className="lg:hidden">↓</span>
            </div>

            <Card elevated className="glass-dark animate-fade-up text-white">
              <CardBody className="space-y-3">
                <p className="text-xs font-medium uppercase tracking-wide text-white/70">
                  One underlying problem
                </p>
                <p className="text-xl font-bold">Block A network failure</p>
                <div className="grid grid-cols-3 gap-3 pt-1">
                  <div>
                    <p className="text-2xl font-bold">5</p>
                    <p className="text-xs text-white/70">reports</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold">42</p>
                    <p className="text-xs text-white/70">affected</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold">3</p>
                    <p className="text-xs text-white/70">days recurring</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 pt-1">
                  <span className="rounded-full bg-white/15 px-2.5 py-0.5 text-xs">IT department</span>
                  <span className="rounded-full bg-white/15 px-2.5 py-0.5 text-xs">High priority</span>
                  <span className="rounded-full bg-red-400/30 px-2.5 py-0.5 text-xs">SLA at risk</span>
                </div>
              </CardBody>
            </Card>
          </div>
        </section>

        {/* --- How FlagFix's AI thinks --- */}
        <section className="mt-28">
          <div className="mx-auto max-w-2xl text-center">
            <span className="inline-flex items-center rounded-full bg-accent-100 px-3 py-1 text-xs font-medium text-accent-700">
              Under the hood
            </span>
            <h2 className="mt-4 text-3xl font-bold tracking-tight text-ink-900">How FlagFix's AI thinks</h2>
            <p className="mt-3 text-ink-600">
              Ten complaints aren't always ten problems — sometimes they're one problem, reported
              ten different ways. Here's what happens the moment a report comes in.
            </p>
          </div>

          <div className="tilt-parent mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {AI_STEPS.map((s) => (
              <Card key={s.step} elevated tilt className="bg-white">
                <CardBody>
                  <span className="text-xs font-bold text-accent-500">{s.step}</span>
                  <h3 className="mt-1 text-base font-semibold text-ink-900">{s.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-ink-600">{s.body}</p>
                </CardBody>
              </Card>
            ))}
          </div>

          <p className="mx-auto mt-6 max-w-2xl text-center text-xs text-ink-500">
            Every AI decision is logged with a plain-language reason shown to your staff — never a
            bare number with no explanation. If the AI pipeline is ever unavailable, reports still
            get saved and routed for manual review, so nothing is ever lost.
          </p>
        </section>

        {/* --- Docs / FAQ --- */}
        <section className="mt-28">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight text-ink-900">Docs &amp; frequently asked questions</h2>
            <p className="mt-3 text-ink-600">The essentials — for a deeper walkthrough, ask whoever set up your workspace.</p>
          </div>

          <div className="mx-auto mt-8 max-w-2xl space-y-3">
            {FAQS.map((item, i) => (
              <div key={item.q} className="overflow-hidden rounded-xl border border-ink-100 bg-white">
                <button
                  type="button"
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="flex w-full items-center justify-between gap-4 px-4 py-3.5 text-left"
                >
                  <span className="text-sm font-medium text-ink-900">{item.q}</span>
                  <span className={`shrink-0 text-ink-400 transition-transform ${openFaq === i ? "rotate-45" : ""}`}>+</span>
                </button>
                {openFaq === i && (
                  <div className="border-t border-ink-100 px-4 py-3.5">
                    <p className="text-sm leading-relaxed text-ink-600">{item.a}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
