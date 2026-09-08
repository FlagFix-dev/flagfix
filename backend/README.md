# FlagFix — Backend

FastAPI + PostgreSQL (pgvector) + Celery/Redis backend implementing the AI
pipeline described in the FlagFix implementation plan: report → AI
classification → semantic similarity/clustering → explainable priority →
department routing → resolution workflow.

## Local setup

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# Start Postgres (with pgvector) + Redis
docker compose -f ../docker-compose.yml up -d

cp .env.example .env
# edit .env: at minimum set JWT_SECRET_KEY to a random value
# (python -c "import secrets; print(secrets.token_hex(32))")

# One-time: enable the pgvector extension (needs to happen once per database)
# then run migrations:
alembic upgrade head

uvicorn app.main:app --reload
```

Visit `http://localhost:8000/docs` for interactive API docs (disabled in
production — see `app/main.py`).

## Running tests

```bash
source .venv/bin/activate
pytest tests/ -v
```

`tests/test_similarity_clustering.py` runs against a real Postgres +
pgvector database (not mocked) and proves the actual scenario the product
exists to solve: two differently-worded reports of the same real problem
("before Room 303 there's a broken tile" / "beside Room 303 a tile is
broken") get merged into one cluster, while unrelated reports don't.

## Without AI provider keys

The app boots and is fully testable with `ANTHROPIC_API_KEY` and
`VOYAGE_API_KEY` unset — `app/services/ai_extraction.py` and
`app/services/embeddings.py` both degrade to a safe fallback instead of
failing a report submission. Check `GET /health` — `ai_pipeline_enabled`
tells you whether both keys are currently configured.

## Project layout

```
app/
  models/       SQLAlchemy models (one file per domain area)
  schemas/      Pydantic request/response schemas
  services/     The AI pipeline + business logic, framework-agnostic
  api/          FastAPI route handlers — thin, delegate to services/
  config.py     Settings (reads from environment / .env)
  db.py         Async engine/session + RLS tenant-context helper
  deps.py       FastAPI dependencies (auth, tenant DB session, RBAC)
  security.py   Password hashing + JWT
  main.py       App wiring, CORS, error handling
alembic/         Database migrations (0001 = schema, 0002 = row-level security)
tests/
```

## Security notes

- Row-Level Security (Postgres) is enabled on every table holding
  complaint content (`problems`, `problem_clusters`, `attachments`,
  `status_history`, etc.) — see `alembic/versions/0002_row_level_security.py`
  for exactly which tables and why a few (org/user/location config data)
  are deliberately excluded.
- Every tenant-scoped route must depend on `get_tenant_db` (never a raw
  session) — that's what sets the RLS context per request.
- Never commit `.env`. Real secrets live in Railway's/Vercel's
  Environment Variables dashboard in production.
