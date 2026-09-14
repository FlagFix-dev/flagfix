"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/auth/auth-provider";
import { useTheme } from "@/components/theme/theme-provider";
import { useReveal, usePointerTilt, useScrolledPast } from "@/lib/use-motion";

/* ---------------------------------------------------------------------
   Page content lives as data at the top of the file rather than inline
   in the markup. It keeps the JSX readable, and it means copy changes
   never require touching layout code.
   ------------------------------------------------------------------ */

const CAPABILITIES = [
  "Duplicate detection",
  "Explainable priority",
  "SLA clock",
  "Photo & video evidence",
  "Role-based access",
];

const FEATURES = [
  {
    title: "Report in seconds",
    body: "Photos, a short video, a description, and where it is. That is the entire form — no dropdown maze, no ticket jargon.",
    icon: (
      <path d="M4 7h3l1.2-2h7.6L17 7h3v12H4V7Zm8 3.2a3.8 3.8 0 1 0 0 7.6 3.8 3.8 0 0 0 0-7.6Z" />
    ),
  },
  {
    title: "Duplicates merge themselves",
    body: '"Before Room 303" and "beside room 303" become one job, not two. The AI compares meaning, not keywords.',
    icon: <path d="M8 6a4 4 0 1 0 0 8 4 4 0 0 0 0-8Zm8 4a4 4 0 1 0 0 8 4 4 0 0 0 0-8Zm-5.4 1.6 2.8 2.8" />,
  },
  {
    title: "Priority that explains itself",
    body: "Every score comes with a plain-language reason. Staff never see a bare number they are expected to trust.",
    icon: <path d="M5 19V9m7 10V5m7 14v-7" />,
  },
  {
    title: "Routed to the right team",
    body: "Plumbing reaches maintenance, Wi-Fi reaches IT — automatically, with a response clock already running.",
    icon: <path d="M12 4v6m0 0-3-3m3 3 3-3M5 14v4h14v-4" />,
  },
];

const AI_STEPS = [
  {
    step: "01",
    title: "Understand",
    body: "Reads the description and pulls out category, severity, urgency and safety risk — using only what was actually written, never guessed.",
  },
  {
    step: "02",
    title: "Connect",
    body: "Compares the meaning of a new report against recent ones, so differently-worded reports of one problem link together.",
  },
  {
    step: "03",
    title: "Prioritise",
    body: "Combines severity, urgency, safety risk, how many people are affected and whether it keeps recurring into one explainable score.",
  },
  {
    step: "04",
    title: "Route",
    body: "Matches the detected category against your institution's own departments, so the right team sees it first.",
  },
];

const RAW_REPORTS = [
  { text: "wifi not working in block a", meta: "Student · 2nd floor" },
  { text: "Internet gone on 2nd floor", meta: "Student · Room 214" },
  { text: "cannot connect to campus wifi :(", meta: "Student · Library" },
  { text: "network is extremely slow today", meta: "Staff · Block A" },
  { text: "no wifi near room 214", meta: "Student · Block A" },
];

const FAQS = [
  {
    q: "Do I need a fixed list of problem categories before I start?",
    a: "No. Every new institution starts with a sensible default set — IT, Electrical, Plumbing, Cleanliness, Security, Hostel/Residence, Infrastructure and Other — each with a rough estimate of how long that kind of job usually takes. Adjust them whenever you like.",
  },
  {
    q: "How does FlagFix tell students and staff apart?",
    a: "At signup, staff enter an institute staff code that only your admin or owner has. Students never see it or need it. Staff and admins get the full queue and the AI analysis; students see only their own reports.",
  },
  {
    q: "What happens if the AI is briefly unavailable?",
    a: "Reports are never blocked. If the AI pipeline is unreachable, the report is still saved and routed for manual review, and the dashboard says plainly that analysis is degraded rather than quietly showing you a default score as though it were real.",
  },
  {
    q: "Can staff show live progress on a report?",
    a: 'Yes. Staff accept a report and post short updates — "Technician on the way", "Almost done" — which the reporter and admins see immediately on the report page.',
  },
  {
    q: "Is one institution's data visible to another?",
    a: "No. Every institution is a separate tenant, isolated at the database level rather than by a filter in application code, so a query cannot accidentally cross that boundary.",
  },
];

