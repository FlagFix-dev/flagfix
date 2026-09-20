"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { Logo } from "@/components/brand/logo";
import { useAuth } from "@/components/auth/auth-provider";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError } from "@/lib/api";
import { ORG_TYPE_CHOICES, vocabularyFor } from "@/lib/terminology";
import type { BlockInput, OrgCreateResponse, OrgType } from "@/lib/types";

/* ---------------------------------------------------------------------
   Institution onboarding, as a wizard.

   One long form asked everything at once, including questions that only
   make sense once we know what kind of institution this is — a PG does
   not have "blocks", and only a hostel or PG is asked about floors. So
   the type comes first and every later step reads its wording from
   lib/terminology.ts.

   The whole thing is ONE request at the end. Nothing is written until
   the owner submits, so abandoning the wizard halfway leaves no
   half-built institution behind, and the workspace URL cannot be
   reserved by someone who never finishes.
   ------------------------------------------------------------------ */

const STEPS = ["Type", "Details", "Layout", "Your account"] as const;
type StepIndex = 0 | 1 | 2 | 3 | 4; // 4 is the success screen

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

/** Progress rail. Purely decorative for screen readers — the step
 * heading below it already announces where you are. */
function StepRail({ current }: { current: number }) {
  return (
    <ol aria-hidden="true" className="mb-8 flex items-center gap-2">
      {STEPS.map((label, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <li key={label} className="flex flex-1 flex-col gap-2">
            <span
              className={`h-1 rounded-full transition-colors duration-300 ${
                done || active ? "bg-brand-gradient" : "bg-ink-200"
              }`}
            />
            <span
              className={`text-[0.7rem] font-medium transition-colors ${
                active ? "text-ink-900" : "text-ink-400"
              }`}
            >
              {label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

export default function OnboardingPage() {
  const { createOrg } = useAuth();
  const router = useRouter();

  const [step, setStep] = useState<StepIndex>(0);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [created, setCreated] = useState<OrgCreateResponse | null>(null);

  // Step 1
  const [orgType, setOrgType] = useState<OrgType>("college");

  // Step 2
  const [orgName, setOrgName] = useState("");
  const [orgSlug, setOrgSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [address, setAddress] = useState("");
  const [pincode, setPincode] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");

  // Step 3 — blocks. `blockCount` is what the owner types; `blocks` is the
  // named list. They are kept separate so shrinking the count and growing
  // it again does not lose names already typed.
  const [blockCount, setBlockCount] = useState("");
  const [blocks, setBlocks] = useState<BlockInput[]>([]);

  // Step 4
  const [ownerName, setOwnerName] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [ownerPassword, setOwnerPassword] = useState("");

  const vocab = useMemo(() => vocabularyFor(orgType), [orgType]);

  function applyBlockCount(raw: string) {
    setBlockCount(raw);
    const n = Number(raw);
    if (!Number.isInteger(n) || n < 0) return;
    const capped = Math.min(n, 50);
    setBlocks((prev) => {
      if (capped <= prev.length) return prev.slice(0, capped);
      return [
        ...prev,
        ...Array.from({ length: capped - prev.length }, () => ({ name: "", floors: null })),
      ];
    });
  }

  function updateBlock(index: number, patch: Partial<BlockInput>) {
    setBlocks((prev) => prev.map((b, i) => (i === index ? { ...b, ...patch } : b)));
  }

  /** What the form still needs before this step can be left. Returning a
   * message rather than a boolean means the reason is always shown. */
  function blockingReason(forStep: StepIndex): string | null {
    if (forStep === 1) {
      if (orgName.trim().length < 2) return `Please enter your ${vocab.org.toLowerCase()} name.`;
      if (orgSlug.trim().length < 3) return "The workspace URL needs at least 3 characters.";
      if (!address.trim()) return "Please enter an address.";
      if (!city.trim()) return "Please enter a city.";
      if (!state.trim()) return "Please enter a state.";
    }
    if (forStep === 3) {
      if (!ownerName.trim()) return "Please enter your name.";
      if (!ownerEmail.trim()) return "Please enter your email.";
      if (ownerPassword.length < 8) return "Your password needs at least 8 characters.";
    }
    return null;
  }

  function goNext() {
    const reason = blockingReason(step);
    if (reason) {
      setError(reason);
      return;
    }
    setError(null);
    setStep((s) => Math.min(s + 1, 4) as StepIndex);
  }

  function goBack() {
    setError(null);
    setStep((s) => Math.max(s - 1, 0) as StepIndex);
  }

  async function handleCreate() {
    const reason = blockingReason(3);
    if (reason) {
      setError(reason);
      return;
    }
    setError(null);
    setLoading(true);
    try {
      // Blank rows are dropped rather than sent: someone who typed a count
      // of 5 and named 3 of them meant 3.
      const namedBlocks = blocks
        .map((b) => ({ name: b.name.trim(), floors: b.floors ?? null }))
        .filter((b) => b.name.length > 0);

      const result = await createOrg({
        org_name: orgName.trim(),
        org_slug: orgSlug.trim(),
        org_type: orgType,
        address: address.trim(),
        city: city.trim(),
        state: state.trim(),
        pincode: pincode.trim() || null,
        blocks: namedBlocks,
        owner_name: ownerName.trim(),
        owner_email: ownerEmail.trim(),
        owner_password: ownerPassword,
      });
      setCreated(result);
      setStep(4);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (step === 4 && created) {
    return <SuccessScreen created={created} onContinue={() => router.push("/dashboard")} />;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-ink-50 px-4 py-10">
      <div className="w-full max-w-xl">
        <div className="mb-6 text-center">
          <Logo href="/" size="lg" gradientId="logo-onboarding" className="justify-center" />
        </div>

        <div className="rounded-2xl border border-ink-100 bg-surface p-6 shadow-card sm:p-8">
          <StepRail current={step} />

          {error && (
            <div className="mb-5">
              <Alert tone="error">{error}</Alert>
            </div>
          )}

          {/* ---------------- Step 1: what kind of place is this ------- */}
          {step === 0 && (
            <section>
              <h1 className="text-xl font-bold text-ink-900">What are you setting up?</h1>
              <p className="mt-1.5 text-sm text-ink-600">
                This decides what we ask next, and what everything is called across your workspace.
              </p>

              <div className="mt-6 space-y-2.5">
                {ORG_TYPE_CHOICES.map((choice) => {
                  const selected = orgType === choice.value;
                  return (
                    <button
                      key={choice.value}
                      type="button"
                      onClick={() => setOrgType(choice.value)}
                      aria-pressed={selected}
                      className={`tilt-soft flex w-full items-center gap-4 rounded-xl border p-4 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${
                        selected
                          ? "border-brand-400 bg-brand-50 shadow-card"
                          : "border-ink-100 bg-surface hover:border-ink-200"
                      }`}
                    >
                      <span
                        aria-hidden="true"
                        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                          selected ? "border-brand-500 bg-brand-500" : "border-ink-300"
                        }`}
                      >
                        {selected && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
                      </span>
                      <span>
                        <span className="block text-sm font-semibold text-ink-900">{choice.label}</span>
                        <span className="mt-0.5 block text-xs text-ink-500">{choice.blurb}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          {/* ---------------- Step 2: name and where it is ------------- */}
          {step === 1 && (
            <section className="space-y-5">
              <div>
                <h1 className="text-xl font-bold text-ink-900">About your {vocab.org.toLowerCase()}</h1>
                <p className="mt-1.5 text-sm text-ink-600">
                  Name and address. You can change any of this later.
                </p>
              </div>

              <div>
                <Label htmlFor="orgName">{vocab.orgNameLabel}</Label>
                <Input
                  id="orgName"
                  autoFocus
                  placeholder={vocab.orgNamePlaceholder}
                  value={orgName}
                  onChange={(e) => {
                    setOrgName(e.target.value);
                    if (!slugTouched) setOrgSlug(slugify(e.target.value));
                  }}
                />
              </div>

              <div>
                <Label htmlFor="orgSlug">Workspace URL</Label>
                <div className="flex items-center gap-2">
                  <span className="shrink-0 text-sm text-ink-400">/</span>
                  <Input
                    id="orgSlug"
                    pattern="[a-z0-9-]+"
                    title="Lowercase letters, numbers and hyphens only"
                    value={orgSlug}
                    onChange={(e) => {
                      setSlugTouched(true);
                      setOrgSlug(slugify(e.target.value));
                    }}
                  />
                </div>
                <p className="mt-1 text-xs text-ink-500">
                  Everyone signs in with this — {vocab.reporterPlural.toLowerCase()} and{" "}
                  {vocab.staffPlural.toLowerCase()} both.
                </p>
              </div>

              <div>
                <Label htmlFor="address">Address</Label>
                <Input
                  id="address"
                  placeholder="Street / area"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <Label htmlFor="pincode">Pincode</Label>
                  <Input
                    id="pincode"
                    inputMode="numeric"
                    maxLength={12}
                    placeholder="500032"
                    value={pincode}
                    onChange={(e) => setPincode(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="city">City</Label>
                  <Input id="city" value={city} onChange={(e) => setCity(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="state">State</Label>
                  <Input id="state" value={state} onChange={(e) => setState(e.target.value)} />
                </div>
              </div>
            </section>
          )}

          {/* ---------------- Step 3: the layout ----------------------- */}
          {step === 2 && (
            <section className="space-y-5">
              <div>
                <h1 className="text-xl font-bold text-ink-900">Your {vocab.unitPlural.toLowerCase()}</h1>
                <p className="mt-1.5 text-sm text-ink-600">
                  Naming these now means {vocab.reporterPlural.toLowerCase()} can pick exactly where a
                  problem is from their very first report. You can skip this and add them later.
                </p>
              </div>

              <div>
                <Label htmlFor="blockCount">{vocab.unitCountLabel}</Label>
                <Input
                  id="blockCount"
                  type="number"
                  min={0}
                  max={50}
                  inputMode="numeric"
                  placeholder="e.g. 3"
                  value={blockCount}
                  onChange={(e) => applyBlockCount(e.target.value)}
                  className="max-w-[9rem]"
                />
                <p className="mt-1 text-xs text-ink-500">For example: {vocab.unitExamples}.</p>
              </div>

              {blocks.length > 0 && (
                <div className="space-y-2.5 rounded-xl border border-ink-100 bg-ink-50/60 p-4">
                  {blocks.map((block, i) => (
                    <div key={i} className="flex items-end gap-2">
                      <div className="flex-1">
                        <Label htmlFor={`block-${i}`} className="text-xs">
                          {vocab.unit} {i + 1}
                        </Label>
                        <Input
                          id={`block-${i}`}
                          placeholder={vocab.unitPlaceholder(i)}
                          value={block.name}
                          onChange={(e) => updateBlock(i, { name: e.target.value })}
                        />
                      </div>
                      {vocab.asksFloors && (
                        <div className="w-24">
                          <Label htmlFor={`floors-${i}`} className="text-xs">
                            Floors
                          </Label>
                          <Input
                            id={`floors-${i}`}
                            type="number"
                            min={0}
                            max={100}
                            inputMode="numeric"
                            placeholder="—"
                            value={block.floors ?? ""}
                            onChange={(e) =>
                              updateBlock(i, {
                                floors: e.target.value === "" ? null : Number(e.target.value),
                              })
                            }
                          />
                        </div>
                      )}
                    </div>
                  ))}
                  {vocab.asksFloors && (
                    <p className="pt-1 text-xs text-ink-500">
                      Floors are optional. Filling them in lets a {vocab.reporter.toLowerCase()} say
                      &ldquo;2nd floor&rdquo; instead of describing the spot in words.
                    </p>
                  )}
                </div>
              )}
            </section>
          )}

          {/* ---------------- Step 4: the owner's account -------------- */}
          {step === 3 && (
            <section className="space-y-5">
              <div>
                <h1 className="text-xl font-bold text-ink-900">Your account</h1>
                <p className="mt-1.5 text-sm text-ink-600">
                  You will be the owner of this workspace — the only role that can see the staff code
                  and change settings.
                </p>
              </div>

              <div>
                <Label htmlFor="ownerName">Your name</Label>
                <Input
                  id="ownerName"
                  autoFocus
                  autoComplete="name"
                  value={ownerName}
                  onChange={(e) => setOwnerName(e.target.value)}
                />
              </div>

              <div>
                <Label htmlFor="ownerEmail">Your email</Label>
                <Input
                  id="ownerEmail"
                  type="email"
                  autoComplete="email"
                  value={ownerEmail}
                  onChange={(e) => setOwnerEmail(e.target.value)}
                />
                <p className="mt-1 text-xs text-ink-500">This is what you will sign in with.</p>
              </div>

              <div>
                <Label htmlFor="ownerPassword">Create a password</Label>
                <Input
                  id="ownerPassword"
                  type="password"
                  autoComplete="new-password"
                  minLength={8}
                  value={ownerPassword}
                  onChange={(e) => setOwnerPassword(e.target.value)}
                />
                <p className="mt-1 text-xs text-ink-500">At least 8 characters.</p>
              </div>
            </section>
          )}

          {/* ---------------- Navigation ------------------------------- */}
          <div className="mt-8 flex items-center gap-3">
            {step > 0 && (
              <Button type="button" variant="secondary" onClick={goBack} disabled={loading}>
                Back
              </Button>
            )}
            <div className="flex-1" />
            {step === 2 && (
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setBlocks([]);
                  setBlockCount("");
                  goNext();
                }}
                disabled={loading}
              >
                Skip for now
              </Button>
            )}
            {step < 3 ? (
              <Button type="button" onClick={goNext}>
                Continue
              </Button>
            ) : (
              <Button type="button" onClick={handleCreate} loading={loading}>
                Create {vocab.org.toLowerCase()}
              </Button>
            )}
          </div>
        </div>

        <p className="mt-4 text-center text-sm text-ink-600">
          Already have a workspace?{" "}
          <Link href="/login" className="font-medium text-brand-600 hover:underline">
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------
   Success screen. Its whole job is to make sure the owner leaves with
   the two things they cannot recover from memory: the workspace URL
   their people sign up with, and the staff code.
   ------------------------------------------------------------------ */

function CopyField({ label, value, hint }: { label: string; value: string; hint?: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access is refused outside a secure context and in some
      // embedded browsers. Selecting the text is the honest fallback —
      // far better than a button that silently does nothing.
      const node = document.getElementById(`copy-${label}`);
      if (node) {
        const range = document.createRange();
        range.selectNodeContents(node);
        const selection = window.getSelection();
        selection?.removeAllRanges();
        selection?.addRange(range);
      }
    }
  }

  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-[0.1em] text-ink-500">{label}</p>
      <div className="mt-1.5 flex items-center gap-2">
        <code
          id={`copy-${label}`}
          className="flex-1 overflow-x-auto whitespace-nowrap rounded-lg border border-ink-100 bg-ink-50 px-3 py-2.5 text-sm text-ink-800"
        >
          {value}
        </code>
        <Button type="button" variant="secondary" size="sm" onClick={copy} className="shrink-0">
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
      {hint && <p className="mt-1.5 text-xs text-ink-500">{hint}</p>}
    </div>
  );
}

function SuccessScreen({
  created,
  onContinue,
}: {
  created: OrgCreateResponse;
  onContinue: () => void;
}) {
  const vocab = vocabularyFor(created.org_type);

  // Built from the browser's own origin rather than a hard-coded domain,
  // so the URL is correct on a preview deployment, a custom domain and
  // localhost alike — and can never quietly point somewhere the owner's
  // people cannot reach.
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  const joinUrl = `${origin}/signup?org=${created.org_slug}`;

  return (
    <div className="flex min-h-screen items-center justify-center bg-ink-50 px-4 py-10">
      <div className="w-full max-w-xl">
        <div className="mb-6 text-center">
          <Logo href="/" size="lg" gradientId="logo-onboarding-done" className="justify-center" />
        </div>

        <div className="rounded-2xl border border-ink-100 bg-surface p-6 shadow-card sm:p-8">
          <div className="text-center">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600">
              <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="m5 13 4 4L19 7" />
              </svg>
            </span>
            <h1 className="mt-4 text-xl font-bold text-ink-900">
              {created.org_name} is ready
            </h1>
            <p className="mt-1.5 text-sm text-ink-600">
              Your workspace is live
              {created.blocks_created > 0 && (
                <>
                  {" "}
                  with {created.blocks_created}{" "}
                  {created.blocks_created === 1
                    ? vocab.unit.toLowerCase()
                    : vocab.unitPlural.toLowerCase()}
                </>
              )}
              .
            </p>
          </div>

          <div className="mt-7 space-y-5">
            <CopyField
              label="Join link"
              value={joinUrl}
              hint={`Share this one link with your ${vocab.reporterPlural.toLowerCase()} and your ${vocab.staffPlural.toLowerCase()} — everyone signs up through it.`}
            />

            {created.staff_code && (
              <CopyField
                label="Staff code"
                value={created.staff_code}
                hint={`Only give this to ${vocab.staffPlural.toLowerCase()}. It is what separates a ${vocab.staff.toLowerCase()} from a ${vocab.reporter.toLowerCase()} at signup — never share it publicly.`}
              />
            )}
          </div>

          <div className="mt-6 rounded-xl border border-ink-100 bg-ink-50/70 px-4 py-3">
            <p className="text-xs text-ink-600">
              Both are on your <span className="font-medium text-ink-800">Profile</span> page
              whenever you need them again, so there is nothing to write down.
            </p>
          </div>

          <Button type="button" size="lg" className="mt-7 w-full" onClick={onContinue}>
            Go to my dashboard
          </Button>
        </div>
      </div>
    </div>
  );
}
