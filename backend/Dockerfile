# Production image for Railway. Multi-stage keeps the final image small —
# build tools don't ship in the runtime layer.
FROM python:3.11-slim AS base

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq-dev gcc \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Railway sets $PORT at runtime; default to 8000 for local `docker run`.
ENV PORT=8000
EXPOSE 8000

# Run migrations, then start the API. If a migration fails, the deploy
# fails loudly instead of serving traffic against a stale/broken schema.
CMD alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port ${PORT}
