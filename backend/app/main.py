import logging

from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.router import api_router
from app.config import get_settings

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("flagfix")

settings = get_settings()

app = FastAPI(
    title="FlagFix API",
    version="0.1.0",
    # Hide interactive docs in production — no reason to advertise the full
    # API surface to the public internet once real institutions are on it.
    docs_url="/docs" if not settings.is_production else None,
    redoc_url=None,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """Catch-all so an unexpected bug never leaks a Python stack trace (and
    with it, internal file paths / library versions) to a client. The real
    detail still goes to our own logs (and Sentry, once wired in) for us to
    actually fix it."""
    logger.exception("Unhandled exception on %s %s", request.method, request.url.path)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "Something went wrong on our end. Please try again."},
    )


@app.get("/health", tags=["meta"])
async def health() -> dict:
    """Used by Railway/uptime monitoring to confirm the service is alive."""
    return {"status": "ok", "ai_pipeline_enabled": settings.ai_pipeline_enabled}


app.include_router(api_router)
