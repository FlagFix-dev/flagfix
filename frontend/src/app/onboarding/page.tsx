"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Alert } from "@/components/ui/alert";
import { useAuth } from "@/components/auth/auth-provider";
import { ApiError } from "@/lib/api";
import { NUM_BLOCKS_HINT, NUM_BLOCKS_LABEL, ORG_TYPE_LABELS } from "@/lib/constants";
import type { OrgType } from "@/lib/types";

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

export default function OnboardingPage() {
  const { createOrg } = useAuth();
  const router = useRouter();

  const [orgName, setOrgName] = useState("");
  const [orgSlug, setOrgSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [orgType, setOrgType] = useState<OrgType>("college");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [numBlocks, setNumBlocks] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [ownerPassword, setOwnerPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function handleOrgNameChange(value: string) {
    setOrgName(value);
    if (!slugTouched) setOrgSlug(slugify(value));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await createOrg({
        org_name: orgName,
        org_slug: orgSlug,
        org_type: orgType,
        address,
        city,
        state,
        num_blocks: numBlocks ? Number(numBlocks) : null,
        owner_name: ownerName,
        owner_email: ownerEmail,
        owner_password: ownerPassword,
      });
      router.push("/locations?welcome=1");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-ink-50 px-4 py-10">
      <div className="w-full max-w-lg">
        <div className="mb-6 text-center">
          <Link href="/" className="text-lg font-semibold text-ink-900">
            FlagFix
          </Link>
          <h1 className="mt-2 text-2xl font-bold text-ink-900">Set up your institution</h1>
          <p className="mt-1 text-sm text-ink-600">
            This creates your organization's workspace and your owner account in one step.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 rounded-2xl border border-ink-100 bg-white p-6 shadow-card">
          {error && <Alert tone="error">{error}</Alert>}

          <div>
            <Label htmlFor="orgName">Institution name</Label>
            <Input
              id="orgName"
              required
              placeholder="Green Valley College"
              value={orgName}
              onChange={(e) => handleOrgNameChange(e.target.value)}
            />
          </div>

          <div>
            <Label htmlFor="orgSlug">Workspace URL</Label>
            <div className="flex items-center gap-2">
              <span className="text-sm text-ink-400">flagfix.app/</span>
              <Input
                id="orgSlug"
                required
                pattern="[a-z0-9-]+"
                title="Lowercase letters, numbers, and hyphens only"
                value={orgSlug}
                onChange={(e) => {
                  setSlugTouched(true);
                  setOrgSlug(slugify(e.target.value));
                }}
              />
            </div>
            <p className="mt-1 text-xs text-ink-500">
              Everyone at your institution will use this to log in — reporters and staff both.
            </p>
          </div>

          <div>
            <Label htmlFor="orgType">Institution type</Label>
            <Select id="orgType" value={orgType} onChange={(e) => setOrgType(e.target.value as OrgType)}>
              {Object.entries(ORG_TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </div>

          <div>
            <Label htmlFor="address">Address</Label>
            <Input
              id="address"
              required
              placeholder="Street / area"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="city">City</Label>
              <Input id="city" required value={city} onChange={(e) => setCity(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="state">State</Label>
              <Input id="state" required value={state} onChange={(e) => setState(e.target.value)} />
            </div>
          </div>

          <div>
            <Label htmlFor="numBlocks">{NUM_BLOCKS_LABEL[orgType]} (optional)</Label>
            <Input
              id="numBlocks"
              type="number"
              min={0}
              max={500}
              placeholder="e.g. 5"
              value={numBlocks}
              onChange={(e) => setNumBlocks(e.target.value)}
            />
            <p className="mt-1 text-xs text-ink-500">
              Just for your own reference — {NUM_BLOCKS_HINT[orgType]}. You'll name each one on
              the Locations page after this.
            </p>
          </div>

          <hr className="border-ink-100" />

          <div>
            <Label htmlFor="ownerName">Your name</Label>
            <Input id="ownerName" required value={ownerName} onChange={(e) => setOwnerName(e.target.value)} />
          </div>

          <div>
            <Label htmlFor="ownerEmail">Your email</Label>
            <Input
              id="ownerEmail"
              type="email"
              required
              value={ownerEmail}
              onChange={(e) => setOwnerEmail(e.target.value)}
            />
          </div>

          <div>
            <Label htmlFor="ownerPassword">Password</Label>
            <Input
              id="ownerPassword"
              type="password"
              required
              minLength={8}
              value={ownerPassword}
              onChange={(e) => setOwnerPassword(e.target.value)}
            />
            <p className="mt-1 text-xs text-ink-500">At least 8 characters.</p>
          </div>

          <Button type="submit" size="lg" className="w-full" loading={loading}>
            Create workspace
          </Button>
        </form>

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
