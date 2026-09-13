"""
Step 3 of the AI pipeline: turn a report's text into a vector so meaning,
not exact wording, can be compared. This is what makes "before Room 303
there's a broken tile" and "beside Room 303 a tile is broken" land close
together in vector space even though they share few exact words — see
services/similarity.py for what happens with that closeness.

Why a dedicated embedding model rather than the chat model: comparing one
new report against every recent report using a chat model would mean one
API call per existing report. Embedding it once lets Postgres compare it
against thousands of stored vectors in milliseconds.

Two providers, one contract — Google (Gemini) and Voyage — selected by
`settings.active_embedding_provider` (see config.py). Both are asked for
EMBEDDING_DIM dimensions so the pgvector column, and every vector already
stored in it, stay valid either way.

Like ai_extraction.py, this degrades gracefully: with no provider key,
`embed()` returns None and the caller (api/problems.py) simply skips
similarity matching for that report rather than failing the submission. A
report with no embedding is never lost — it just won't be auto-matched
until re-embedded once a key is configured.

IMPORTANT: vectors from different models are not comparable with each
other. Switching provider (or model) invalidates every stored vector —
existing reports must be re-embedded, or they will silently stop matching
new ones. See EMBEDDING_DIM in models/problem.py.
"""
import logging
import math

from tenacity import retry, retry_if_exception_type, stop_after_attempt, wait_exponential

from app.config import get_settings
from app.models.problem import EMBEDDING_DIM

logger = logging.getLogger("flagfix.embeddings")


def _check_dimensions(vector: list[float]) -> list[float]:
    if len(vector) != EMBEDDING_DIM:
        raise ValueError(
            f"Embedding model returned {len(vector)} dims, expected {EMBEDDING_DIM}. "
            "Update EMBEDDING_DIM in app/models/problem.py (and re-run migrations + "
            "re-embed existing rows) if you've changed the embedding model."
        )
    return vector


def _normalize(vector: list[float]) -> list[float]:
    """Scale to unit length.

    Gemini returns unit-length vectors only at its full 3072 dimensions;
    when a smaller size is requested the result is truncated and is no
    longer normalized, which Google's own guidance says to correct for.
    Harmless for cosine distance (which divides magnitude out anyway) but
    it keeps stored vectors consistent with Voyage's, which arrive
    normalized already — so the two are at least on the same footing if a
    dataset is ever re-embedded.
    """
    magnitude = math.sqrt(sum(component * component for component in vector))
    if magnitude == 0:
        return vector
    return [component / magnitude for component in vector]


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
    return _check_dimensions(result.embeddings[0])


@retry(
    retry=retry_if_exception_type((ConnectionError, TimeoutError)),
    wait=wait_exponential(multiplier=1, min=1, max=8),
    stop=stop_after_attempt(3),
    reraise=True,
)
def _call_gemini(text: str) -> list[float]:
    from google import genai
    from google.genai import types

    settings = get_settings()
    client = genai.Client(api_key=settings.gemini_api_key)

    response = client.models.embed_content(
        model=settings.gemini_embed_model,
        contents=text,
        config=types.EmbedContentConfig(
            # We compare reports against each other, rather than matching
            # short queries against long documents, so this is a symmetric
            # similarity task — not retrieval.
            task_type="SEMANTIC_SIMILARITY",
            # Asked for explicitly so the vector fits the existing pgvector
            # column. Gemini supports 128-3072; 1024 keeps every vector
            # already stored by Voyage the same width.
            output_dimensionality=EMBEDDING_DIM,
        ),
    )

    embeddings = response.embeddings or []
    if not embeddings or not embeddings[0].values:
        raise ValueError("Gemini returned no embedding values")
    return _normalize(_check_dimensions(list(embeddings[0].values)))


def embed(text: str) -> list[float] | None:
    settings = get_settings()
    provider = settings.active_embedding_provider
    if provider is None:
        logger.info("Embedding skipped (no embedding provider key set).")
        return None

    try:
        if provider == "gemini":
            return _call_gemini(text)
        if provider == "voyage":
            return _call_voyage(text)
        raise ValueError(f"Unknown embedding provider: {provider!r}")
    except Exception:  # noqa: BLE001 — never let an embedding failure block a report submission
        logger.exception("Embedding call failed via %s; report saved without a vector.", provider)
        return None


def model_version() -> str:
    """Recorded alongside every stored vector, so it's always possible to
    tell which model produced it — the question you need answered before
    re-embedding after a provider switch."""
    settings = get_settings()
    return settings.active_embedding_model or "none"