/* --- Small presentational pieces ----------------------------------- */

function Logo() {
  return (
    <Link href="/" className="group flex items-center gap-2.5 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2">
      <span className="relative flex h-9 w-9 items-center justify-center rounded-[0.7rem] bg-brand-gradient text-sm font-bold text-white shadow-raised transition-transform duration-300 group-hover:-translate-y-0.5">
        <span aria-hidden="true" className="absolute inset-x-0 top-0 h-px rounded-t-[0.7rem] bg-white/50" />
        F
      </span>
      <span className="text-[1.0625rem] font-semibold tracking-tight text-ink-900">FlagFix</span>
    </Link>
  );
}

function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
      className="flex h-9 w-9 items-center justify-center rounded-lg text-ink-500 transition-colors hover:bg-ink-100 hover:text-ink-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
    >
      <svg viewBox="0 0 24 24" className="h-[1.1rem] w-[1.1rem]" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {isDark ? (
          <>
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
          </>
        ) : (
          <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z" />
        )}
      </svg>
    </button>
  );
}

/** A single raw complaint, as it appears floating around the console. */
function ReportChip({
  report,
  className,
  duration,
  delay,
}: {
  report: (typeof RAW_REPORTS)[number];
  className?: string;
  duration: string;
  delay: string;
}) {
  return (
    <div
      className={`animate-drift absolute w-max max-w-[13rem] rounded-xl border border-ink-100 bg-surface/95 px-3 py-2 shadow-card backdrop-blur ${className ?? ""}`}
      style={{ ["--drift-duration" as string]: duration, ["--drift-delay" as string]: delay }}
    >
      <p className="truncate text-[0.7rem] font-medium text-ink-700">&ldquo;{report.text}&rdquo;</p>
      <p className="mt-0.5 text-[0.625rem] text-ink-400">{report.meta}</p>
    </div>
  );
}

/**
 * The hero's centrepiece: a triage console rendered in real 3D space.
 *
 * The panel and the chips around it are separate layers at different
 * translateZ depths inside one perspective. Tilting the scene therefore
 * moves them by different amounts — genuine parallax, not a drop shadow
 * pretending to be depth.
 */
