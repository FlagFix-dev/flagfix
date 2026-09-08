# FlagFix

AI-powered problem intelligence and resolution platform for colleges,
universities, hostels and PGs. Report → AI understands it → matches it
against existing reports → clusters duplicates → scores priority → routes
to the right team → tracks to resolution → reporter confirms it's actually
fixed.

See `/backend/README.md` for how to run the API locally, and
`/frontend/README.md` for the web app.

## Status

- [x] Database schema + migrations (`backend/alembic/`)
- [x] Row-level security for tenant isolation (verified against a real
      Postgres instance — see `backend/alembic/versions/0002_row_level_security.py`)
- [x] Auth (signup/login/refresh)
- [x] Org onboarding (org + locations + departments + categories)
- [x] AI pipeline: extraction (Claude), embeddings (Voyage), similarity +
      clustering (pgvector), explainable priority scoring, department
      routing, SLA due-time — all with graceful fallback when API keys
      aren't configured yet
- [x] Resolution workflow state machine + reopen-on-disagreement loop
- [x] Automated tests (16 passing, including a real-database clustering test)
- [x] Frontend (Next.js 15 + TypeScript + Tailwind): onboarding, auth,
      role-aware dashboard, report submission, status workflow, resolution
      feedback — see `frontend/README.md`
- [ ] Deployed to Railway/Vercel
- [ ] Photo attachments persisted to cloud storage (R2/S3)
