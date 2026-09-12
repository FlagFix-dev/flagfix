"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Alert } from "@/components/ui/alert";
import { FullPageSpinner } from "@/components/ui/spinner";
import { useAuth } from "@/components/auth/auth-provider";
import { ApiError, orgsApi } from "@/lib/api";
import { ADMIN_ROLES, LOCATION_TYPE_LABELS, STAFF_ROLES } from "@/lib/constants";
import type { LocationResponse, LocationType, OrgProfileResponse } from "@/lib/types";

export default function LocationsPage() {
  const { claims } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const isWelcome = searchParams.get("welcome") === "1";

  const [locations, setLocations] = useState<LocationResponse[] | null>(null);
  const [name, setName] = useState("");
  const [type, setType] = useState<LocationType>("building");
  const [parentId, setParentId] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [orgProfile, setOrgProfile] = useState<OrgProfileResponse | null>(null);
  const [regenerating, setRegenerating] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);

  const isStaff = claims ? STAFF_ROLES.includes(claims.role) : false;
  const isAdmin = claims ? ADMIN_ROLES.includes(claims.role) : false;
  const isOwner = claims?.role === "owner";

  useEffect(() => {
    if (claims && !isStaff) router.replace("/dashboard");
  }, [claims, isStaff, router]);

  useEffect(() => {
    orgsApi
      .listLocations()
      .then(setLocations)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Could not load locations."));
  }, []);

  useEffect(() => {
    if (!isAdmin) return;
    orgsApi.getProfile().then(setOrgProfile).catch(() => undefined);
  }, [isAdmin]);

  async function handleRegenerateCode() {
    setRegenerating(true);
    try {
      const updated = await orgsApi.regenerateStaffCode();
      setOrgProfile(updated);
    } catch {
      // Non-critical action — the existing code just stays visible/usable.
    } finally {
      setRegenerating(false);
    }
  }

  function copyCode() {
    if (!orgProfile?.staff_code) return;
    navigator.clipboard?.writeText(orgProfile.staff_code).then(() => {
      setCodeCopied(true);
      setTimeout(() => setCodeCopied(false), 1500);
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const created = await orgsApi.createLocation({
        name,
        type,
        parent_location_id: parentId || null,
      });
      setLocations((prev) => (prev ? [...prev, created].sort((a, b) => a.path.localeCompare(b.path)) : [created]));
      setName("");
      setParentId("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create that location.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!isStaff) return <FullPageSpinner />;

  return (
    <div className="space-y-6">
      {isWelcome && (
        <Alert tone="success">
          Your workspace is ready. Add the buildings, floors, or rooms people will pick from when they
          report a problem — you can always add more later.
        </Alert>
      )}

      <div>
        <h1 className="text-xl font-bold text-ink-900">Locations</h1>
        <p className="mt-1 text-sm text-ink-600">
          These are the places reporters can choose from — buildings, floors, rooms, or common
          areas like corridors and lobbies.
        </p>
      </div>

      {isAdmin && orgProfile?.staff_code && (
        <Card elevated className="bg-brand-gradient text-white">
          <CardBody className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-white/70">
                Institute staff code
              </p>
              <p className="mt-1 font-mono text-2xl font-bold tracking-widest">{orgProfile.staff_code}</p>
              <p className="mt-1 max-w-md text-sm text-white/80">
                Share this with your staff — they'll enter it when they sign up and choose "Staff",
                so students can't grant themselves staff access.
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" onClick={copyCode}>
                {codeCopied ? "Copied!" : "Copy code"}
              </Button>
              {isOwner && (
                <Button variant="secondary" size="sm" loading={regenerating} onClick={handleRegenerateCode}>
                  Regenerate
                </Button>
              )}
            </div>
          </CardBody>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>All locations</CardTitle>
          </CardHeader>
          <CardBody>
            {locations === null ? (
              <p className="text-sm text-ink-500">Loading…</p>
            ) : locations.length === 0 ? (
              <p className="text-sm text-ink-500">No locations yet — add your first one.</p>
            ) : (
              <ul className="divide-y divide-ink-100">
                {locations.map((loc) => (
                  <li key={loc.id} className="flex items-center justify-between py-2.5 text-sm">
                    <span className="text-ink-800">{loc.path}</span>
                    <span className="rounded-full bg-ink-100 px-2 py-0.5 text-xs text-ink-600">
                      {LOCATION_TYPE_LABELS[loc.type]}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Add a location</CardTitle>
          </CardHeader>
          <CardBody>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && <Alert tone="error">{error}</Alert>}
              <div>
                <Label htmlFor="locName">Name</Label>
                <Input
                  id="locName"
                  required
                  placeholder="e.g. Hostel Block C, Room 303, 2nd Floor Corridor"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="locType">Type</Label>
                <Select id="locType" value={type} onChange={(e) => setType(e.target.value as LocationType)}>
                  {Object.entries(LOCATION_TYPE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label htmlFor="locParent">Parent location (optional)</Label>
                <Select id="locParent" value={parentId} onChange={(e) => setParentId(e.target.value)}>
                  <option value="">None — this is top-level</option>
                  {locations?.map((loc) => (
                    <option key={loc.id} value={loc.id}>
                      {loc.path}
                    </option>
                  ))}
                </Select>
                <p className="mt-1 text-xs text-ink-500">
                  e.g. make "Room 303" a child of "Hostel Block C" so its full path is unambiguous.
                </p>
              </div>
              <Button type="submit" className="w-full" loading={submitting}>
                Add location
              </Button>
            </form>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
