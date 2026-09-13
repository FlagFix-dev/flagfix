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

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();

  const [orgSlug, setOrgSlug] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login({ org_slug: orgSlug, email, password });
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
          <h1 className="mt-2 text-2xl font-bold text-ink-900">Log in</h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl border border-ink-100 bg-surface p-6 shadow-card">
          {error && <Alert tone="error">{error}</Alert>}

          <div>
            <Label htmlFor="orgSlug">Workspace URL</Label>
            <div className="flex items-center gap-2">
              <span className="text-sm text-ink-400">flagfix.app/</span>
              <Input id="orgSlug" required value={orgSlug} onChange={(e) => setOrgSlug(e.target.value)} />
            </div>
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
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <Button type="submit" size="lg" className="w-full" loading={loading}>
            Log in
          </Button>
        </form>

        <p className="mt-4 text-center text-sm text-ink-600">
          New here?{" "}
          <Link href="/signup" className="font-medium text-brand-600 hover:underline">
            Sign up
          </Link>{" "}
          or{" "}
          <Link href="/onboarding" className="font-medium text-brand-600 hover:underline">
            set up your institution
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
