"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert } from "@/components/ui/alert";
import { FullPageSpinner } from "@/components/ui/spinner";
import { useAuth } from "@/components/auth/auth-provider";
import { ApiError, authApi, orgsApi } from "@/lib/api";
import { ADMIN_ROLES, ORG_TYPE_LABELS, ROLE_LABELS } from "@/lib/constants";
import { formatDateTime } from "@/lib/utils";
import type { OrgProfileResponse, UserProfile } from "@/lib/types";

export default function ProfilePage() {
  const { claims } = useAuth();
  const searchParams = useSearchParams();
  const isAdmin = claims ? ADMIN_ROLES.includes(claims.role) : false;
  const isOwner = claims?.role === "owner";

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [org, setOrg] = useState<OrgProfileResponse | null>(null);
  const [regenerating, setRegenerating] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);

  useEffect(() => {
    authApi
      .getProfile()
      .then((p) => {
        setProfile(p);
        setName(p.name);
        setPhone(p.phone ?? "");
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "Could not load your profile."));
  }, []);

  useEffect(() => {
    if (!isAdmin) return;
    orgsApi.getProfile().then(setOrg).catch(() => undefined);
  }, [isAdmin]);

  // The account menu links here with ?tab=staff-code; scroll that section
  // into view so the click lands where the person expected it to.
  useEffect(() => {
    if (searchParams.get("tab") !== "staff-code" || !org) return;
    document.getElementById("staff-code")?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [searchParams, org]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    setSaving(true);
    try {
      const updated = await authApi.updateProfile({ name, phone: phone.trim() || null });
      setProfile(updated);
      setSaved(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save your profile.");
    } finally {
      setSaving(false);
    }
  }

  async function handleRegenerate() {
    setRegenerating(true);
    try {
      setOrg(await orgsApi.regenerateStaffCode());
    } catch {
      // Non-critical: the existing code stays valid and on screen.
    } finally {
      setRegenerating(false);
    }
  }

  function copyCode() {
    if (!org?.staff_code) return;
    navigator.clipboard?.writeText(org.staff_code).then(() => {
      setCodeCopied(true);
      setTimeout(() => setCodeCopied(false), 1500);
    });
  }

  if (!profile) return <FullPageSpinner />;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-xl font-bold text-ink-900">My profile</h1>
        <p className="mt-1 text-sm text-ink-600">
          Your details at {profile.org_name}
          {org ? ` · ${ORG_TYPE_LABELS[org.type]}` : ""}.
        </p>
      </div>

      {error && <Alert tone="error">{error}</Alert>}
      {saved && <Alert tone="success">Profile saved.</Alert>}

      <Card>
        <CardHeader>
          <CardTitle>Your details</CardTitle>
        </CardHeader>
        <CardBody>
          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <Label htmlFor="name">Full name</Label>
              <Input id="name" required maxLength={150} value={name} onChange={(e) => setName(e.target.value)} />
            </div>

            <div>
              <Label htmlFor="phone">Phone number</Label>
              <Input
                id="phone"
                type="tel"
                maxLength={20}
                placeholder="e.g. +91 98765 43210"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
              <p className="mt-1 text-xs text-ink-500">
                Optional — helps staff reach you quickly about a report.
              </p>
            </div>

            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" value={profile.email ?? ""} disabled readOnly />
              <p className="mt-1 text-xs text-ink-500">
                Your email is how you log in, so it can't be changed here yet — that needs an email
                verification step we haven't built. Ask your admin if it's wrong.
              </p>
            </div>

            <Button type="submit" loading={saving}>
              Save changes
            </Button>
          </form>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Account</CardTitle>
        </CardHeader>
        <CardBody>
          <dl className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <dt className="text-ink-500">Role</dt>
              <dd className="mt-0.5 font-medium text-ink-900">{ROLE_LABELS[profile.role]}</dd>
            </div>
            <div>
              <dt className="text-ink-500">Institution</dt>
              <dd className="mt-0.5 font-medium text-ink-900">{profile.org_name}</dd>
            </div>
            <div>
              <dt className="text-ink-500">Workspace URL</dt>
              <dd className="mt-0.5 font-mono text-ink-900">{profile.org_slug}</dd>
            </div>
            <div>
              <dt className="text-ink-500">Member since</dt>
              <dd className="mt-0.5 text-ink-900">{formatDateTime(profile.created_at)}</dd>
            </div>
          </dl>
        </CardBody>
      </Card>

      {isAdmin && org?.staff_code && (
        <Card id="staff-code" elevated className="bg-brand-gradient text-white">
          <CardBody className="space-y-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-white/70">
                Institute staff code
              </p>
              <p className="mt-1 font-mono text-3xl font-bold tracking-widest">{org.staff_code}</p>
            </div>
            <p className="max-w-lg text-sm text-white/80">
              Give this only to your staff. When they sign up and choose "Staff", they must enter it
              — which is what stops a student from granting themselves access to the full reports
              queue. Students never need it.
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
              <Button variant="secondary" size="sm" onClick={copyCode}>
                {codeCopied ? "Copied!" : "Copy code"}
              </Button>
              {isOwner && (
                <Button variant="secondary" size="sm" loading={regenerating} onClick={handleRegenerate}>
                  Generate a new code
                </Button>
              )}
            </div>
            {isOwner && (
              <p className="text-xs text-white/70">
                Generating a new code immediately stops the old one working — use it if the code has
                been shared too widely.
              </p>
            )}
          </CardBody>
        </Card>
      )}
    </div>
  );
}
