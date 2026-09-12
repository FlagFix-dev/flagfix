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

# Largest request body we will accept, anywhere. Sized to comfortably fit
# the biggest legitimate upload (5 files, the largest of which may be a
# 40MB video — see services/storage.py) with headroom for multipart
# overhead.
MAX_REQUEST_BYTES = 60 * 1024 * 1024


@app.middleware("http")
async def limit_request_size(request: Request, call_next):
    """
    Rejects oversized requests before anything reads the body.

    This has to live in middleware rather than in the upload endpoint,
    because FastAPI parses (and spools to disk) the entire multipart body
    while resolving dependencies — which happens BEFORE the authentication
    dependency runs. Without this, an unauthenticated caller can make the
    server write an arbitrarily large file to disk just by posting to the
    upload URL.
    """
    content_length = request.headers.get("content-length")
    if content_length is not None:
        try:
            if int(content_length) > MAX_REQUEST_BYTES:
                return JSONResponse(
                    status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                    content={"detail": "That upload is too large."},
                )
        except ValueError:
            return JSONResponse(
                status_code=status.HTTP_400_BAD_REQUEST,
                content={"detail": "Invalid Content-Length header."},
            )
    return await call_next(request)


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
