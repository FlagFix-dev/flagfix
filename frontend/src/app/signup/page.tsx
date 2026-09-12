"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert } from "@/components/ui/alert";
import { useAuth } from "@/components/auth/auth-provider";
import { ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { SelfSignupRole } from "@/lib/types";

const ROLE_OPTIONS: { value: SelfSignupRole; label: string; hint: string }[] = [
  { value: "reporter", label: "Student", hint: "Report problems, track your own reports" },
  { value: "resolver", label: "Staff", hint: "View and resolve reports for the whole institution" },
];

export default function SignupPage() {
  const { signup } = useAuth();
  const router = useRouter();

  const [orgSlug, setOrgSlug] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<SelfSignupRole>("reporter");
  const [staffCode, setStaffCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await signup({
        org_slug: orgSlug,
        name,
        email,
        password,
        role,
        staff_code: role === "resolver" ? staffCode : null,
      });
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-ink-50 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <Link href="/" className="text-lg font-semibold text-ink-900">
            FlagFix
          </Link>
          <h1 className="mt-2 text-2xl font-bold text-ink-900">Create your account</h1>
          <p className="mt-1 text-sm text-ink-600">
            Ask your institution for their workspace URL if you don't have it.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl border border-ink-100 bg-white p-6 shadow-card">
          {error && <Alert tone="error">{error}</Alert>}

          <div>
            <Label htmlFor="orgSlug">Workspace URL</Label>
            <div className="flex items-center gap-2">
              <span className="text-sm text-ink-400">flagfix.app/</span>
              <Input id="orgSlug" required value={orgSlug} onChange={(e) => setOrgSlug(e.target.value)} />
            </div>
          </div>

          <div>
            <Label htmlFor="name">Full name</Label>
            <Input id="name" required value={name} onChange={(e) => setName(e.target.value)} />
          </div>

          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>

          <div>
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <p className="mt-1 text-xs text-ink-500">At least 8 characters.</p>
          </div>

          <div>
            <Label>I am a...</Label>
            <div className="grid grid-cols-2 gap-2">
              {ROLE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setRole(opt.value)}
                  className={cn(
                    "rounded-xl border px-3 py-2.5 text-left transition-colors",
                    role === opt.value
                      ? "border-brand-500 bg-brand-50 ring-1 ring-brand-500"
                      : "border-ink-200 bg-white hover:bg-ink-50"
                  )}
                >
                  <span
                    className={cn(
                      "block text-sm font-medium",
                      role === opt.value ? "text-brand-700" : "text-ink-800"
                    )}
                  >
                    {opt.label}
                  </span>
                  <span className="mt-0.5 block text-xs text-ink-500">{opt.hint}</span>
                </button>
              ))}
            </div>
          </div>

          {role === "resolver" && (
            <div>
              <Label htmlFor="staffCode">Institute staff code</Label>
              <Input
                id="staffCode"
                required
                placeholder="e.g. A1B2C3D4"
                value={staffCode}
                onChange={(e) => setStaffCode(e.target.value)}
              />
              <p className="mt-1 text-xs text-ink-500">
                Ask your admin or owner for this — it's on their org settings page. Students don't
                need one.
              </p>
            </div>
          )}

          <Button type="submit" size="lg" className="w-full" loading={loading}>
            Create account
          </Button>
        </form>

        <p className="mt-4 text-center text-sm text-ink-600">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-brand-600 hover:underline">
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
}
