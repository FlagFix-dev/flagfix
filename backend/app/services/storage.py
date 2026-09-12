"""
Photo/video upload for reports, backed by Cloudflare R2 (S3-compatible
object storage). Same graceful-degradation philosophy as the AI pipeline
(see services/ai_extraction.py): if R2 isn't configured yet, uploads are
simply unavailable — a report can still be submitted without media — rather
than the app crashing because a bucket doesn't exist.

Uploads go through OUR backend (not a browser-side pre-signed URL) on
purpose: it means the R2 bucket itself never needs CORS configured for the
frontend's origin, which is one less thing to get wrong during setup. The
tradeoff is that a file's bytes pass through the Render instance's memory
before landing in R2 — acceptable at MVP scale given the size caps below.
"""
import logging
import uuid

from fastapi import UploadFile

from app.config import get_settings

logger = logging.getLogger("flagfix.storage")

# Deliberately conservative for an MVP running on a free-tier backend
# instance: big enough for a phone photo or a short clip, small enough that
# a handful of concurrent uploads won't exhaust available memory.
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
        endpoint_url=f"https://{settings.r2_account_id}.r2.cloudflarestorage.com",
        aws_access_key_id=settings.r2_access_key_id,
        aws_secret_access_key=settings.r2_secret_access_key,
        region_name="auto",
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

    limit = MAX_IMAGE_BYTES if content_type in ALLOWED_IMAGE_TYPES else MAX_VIDEO_BYTES
    data = await file.read()
    if len(data) > limit:
        limit_mb = limit // (1024 * 1024)
        raise UploadRejected(f"'{file.filename}' is too large — the limit is {limit_mb}MB for this file type.")
    if len(data) == 0:
        raise UploadRejected(f"'{file.filename}' appears to be empty.")

    key = f"{org_id}/{uuid.uuid4().hex}{_extension_for(content_type)}"

    try:
        _client().put_object(
            Bucket=settings.r2_bucket_name,
            Key=key,
            Body=data,
            ContentType=content_type,
        )
    except Exception:  # noqa: BLE001 — a storage-provider outage must not 500 the request
        logger.exception("R2 upload failed for key %s", key)
        raise UploadRejected("Could not upload that file right now. Please try again in a moment.")

    url = f"{settings.r2_public_base_url.rstrip('/')}/{key}"
    return url, content_type
