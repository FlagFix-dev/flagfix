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

// Mirrors backend/app/services/storage.py's MAX_FILES_PER_REPORT and type
// allow-list — checked client-side too so a reporter finds out immediately
// instead of after an upload round-trip.
const MAX_FILES = 5;
const ACCEPTED_TYPES = "image/jpeg,image/png,image/webp,image/heic,image/heif,video/mp4,video/webm,video/quicktime";

interface PendingFile {
  file: File;
  previewUrl: string | null; // object URL for images; null for video (shown as a name chip instead)
  isVideo: boolean;
}

export default function NewReportPage() {
  const router = useRouter();
  const [locations, setLocations] = useState<LocationResponse[] | null>(null);
  const [locationId, setLocationId] = useState("");
  const [description, setDescription] = useState("");
  const [landmark, setLandmark] = useState("");
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [uploadStage, setUploadStage] = useState<string | null>(null);
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

  // Object URLs must be released or they leak memory for the life of the
  // page — clean up whenever the list changes or the component unmounts.
  useEffect(() => {
    return () => {
      pendingFiles.forEach((p) => p.previewUrl && URL.revokeObjectURL(p.previewUrl));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleFilesChange(e: React.ChangeEvent<HTMLInputElement>) {
    const incoming = Array.from(e.target.files ?? []);
    if (incoming.length === 0) return;

    const room = MAX_FILES - pendingFiles.length;
    if (room <= 0) {
      setError(`You can attach up to ${MAX_FILES} photos/videos per report.`);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    const accepted = incoming.slice(0, room);
    if (incoming.length > room) {
      setError(`Only added ${accepted.length} of ${incoming.length} files — the limit is ${MAX_FILES} per report.`);
    } else {
      setError(null);
    }

    const next: PendingFile[] = accepted.map((file) => ({
      file,
      isVideo: file.type.startsWith("video/"),
      previewUrl: file.type.startsWith("image/") ? URL.createObjectURL(file) : null,
    }));
    setPendingFiles((prev) => [...prev, ...next]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function removeFile(index: number) {
    setPendingFiles((prev) => {
      const target = prev[index];
      if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((_, i) => i !== index);
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      let attachments: { url: string; content_type: string }[] = [];
      if (pendingFiles.length > 0) {
        setUploadStage(
          pendingFiles.length === 1 ? "Uploading your photo/video…" : `Uploading ${pendingFiles.length} files…`
        );
        try {
          const uploaded = await problemsApi.uploadAttachments(pendingFiles.map((p) => p.file));
          attachments = uploaded.map((a) => ({ url: a.url, content_type: a.content_type }));
        } catch (uploadErr) {
          // Media upload failing shouldn't block the report itself — tell
          // the reporter clearly, then keep going without attachments
          // rather than losing their whole report.
          setError(
            uploadErr instanceof ApiError
              ? `Couldn't attach your files (${uploadErr.message}). Submitting the report without them.`
              : "Couldn't attach your files. Submitting the report without them."
          );
        }
        setUploadStage(null);
      }

      const problem = await problemsApi.create({
        description,
        location_id: locationId,
        landmark: landmark || null,
        attachments,
      });
      setSubmitted(problem);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not submit your report. Please try again.");
    } finally {
      setSubmitting(false);
      setUploadStage(null);
    }
  }

  function resetForm() {
    setSubmitted(null);
    setDescription("");
    setLandmark("");
    pendingFiles.forEach((p) => p.previewUrl && URL.revokeObjectURL(p.previewUrl));
    setPendingFiles([]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  if (submitted) {
    return (
      <div className="mx-auto max-w-lg">
        <Card elevated>
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
        <p className="mt-1 text-sm text-ink-600">
          Photos or a short video, a clear description, and exactly where it is — the more precise
          you are, the faster it gets fixed.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>New report</CardTitle>
        </CardHeader>
        <CardBody>
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && <Alert tone="error">{error}</Alert>}

            <div>
              <Label htmlFor="photo">Photos or videos (optional, up to {MAX_FILES})</Label>
              <label
                htmlFor="photo"
                className="flex cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-ink-200 bg-ink-50/50 px-4 py-6 text-center transition-colors hover:border-brand-400 hover:bg-brand-50/50"
              >
                <svg className="h-6 w-6 text-ink-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M12 12v9m0-9l-3 3m3-3l3 3"
                  />
                </svg>
                <span className="text-sm font-medium text-brand-700">Tap to add photos or a video</span>
                <span className="text-xs text-ink-500">JPG, PNG, or short MP4/MOV clips</span>
              </label>
              <input
                ref={fileInputRef}
                id="photo"
                type="file"
                accept={ACCEPTED_TYPES}
                multiple
                onChange={handleFilesChange}
                className="hidden"
              />

              {pendingFiles.length > 0 && (
                <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {pendingFiles.map((p, i) => (
                    <div key={i} className="group relative aspect-square overflow-hidden rounded-xl border border-ink-100 bg-ink-50">
                      {p.previewUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={p.previewUrl} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full flex-col items-center justify-center gap-1 p-1 text-center">
                          <svg className="h-5 w-5 text-ink-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.55-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.45.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                          <span className="line-clamp-1 text-[10px] text-ink-500">{p.file.name}</span>
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => removeFile(i)}
                        aria-label="Remove file"
                        className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition-opacity group-hover:opacity-100"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-xl border-2 border-brand-100 bg-brand-50/40 p-4">
              <Label htmlFor="description" className="text-ink-900">
                What's wrong? <span className="text-red-500">*</span>
              </Label>
              <Textarea
                id="description"
                required
                minLength={5}
                maxLength={3000}
                rows={4}
                placeholder="Be specific: what's broken, how bad is it, and since when? e.g. 'The ceiling fan in Room 204 is making a loud grinding noise and sometimes stops — started yesterday evening.'"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="bg-white"
              />
              <p className="mt-1 text-xs text-ink-500">
                A clear, specific description helps our AI route this to the right team faster.
              </p>
            </div>

            <div className="rounded-xl border-2 border-brand-100 bg-brand-50/40 p-4">
              <Label htmlFor="location" className="text-ink-900">
                Location <span className="text-red-500">*</span>
              </Label>
              <Select
                id="location"
                required
                value={locationId}
                onChange={(e) => setLocationId(e.target.value)}
                className="bg-white"
              >
                {locations === null && <option>Loading…</option>}
                {locations?.length === 0 && <option value="">No locations set up yet</option>}
                {locations?.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.path} ({LOCATION_TYPE_LABELS[loc.type]})
                  </option>
                ))}
              </Select>

              <div className="mt-3">
                <Label htmlFor="landmark" className="text-ink-900">
                  Exact spot
                </Label>
                <Textarea
                  id="landmark"
                  rows={2}
                  maxLength={300}
                  placeholder='e.g. "before Room 303" or "beside Room 303, near the water cooler"'
                  value={landmark}
                  onChange={(e) => setLandmark(e.target.value)}
                  className="bg-white"
                />
                <p className="mt-1 text-xs text-ink-500">
                  Double-check this is the right building and floor — precise location is the #1
                  thing that speeds up a fix. Our AI also matches this against other reports, so
                  differently-worded descriptions of the same spot still get grouped together.
                </p>
              </div>
            </div>

            <Button
              type="submit"
              size="lg"
              className="w-full"
              loading={submitting}
              disabled={locations?.length === 0}
            >
              {uploadStage ?? "Submit report"}
            </Button>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}
