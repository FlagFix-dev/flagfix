"""
Photo/video upload for reports, backed by any S3-compatible object store —
Supabase Storage today, but Cloudflare R2, Backblaze B2 or AWS S3 would each
work by changing environment variables alone (see config.py). Same
graceful-degradation philosophy as the AI pipeline (see
services/ai_extraction.py): if storage isn't configured yet, uploads are
simply unavailable — a report can still be submitted without media — rather
than the app crashing because a bucket doesn't exist.

Uploads go through OUR backend (not a browser-side pre-signed URL) on
purpose: it means the bucket itself never needs CORS configured for the
frontend's origin, which is one less thing to get wrong during setup, and
the storage credentials never touch the browser. The tradeoff is that a
file's bytes pass through the Render instance's memory before landing in
the bucket — acceptable at MVP scale given the size caps below.
"""
import logging
import uuid

import anyio.to_thread
from fastapi import UploadFile

from app.config import get_settings

logger = logging.getLogger("flagfix.storage")

# Deliberately conservative for an MVP running on a free-tier backend
# instance: big enough for a phone photo or a short clip, small enough that
# a handful of concurrent uploads won't exhaust available memory. Both caps
# also sit safely under Supabase Storage's 50MB-per-file free-plan ceiling.
MAX_IMAGE_BYTES = 10 * 1024 * 1024  # 10 MB
MAX_VIDEO_BYTES = 40 * 1024 * 1024  # 40 MB
MAX_FILES_PER_REPORT = 5

ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"}
ALLOWED_VIDEO_TYPES = {"video/mp4", "video/webm", "video/quicktime"}
ALLOWED_CONTENT_TYPES = ALLOWED_IMAGE_TYPES | ALLOWED_VIDEO_TYPES


class UploadRejected(Exception):
    """Raised for a bad-but-expected reason (wrong type, too big, too many)
    — the API layer turns this into a clean 400, never a 500."""


def _extension_for(content_type: str) -> str:
    return {
        "image/jpeg": ".jpg",
        "image/png": ".png",
        "image/webp": ".webp",
        "image/heic": ".heic",
        "image/heif": ".heif",
        "video/mp4": ".mp4",
        "video/webm": ".webm",
        "video/quicktime": ".mov",
    }.get(content_type, "")


def _client():
    """Lazily built so `boto3` and real credentials are only ever touched
    when storage is actually configured and in use."""
    import boto3

    settings = get_settings()
    return boto3.client(
        "s3",
        endpoint_url=settings.storage_endpoint_url,
        aws_access_key_id=settings.storage_access_key_id,
        aws_secret_access_key=settings.storage_secret_access_key,
        region_name=settings.storage_region,
    )


async def save_upload(org_id: uuid.UUID, file: UploadFile) -> tuple[str, str]:
    """Validates and uploads a single file, returning (url, content_type).
    Raises UploadRejected for anything that fails validation — callers
    should turn that into an HTTP 400 with the exception's message."""
    settings = get_settings()
    if not settings.storage_configured:
        raise UploadRejected("Photo/video upload isn't turned on for this institution yet.")

    content_type = (file.content_type or "").lower()
    if content_type not in ALLOWED_CONTENT_TYPES:
        raise UploadRejected(
            f"'{file.filename}' isn't a supported file type. Upload JPG/PNG/WEBP photos or "
            "MP4/WEBM/MOV videos."
        )

    # Read in chunks and abort the moment the limit is crossed, rather than
    # `await file.read()` on the whole thing and checking the size after.
    # The naive version means anyone with an account can push an
    # arbitrarily large file straight into this process's memory and
    # OOM-kill the API for every institution at once — the size check
    # arrives far too late to prevent it.
    limit = MAX_IMAGE_BYTES if content_type in ALLOWED_IMAGE_TYPES else MAX_VIDEO_BYTES
    chunks: list[bytes] = []
    total = 0
    while chunk := await file.read(64 * 1024):
        total += len(chunk)
        if total > limit:
            limit_mb = limit // (1024 * 1024)
            raise UploadRejected(
                f"'{file.filename}' is too large — the limit is {limit_mb}MB for this file type."
            )
        chunks.append(chunk)

    if total == 0:
        raise UploadRejected(f"'{file.filename}' appears to be empty.")
    data = b"".join(chunks)

    key = f"{org_id}/{uuid.uuid4().hex}{_extension_for(content_type)}"

    try:
        # boto3 is synchronous; uploading a 40MB video directly from this
        # async function would block the worker's event loop for the whole
        # transfer, stalling every other request on the process.
        await anyio.to_thread.run_sync(
            lambda: _client().put_object(
                Bucket=settings.storage_bucket_name,
                Key=key,
                Body=data,
                ContentType=content_type,
            )
        )
    except Exception:  # noqa: BLE001 — a storage-provider outage must not 500 the request
        logger.exception("Object storage upload failed for key %s", key)
        raise UploadRejected("Could not upload that file right now. Please try again in a moment.")

    url = f"{settings.storage_public_base_url.rstrip('/')}/{key}"
    return url, content_type
