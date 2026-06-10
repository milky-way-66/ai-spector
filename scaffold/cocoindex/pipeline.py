"""
ai-spector CocoIndex — CLI entry point.

  python pipeline.py mcp              Run as MCP server (stdio)
  python pipeline.py update           Build / refresh the semantic index
  python pipeline.py search --query X Semantic search (used by ai-spector Node CLI)
"""

from __future__ import annotations

import asyncio
import json
import os
import sys

from flow import EMBED_MODEL, LANCEDB_URI, TABLE_NAME, app


async def _search(query: str, limit: int, threshold: float) -> list[dict]:
    from cocoindex.connectors import lancedb
    from cocoindex.ops.sentence_transformers import SentenceTransformerEmbedder
    try:
        embedder = SentenceTransformerEmbedder(EMBED_MODEL)
        query_vec = await embedder.embed(query)
        conn = await lancedb.connect_async(LANCEDB_URI)
        table = await conn.open_table(TABLE_NAME)
        # Cosine distance so that score = 1 - distance is a real similarity in
        # [0, 1]. The LanceDB default (L2) makes 1 - distance meaningless and
        # silently filters out every result.
        results = await (
            (await table.search(query_vec, vector_column_name="embedding"))
            .distance_type("cosine")
            .limit(limit)
            .to_list()
        )
        return [
            {
                "docPath": r["filename"],
                "heading": r.get("heading", ""),
                "excerpt": r["text"],
                "score": round(float(1.0 - r.get("_distance", 1.0)), 4),
            }
            for r in results
            if (1.0 - r.get("_distance", 1.0)) >= threshold
        ]
    except Exception as e:
        sys.stderr.write(f"Search failed: {e}\n")
        return []


async def _stats() -> dict:
    from cocoindex.connectors import lancedb
    try:
        conn = await lancedb.connect_async(LANCEDB_URI)
        table = await conn.open_table(TABLE_NAME)
        chunk_count = await table.count_rows()
        rows = await table.query().select(["filename"]).limit(1_000_000).to_list()
        files = sorted({r["filename"] for r in rows})
        return {"chunkCount": chunk_count, "fileCount": len(files), "files": files}
    except Exception as e:
        return {"error": str(e), "chunkCount": 0, "fileCount": 0, "files": []}


if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else ""

    if cmd == "mcp":
        from server import mcp
        mcp.run(transport="stdio")

    elif cmd == "search":
        import argparse
        parser = argparse.ArgumentParser(prog="pipeline.py search")
        parser.add_argument("--query", required=True)
        parser.add_argument("--limit", type=int, default=5)
        parser.add_argument(
            "--threshold",
            type=float,
            default=float(os.getenv("COCOINDEX_SIMILARITY_THRESHOLD", "0.35")),
        )
        args = parser.parse_args(sys.argv[2:])
        print(json.dumps(asyncio.run(_search(args.query, args.limit, args.threshold))))

    elif cmd == "stats":
        print(json.dumps(asyncio.run(_stats())))

    elif cmd == "update":
        app.update_blocking(report_to_stdout=True)

    else:
        print("Usage:")
        print("  python pipeline.py mcp              Run MCP server")
        print("  python pipeline.py update           Build / refresh index")
        print("  python pipeline.py search --query X Semantic search")
        print("  python pipeline.py stats            Embedding store stats (JSON)")
