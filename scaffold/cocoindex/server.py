"""
MCP server for ai-spector CocoIndex.

Exposes three tools:
  docs_search  — semantic search over indexed project docs
  docs_stats   — chunk/file counts and embedded file paths (diagnostics)
  docs_update  — rebuild the index from current project docs

Embedder and LanceDB connection are kept warm for the lifetime of the server
via FastMCP lifespan — no cold-start cost per tool call.
"""

from __future__ import annotations

from contextlib import asynccontextmanager
from dataclasses import dataclass
from typing import AsyncIterator, TypedDict

from mcp.server.fastmcp import Context, FastMCP
from mcp.server.fastmcp.exceptions import ToolError

from cocoindex.connectors import lancedb
from cocoindex.ops.sentence_transformers import SentenceTransformerEmbedder

from flow import EMBED_MODEL, LANCEDB_URI, TABLE_NAME, app


# ── Lifespan state ────────────────────────────────────────────────────────────

@dataclass
class ServerState:
    embedder: SentenceTransformerEmbedder
    db: lancedb.LanceAsyncConnection


@asynccontextmanager
async def lifespan(server: FastMCP) -> AsyncIterator[ServerState]:
    """Load embedder and open DB connection once; keep warm for all tool calls."""
    embedder = SentenceTransformerEmbedder(EMBED_MODEL)
    db = await lancedb.connect_async(LANCEDB_URI)
    yield ServerState(embedder=embedder, db=db)


# ── Server ────────────────────────────────────────────────────────────────────

mcp = FastMCP("ai-spector-cocoindex", lifespan=lifespan)


# ── Return types ──────────────────────────────────────────────────────────────

class SearchResult(TypedDict):
    docPath: str
    heading: str
    excerpt: str
    score: float


# ── Tools ─────────────────────────────────────────────────────────────────────

@mcp.tool()
async def docs_search(
    query: str,
    ctx: Context,
    limit: int = 5,
    threshold: float = 0.35,
) -> list[SearchResult]:
    """
    Semantic search over project docs by meaning, not keywords.

    Use this when the user asks about a concept, feature, or topic in the project
    docs. Prefer this over keyword search for questions like "how does X work" or
    "what is the purpose of Y".

    Args:
        query: Natural-language description of the concept to search for.
        limit: Maximum number of results to return (default 5).
        threshold: Minimum cosine similarity 0–1 to include a result (default 0.35).

    Returns:
        List of matching doc chunks with docPath, heading, excerpt, and score.
    """
    state: ServerState = ctx.request_context.lifespan_context

    try:
        await ctx.info(f"Embedding query: {query!r}")
        query_vec = await state.embedder.embed(query)

        table = await state.db.open_table(TABLE_NAME)
        # Cosine distance so that score = 1 - distance is a real similarity in
        # [0, 1]; the LanceDB default (L2) silently filters out every result.
        raw = await (
            (await table.search(query_vec, vector_column_name="embedding"))
            .distance_type("cosine")
            .limit(limit)
            .to_list()
        )

    except Exception as exc:
        raise ToolError(f"Search failed: {exc}") from exc

    results: list[SearchResult] = [
        SearchResult(
            docPath=r["filename"],
            heading=r.get("heading", ""),
            excerpt=r["text"],
            score=round(float(1.0 - r.get("_distance", 1.0)), 4),
        )
        for r in raw
        if (1.0 - r.get("_distance", 1.0)) >= threshold
    ]

    await ctx.info(f"Returning {len(results)} result(s) above threshold {threshold}")
    return results


@mcp.tool()
async def docs_stats(ctx: Context) -> dict:
    """
    Inspect the embedding store: chunk count, file count, and embedded file paths.

    Use this to verify which files are actually embedded when docs_search returns
    fewer results than expected.

    Returns:
        Dict with chunkCount, fileCount, and files (embedded file paths).
    """
    state: ServerState = ctx.request_context.lifespan_context
    try:
        table = await state.db.open_table(TABLE_NAME)
        chunk_count = await table.count_rows()
        rows = await table.query().select(["filename"]).limit(1_000_000).to_list()
        files = sorted({r["filename"] for r in rows})
    except Exception as exc:
        raise ToolError(f"Stats failed: {exc}") from exc
    return {"chunkCount": chunk_count, "fileCount": len(files), "files": files}


@mcp.tool()
def docs_update(ctx: Context) -> str:
    """
    Rebuild the semantic index from project docs.

    Run this after adding, editing, or deleting doc files so that docs_search
    returns up-to-date results. The operation may take a minute for large doc sets.

    Returns:
        A message confirming the index was updated.
    """
    try:
        app.update_blocking(report_to_stdout=True)
    except Exception as exc:
        raise ToolError(f"Index update failed: {exc}") from exc

    return "Index updated successfully."


# ── Entry point ───────────────────────────────────────────────────────────────

if __name__ == "__main__":
    mcp.run(transport="stdio")
