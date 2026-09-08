"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Alert } from "@/components/ui/alert";
import { PriorityBadge } from "@/components/problems/priority-badge";
import { ApiError, orgsApi, problemsApi } from "@/lib/api";
import { LOCATION_TYPE_LABELS } from "@/lib/constants";
import type { LocationResponse, ProblemResponse } from "@/lib/types";

export default function NewReportPage() {
  const router = useRouter();
  const [locations, setLocations] = useState<LocationResponse[] | null>(null);
  const [locationId, setLocationId] = useState("");
  const [description, setDescription] = useState("");
  const [landmark, setLandmark] = useState("");
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState<ProblemResponse | null>(null);

  useEffect(() => {
    orgsApi
      .listLocations()
      .then((locs) => {
        setLocations(locs);
        if (locs.length > 0) setLocationId(locs[0].id);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "Could not load locations."));
  }, []);

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) {
      setPhotoPreview(null);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setPhotoPreview(reader.result as string);
    reader.readAsDataURL(file);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const problem = await problemsApi.create({
        description,
        location_id: locationId,
        landmark: landmark || null,
        // Photo storage (S3/R2) lands in the next milestone — the AI
        // pipeline below runs fully without it, so reports aren't blocked
        // on that wiring.
        attachment_urls: [],
      });
      setSubmitted(problem);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not submit your report. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  function resetForm() {
    setSubmitted(null);
    setDescription("");
    setLandmark("");
    setPhotoPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  if (submitted) {
    return (
      <div className="mx-auto max-w-lg">
        <Card>
          <CardBody className="space-y-4 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
              <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-ink-900">Report received</h2>
              <p className="mt-1 text-sm text-ink-600">"{submitted.title}"</p>
            </div>
            <div className="flex items-center justify-center gap-2">
              <PriorityBadge score={submitted.priority_score} />
            </div>
            <p className="text-sm text-ink-500">
              Our AI checked this against existing reports for duplicates and routed it to the right
              team. You'll be notified as it's worked on.
            </p>
            <div className="flex justify-center gap-3 pt-2">
              <Button variant="secondary" onClick={resetForm}>
                Report another
              </Button>
              <Button onClick={() => router.push(`/problems/${submitted.id}`)}>View report</Button>
            </div>
          </CardBody>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-ink-900">Report a problem</h1>
        <p className="mt-1 text-sm text-ink-600">A photo, a short description, and where it is — that's it.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>New report</CardTitle>
        </CardHeader>
        <CardBody>
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && <Alert tone="error">{error}</Alert>}

            <div>
              <Label htmlFor="photo">Photo (optional)</Label>
              <input
                ref={fileInputRef}
                id="photo"
                type="file"
                accept="image/*"
                onChange={handlePhotoChange}
                className="block w-full text-sm text-ink-600 file:mr-3 file:rounded-lg file:border-0 file:bg-brand-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-brand-700 hover:file:bg-brand-100"
              />
              {photoPreview && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={photoPreview} alt="Preview" className="mt-3 max-h-48 rounded-xl border border-ink-100 object-cover" />
              )}
            </div>

            <div>
              <Label htmlFor="description">What's wrong?</Label>
              <Textarea
                id="description"
                required
                minLength={5}
                maxLength={3000}
                rows={4}
                placeholder="e.g. There's a broken tile that's a tripping hazard."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="location">Location</Label>
              <Select id="location" required value={locationId} onChange={(e) => setLocationId(e.target.value)}>
                {locations === null && <option>Loading…</option>}
                {locations?.length === 0 && <option value="">No locations set up yet</option>}
                {locations?.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.path} ({LOCATION_TYPE_LABELS[loc.type]})
                  </option>
                ))}
              </Select>
            </div>

            <div>
              <Label htmlFor="landmark">Exact spot (optional, but helps a lot)</Label>
              <Textarea
                id="landmark"
                rows={2}
                maxLength={300}
                placeholder='e.g. "before Room 303" or "beside Room 303, near the water cooler"'
                value={landmark}
                onChange={(e) => setLandmark(e.target.value)}
              />
              <p className="mt-1 text-xs text-ink-500">
                For corridors and common areas — our AI matches this against other reports, so
                differently-worded descriptions of the same spot still get grouped together.
              </p>
            </div>

            <Button
              type="submit"
              size="lg"
              className="w-full"
              loading={submitting}
              disabled={locations?.length === 0}
            >
              Submit report
            </Button>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}