function TriageConsole() {
  const tiltRef = usePointerTilt(8);

  return (
    <div className="scene w-full">
      <div ref={tiltRef} className="scene-tilt relative mx-auto w-full max-w-[30rem]">
        {/* --- The console panel --- */}
        <div className="halo sheen relative overflow-hidden rounded-[1.4rem] border border-ink-100 bg-surface shadow-[0_30px_70px_-28px_rgb(16_24_40_/_0.45)]">
          {/* Title bar */}
          <div className="flex items-center gap-2 border-b border-ink-100 bg-ink-50/70 px-4 py-2.5">
            <span className="h-2.5 w-2.5 rounded-full bg-red-400/70" />
            <span className="h-2.5 w-2.5 rounded-full bg-amber-400/70" />
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/70" />
            <span className="ml-2 text-[0.7rem] font-medium text-ink-500">FlagFix — live queue</span>
            <span className="ml-auto flex items-center gap-1.5 text-[0.65rem] font-medium text-emerald-600">
              <span className="animate-pulse-ring h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Live
            </span>
          </div>

          <div className="space-y-3 p-4">
            {/* The merged cluster — the thing the whole product exists to
                produce. Lifted off the panel so it reads as the focus. */}
            <div className="depth-1 rounded-xl bg-brand-gradient p-4 text-white shadow-glow">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[0.65rem] font-medium uppercase tracking-[0.14em] text-white/70">
                    One underlying problem
                  </p>
                  <p className="mt-1 text-[0.95rem] font-semibold leading-tight">
                    Block A network failure
                  </p>
                </div>
                <span className="shrink-0 rounded-md bg-white/20 px-2 py-0.5 text-[0.65rem] font-semibold">
                  HIGH
                </span>
              </div>

              <dl className="mt-3 grid grid-cols-3 gap-2">
                {[
                  ["5", "reports"],
                  ["42", "affected"],
                  ["3d", "recurring"],
                ].map(([value, label]) => (
                  <div key={label} className="rounded-lg bg-white/10 px-2 py-1.5">
                    <dd className="tabular text-base font-bold leading-none">{value}</dd>
                    <dt className="mt-1 text-[0.6rem] text-white/70">{label}</dt>
                  </div>
                ))}
              </dl>

              {/* Priority meter — fills on load, so the card has one small
                  moment of life without ever looping distractingly. */}
              <div className="mt-3">
                <div className="flex items-center justify-between text-[0.6rem] text-white/70">
                  <span>Priority score</span>
                  <span className="tabular">78 / 100</span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/20">
                  <div
                    className="h-full rounded-full bg-white/90"
                    style={{ width: "78%", transition: "width 1.2s cubic-bezier(.22,1,.36,1)" }}
                  />
                </div>
              </div>
            </div>

            {/* Two ordinary queue rows, to place the cluster in context. */}
            {[
              { title: "Ceiling leak — 2nd floor washroom", tag: "Critical", tone: "text-severity-critical bg-red-500/10" },
              { title: "Tubelight flickering — Room 204", tag: "Low", tone: "text-severity-low bg-emerald-500/10" },
            ].map((row) => (
              <div
                key={row.title}
                className="flex items-center justify-between gap-3 rounded-xl border border-ink-100 bg-surface px-3 py-2.5"
              >
                <p className="truncate text-[0.78rem] font-medium text-ink-700">{row.title}</p>
                <span className={`shrink-0 rounded-md px-2 py-0.5 text-[0.65rem] font-semibold ${row.tone}`}>
                  {row.tag}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* --- Two raw complaints floating in front of the panel.
            Deliberately only two, and placed clear of the panel's top and
            bottom edges: an earlier pass had four ringing the card, and
            they covered the priority meter and the severity badges — the
            exact content the hero exists to show. Decoration must not
            eat the demo. Hidden below `lg`, where there is no room for
            them beside the panel at all. --- */}
        <div aria-hidden="true" className="pointer-events-none hidden lg:block">
          <ReportChip report={RAW_REPORTS[0]} className="depth-3 -left-20 -top-7" duration="6.5s" delay="0s" />
          <ReportChip report={RAW_REPORTS[3]} className="depth-2 -bottom-12 -right-24" duration="7.5s" delay="0.8s" />
        </div>
      </div>
    </div>
  );
}

/* --- Page --------------------------------------------------------- */

export default function HomePage() {
  const { claims, initializing } = useAuth();
  const router = useRouter();
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const pageRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLElement>(null);

  useReveal(pageRef);
  useScrolledPast(headerRef, "is-stuck");

  useEffect(() => {
    if (!initializing && claims) router.replace("/dashboard");
  }, [initializing, claims, router]);

  return (
    <div ref={pageRef} className="relative min-h-screen overflow-x-hidden bg-ink-50">
      {/* Ambient background. Fixed to the top of the document, behind
          everything, and inert to pointer and screen reader alike. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-[900px] overflow-hidden">
        <div className="aurora" />
        <div className="grid-veil" />
      </div>

      {/* ---------------- Header ---------------- */}
      <header
        ref={headerRef}
        className="sticky top-0 z-40 border-b border-transparent transition-colors duration-300 [&.is-stuck]:border-ink-100 [&.is-stuck]:bg-surface/80 [&.is-stuck]:backdrop-blur-xl"
      >
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <Logo />

          <nav aria-label="Primary" className="hidden items-center gap-1 md:flex">
            {[
              ["How it works", "#how"],
              ["Features", "#features"],
              ["FAQ", "#faq"],
            ].map(([label, href]) => (
              <a
                key={href}
                href={href}
                className="rounded-lg px-3 py-2 text-sm font-medium text-ink-600 transition-colors hover:bg-ink-100 hover:text-ink-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
              >
                {label}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Link href="/login" className="hidden sm:block">
              <Button variant="ghost" size="sm">
                Log in
              </Button>
            </Link>
            <Link href="/onboarding">
              <Button size="sm">Get started</Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="relative">
        {/* ---------------- Hero ---------------- */}
        <section className="mx-auto max-w-6xl px-6 pb-20 pt-12 lg:pt-20">
          <div className="grid items-center gap-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:gap-10">
            <div data-reveal>
              <span className="inline-flex items-center gap-2 rounded-full border border-ink-100 bg-surface/80 px-3 py-1 text-xs font-medium text-ink-600 backdrop-blur">
                <span className="h-1.5 w-1.5 rounded-full bg-brand-500" />
                For schools, colleges, hostels &amp; PGs
              </span>

              <h1 className="display mt-6 text-[2.15rem] font-bold leading-[1.08] text-ink-900 sm:text-[2.9rem] lg:text-[3.25rem]">
                Every broken thing on campus,{" "}
                <span className="bg-brand-gradient bg-clip-text text-transparent">
                  tracked until it is actually fixed.
                </span>
              </h1>

              <p className="mt-5 max-w-xl text-[0.98rem] leading-relaxed text-ink-600 sm:mt-6 sm:text-[1.05rem]">
                Complaints arrive as texts, walk-ins and forgotten emails. FlagFix turns them into
                one prioritised queue your maintenance team can work through — and recognises when
                ten different complaints are really one problem.
              </p>

              <div className="mt-9 flex flex-wrap items-center gap-3">
                <Link href="/onboarding">
                  <Button size="lg">Set up your institution</Button>
                </Link>
                <Link href="/signup">
                  <Button size="lg" variant="secondary">
                    I have an invite
                  </Button>
                </Link>
              </div>

              <p className="mt-5 text-xs text-ink-500">
                Free to set up · No card required · Ready in about two minutes
              </p>
            </div>

            <div data-reveal style={{ ["--reveal-delay" as string]: "120ms" }} className="lg:pl-6">
              <TriageConsole />
            </div>
          </div>

          {/* Capability strip */}
          <div data-reveal className="mt-20">
            <div className="hairline" />
            <ul className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3 py-6">
              {CAPABILITIES.map((c) => (
                <li key={c} className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.1em] text-ink-500">
                  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-brand-500" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="m5 13 4 4L19 7" />
                  </svg>
                  {c}
                </li>
              ))}
            </ul>
            <div className="hairline" />
          </div>
        </section>

        {/* ---------------- The clustering demo ---------------- */}
        <section aria-labelledby="clustering-heading" className="mx-auto max-w-6xl px-6 py-16 sm:py-24">
          <div data-reveal className="mx-auto max-w-2xl text-center">
            <h2 id="clustering-heading" className="display text-[1.75rem] font-bold text-ink-900 sm:text-[2.35rem]">
              Ten complaints are often one problem
            </h2>
            <p className="mt-4 text-ink-600">
              These five reports share almost no words. FlagFix reads what they mean rather than
              which words they used, and files them as a single job for your team.
            </p>
          </div>

          <div className="mt-14 grid items-center gap-8 lg:grid-cols-[1fr_auto_1fr]">
            <ul className="space-y-2.5">
              {RAW_REPORTS.map((r, i) => (
                <li
                  key={r.text}
                  data-reveal
                  style={{ ["--reveal-delay" as string]: `${i * 70}ms` }}
                  className="flex items-center justify-between gap-3 rounded-xl border border-ink-100 bg-surface px-4 py-3 shadow-card"
                >
                  <span className="text-sm text-ink-700">&ldquo;{r.text}&rdquo;</span>
                  <span className="shrink-0 text-[0.68rem] text-ink-400">{r.meta}</span>
                </li>
              ))}
            </ul>

            <div data-reveal aria-hidden="true" className="flex items-center justify-center">
              <div className="flex h-11 w-11 items-center justify-center rounded-full border border-ink-100 bg-surface text-brand-500 shadow-card">
                <svg viewBox="0 0 24 24" className="h-5 w-5 lg:-rotate-90" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 5v14m0 0-5-5m5 5 5-5" />
                </svg>
              </div>
            </div>

            <div data-reveal style={{ ["--reveal-delay" as string]: "160ms" }}>
              <div className="halo relative overflow-hidden rounded-2xl bg-brand-gradient p-6 text-white shadow-glow">
                <p className="text-[0.7rem] font-medium uppercase tracking-[0.14em] text-white/70">
                  One underlying problem
                </p>
                <p className="mt-2 text-xl font-bold">Block A network failure</p>
                <p className="mt-2 text-sm leading-relaxed text-white/80">
                  Grouped by meaning at 0.88 similarity — above the auto-match threshold, so your
                  team sees one job with five voices behind it.
                </p>

                <dl className="mt-5 grid grid-cols-3 gap-3">
                  {[
                    ["5", "reports"],
                    ["42", "affected"],
                    ["3", "days recurring"],
                  ].map(([value, label]) => (
                    <div key={label}>
                      <dd className="tabular text-2xl font-bold leading-none">{value}</dd>
                      <dt className="mt-1.5 text-[0.68rem] text-white/70">{label}</dt>
                    </div>
                  ))}
                </dl>

                <div className="mt-5 flex flex-wrap gap-2">
                  {["IT department", "High priority", "SLA at risk"].map((tag) => (
                    <span key={tag} className="rounded-full bg-white/15 px-2.5 py-1 text-[0.7rem] font-medium">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ---------------- Features ---------------- */}
        <section id="features" aria-labelledby="features-heading" className="mx-auto max-w-6xl px-6 py-16 sm:py-24">
          <div data-reveal className="mx-auto max-w-2xl text-center">
            <h2 id="features-heading" className="display text-[1.75rem] font-bold text-ink-900 sm:text-[2.35rem]">
              Built for the people who actually fix things
            </h2>
            <p className="mt-4 text-ink-600">
              Every screen answers one question: what should I deal with next, and why?
            </p>
          </div>

          <div className="tilt-parent mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map((f, i) => (
              <article
                key={f.title}
                data-reveal
                style={{ ["--reveal-delay" as string]: `${i * 80}ms` }}
                className="tilt-card group rounded-2xl border border-ink-100 bg-surface p-6 shadow-card"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600 transition-colors group-hover:bg-brand-100 dark:text-brand-300">
                  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    {f.icon}
                  </svg>
                </span>
                <h3 className="mt-4 text-[0.95rem] font-semibold text-ink-900">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-600">{f.body}</p>
              </article>
            ))}
          </div>
        </section>

        {/* ---------------- How the AI thinks ---------------- */}
        <section id="how" aria-labelledby="how-heading" className="mx-auto max-w-6xl px-6 py-16 sm:py-24">
          <div data-reveal className="mx-auto max-w-2xl text-center">
            <span className="inline-flex items-center rounded-full bg-accent-100 px-3 py-1 text-xs font-medium text-accent-700 dark:text-accent-400">
              Under the hood
            </span>
            <h2 id="how-heading" className="display mt-5 text-[1.75rem] font-bold text-ink-900 sm:text-[2.35rem]">
              What happens the moment a report arrives
            </h2>
            <p className="mt-4 text-ink-600">
              Four steps, every one of them logged with a reason your staff can read.
            </p>
          </div>

          <div className="relative mt-14">
            {/* The line connecting the four steps. Decorative, so it is
                hidden from assistive tech and dropped on small screens
                where the steps stack vertically. */}
            <div
              aria-hidden="true"
              className="absolute left-0 right-0 top-[2.15rem] hidden h-px bg-gradient-to-r from-transparent via-brand-300/60 to-transparent lg:block"
            />

            <ol className="tilt-parent relative grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {AI_STEPS.map((s, i) => (
                <li
                  key={s.step}
                  data-reveal
                  style={{ ["--reveal-delay" as string]: `${i * 90}ms` }}
                  className="tilt-card rounded-2xl border border-ink-100 bg-surface p-6 shadow-card"
                >
                  <span className="tabular flex h-9 w-9 items-center justify-center rounded-full bg-brand-gradient text-xs font-bold text-white shadow-raised">
                    {s.step}
                  </span>
                  <h3 className="mt-4 text-[0.95rem] font-semibold text-ink-900">{s.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-ink-600">{s.body}</p>
                </li>
              ))}
            </ol>
          </div>

          <p data-reveal className="mx-auto mt-10 max-w-2xl text-center text-xs leading-relaxed text-ink-500">
            If the AI pipeline is ever unavailable, reports are still saved and routed for manual
            review — and the dashboard says so, instead of quietly showing a default score as
            though it were real analysis.
          </p>
        </section>

        {/* ---------------- FAQ ---------------- */}
        <section id="faq" aria-labelledby="faq-heading" className="mx-auto max-w-6xl px-6 py-16 sm:py-24">
          <div data-reveal className="mx-auto max-w-2xl text-center">
            <h2 id="faq-heading" className="display text-[1.75rem] font-bold text-ink-900 sm:text-[2.35rem]">
              Questions people ask first
            </h2>
          </div>

          <div data-reveal className="mx-auto mt-12 max-w-2xl divide-y divide-ink-100 overflow-hidden rounded-2xl border border-ink-100 bg-surface">
            {FAQS.map((item, i) => {
              const open = openFaq === i;
              return (
                <div key={item.q}>
                  <h3>
                    <button
                      type="button"
                      onClick={() => setOpenFaq(open ? null : i)}
                      aria-expanded={open}
                      aria-controls={`faq-panel-${i}`}
                      id={`faq-button-${i}`}
                      className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition-colors hover:bg-ink-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-500"
                    >
                      <span className="text-sm font-medium text-ink-900">{item.q}</span>
                      <span
                        aria-hidden="true"
                        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-ink-200 text-ink-500 transition-transform duration-300 ${open ? "rotate-45" : ""}`}
                      >
                        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                          <path d="M12 5v14M5 12h14" />
                        </svg>
                      </span>
                    </button>
                  </h3>
                  <div
                    id={`faq-panel-${i}`}
                    role="region"
                    aria-labelledby={`faq-button-${i}`}
                    hidden={!open}
                    className="px-5 pb-5"
                  >
                    <p className="text-sm leading-relaxed text-ink-600">{item.a}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* ---------------- Closing call to action ---------------- */}
        <section className="mx-auto max-w-6xl px-6 pb-24">
          <div
            data-reveal
            className="halo relative overflow-hidden rounded-[1.75rem] bg-brand-gradient px-8 py-14 text-center text-white shadow-glow sm:px-16"
          >
            <div aria-hidden="true" className="absolute inset-0 opacity-25 [background-image:radial-gradient(circle_at_20%_20%,white_0,transparent_45%),radial-gradient(circle_at_80%_70%,white_0,transparent_45%)]" />
            <div className="relative">
              <h2 className="display text-[1.6rem] font-bold sm:text-[2.2rem]">
                Set up your institution in two minutes
              </h2>
              <p className="mx-auto mt-4 max-w-lg text-white/80">
                Create your workspace, share one link with students and staff, and watch the first
                reports arrive already sorted.
              </p>
              <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                <Link href="/onboarding">
                  <Button size="lg" variant="secondary">
                    Set up your institution
                  </Button>
                </Link>
                <Link
                  href="/login"
                  className="rounded-xl px-5 py-3 text-sm font-medium text-white/90 underline-offset-4 transition-colors hover:bg-white/10 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
                >
                  Log in instead
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* ---------------- Footer ---------------- */}
      <footer className="border-t border-ink-100">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 px-6 py-10 sm:flex-row">
          <div className="flex flex-col items-center gap-2 sm:items-start">
            <Logo />
            <p className="text-xs text-ink-500">
              AI-assisted problem reporting for campuses, hostels and PGs.
            </p>
          </div>

          <nav aria-label="Footer" className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
            {[
              ["How it works", "#how"],
              ["Features", "#features"],
              ["FAQ", "#faq"],
              ["Log in", "/login"],
            ].map(([label, href]) => (
              <a
                key={label}
                href={href}
                className="rounded text-xs font-medium text-ink-500 transition-colors hover:text-ink-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
              >
                {label}
              </a>
            ))}
          </nav>

          <p className="text-xs text-ink-400">© {new Date().getFullYear()} FlagFix</p>
        </div>
      </footer>
    </div>
  );
}
