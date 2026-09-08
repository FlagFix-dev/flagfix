# FlagFix — Frontend

Next.js 15 (App Router) + TypeScript + Tailwind CSS. Talks to the FastAPI
backend in `../backend` over plain JSON — no server actions or API routes
of its own, so it can be deployed independently (e.g. to Vercel) while the
backend runs elsewhere (e.g. Railway).

## Local setup

```bash
cd frontend
npm install

cp .env.local.example .env.local
# edit .env.local if your backend isn't running at http://localhost:8000

npm run dev
```

Visit `http://localhost:3000`. Make sure the backend (`../backend`) is
running first — the app has nothing to talk to otherwise.

## First-time flow

1. **`/onboarding`** — an institution creates its workspace (org) and its
   first account, which becomes `owner`.
2. **`/locations`** — the owner/admin adds the buildings, floors, rooms,
   and common areas people will pick from when reporting.
3. Everyone else joins via **`/signup`** using the same workspace URL, and
   lands as a `reporter`. Elevating someone to `resolver`/`admin` is a
   Phase 2 role-management screen — for now that's done directly in the
   database.

## Project layout

```
src/
  app/
    page.tsx              Landing page
    onboarding/            Create org + owner account
    login/, signup/        Auth
    (app)/                 Everything behind the auth gate (see layout.tsx)
      layout.tsx            Redirects to /login if not signed in; renders <Navbar>
      dashboard/            Role-aware: reporters see their own reports,
                             staff see the whole prioritized queue
      report/new/           The report-a-problem form
      problems/[id]/        Detail view + status actions + resolution feedback
      locations/            Owner/admin: manage the location tree
  components/
    ui/                    Design-system primitives (Button, Input, Card, …)
    auth/                  AuthProvider — session state, login/signup/logout
    layout/                Navbar
    problems/              Domain components (PriorityBadge, StatusBadge, ProblemList)
  lib/
    api.ts                 Typed fetch client — auth headers, 401 refresh-and-retry
    types.ts               Mirrors the backend's Pydantic schemas exactly
    constants.ts           Status/priority labels — mirrors backend enums + workflow.py
    session.ts             localStorage-backed token storage
    utils.ts               cn(), JWT decode, date formatting
```

## Notes

- No component reaches the backend directly with `fetch` — everything goes
  through `lib/api.ts`, so auth headers and token refresh are handled in
  exactly one place.
- The status-change buttons on a report's detail page only ever offer a
  transition the backend will actually accept (`lib/constants.ts`'s
  `ALLOWED_TRANSITIONS` mirrors `backend/app/services/workflow.py` exactly)
  — no client-side dead ends.
- Photo attachment currently captures and previews an image client-side;
  it isn't yet persisted to cloud storage (R2/S3 wiring is a backend
  follow-up — see `backend/app/config.py`'s `r2_*` settings). The AI
  pipeline runs fully without it, so this doesn't block reports.
