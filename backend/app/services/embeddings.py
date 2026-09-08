"""
Step 3 of the AI pipeline: turn a report's text into a vector so meaning,
not exact wording, can be compared. This is what makes "before Room 303
there's a broken tile" and "beside Room 303 a tile is broken" land close
together in vector space even though they don't share many exact words —
see services/similarity.py for what happens with that closeness.

Like ai_extraction.py, this degrades gracefully: if VOYAGE_API_KEY is not
set, embed() returns None, and the caller (api/problems.py) simply skips
similarity matching for that report rather than failing the submission.
A report with no embedding is never lost — it just won't be auto-matched
until re-embedded once a key is configured.
"""
import logging

from tenacity import retry, retry_if_exception_type, stop_after_attempt, wait_exponential

from app.config import get_settings
from app.models.problem import EMBEDDING_DIM

logger = logging.getLogger("flagfix.embeddings")


@retry(
    retry=retry_if_exception_type((ConnectionError, TimeoutError)),
    wait=wait_exponential(multiplier=1, min=1, max=8),
    stop=stop_after_attempt(3),
    reraise=True,
)
def _call_voyage(text: str) -> list[float]:
    import voyageai  # imported lazily so the module still loads without the package during tests

    settings = get_settings()
    client = voyageai.Client(api_key=settings.voyage_api_key)
    result = client.embed([text], model=settings.voyage_embed_model, input_type="document")
    vector = result.embeddings[0]
    if len(vector) != EMBEDDING_DIM:
        raise ValueError(
            f"Embedding model returned {len(vector)} dims, expected {EMBEDDING_DIM}. "
            "Update EMBEDDING_DIM in app/models/problem.py (and re-run migrations + "
            "re-embed existing rows) if you've changed the embedding model."
        )
    return vector


def embed(text: str) -> list[float] | None:
    settings = get_settings()
    if not settings.voyage_api_key:
        logger.info("Embedding skipped (no VOYAGE_API_KEY set).")
        return None
    try:
        return _call_voyage(text)
    except Exception:  # noqa: BLE001 — never let an embedding failure block a report submission
        logger.exception("Embedding call failed; report will be saved without a vector.")
        return None


def model_version() -> str:
    return get_settings().voyage_embed_model
