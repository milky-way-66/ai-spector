"""
ai-spector CocoIndex pipeline.

Reads doc roots from .ai-spector/.docflow/config/index.docs.json and indexes
all markdown files for semantic search.

Storage:
  LanceDB (default) — file-based, zero setup, no server required.
  Set COCOINDEX_DB_URL=postgresql://... to use Postgres+pgvector instead.

Embedding:
  all-MiniLM-L6-v2 (default) — runs locally, ~80 MB download, no API key.
  Set OPENAI_API_KEY and COCOINDEX_EMBED_MODEL=openai:text-embedding-3-small
  for higher-quality embeddings.

Usage:
  python pipeline.py cocoindex update     # index / update changed files
  python pipeline.py cocoindex query      # search REPL (dev only)
"""

import json
import os
from pathlib import Path

import cocoindex

PROJECT_ROOT = Path(os.getenv("AI_SPECTOR_ROOT", str(Path.cwd())))
INDEX_CONFIG = PROJECT_ROOT / ".ai-spector/.docflow/config/index.docs.json"
LANCE_PATH = str(PROJECT_ROOT / ".ai-spector/.docflow/cocoindex/lance_data")

DB_URL = os.getenv("COCOINDEX_DB_URL", "")
EMBED_MODEL = os.getenv(
    "COCOINDEX_EMBED_MODEL",
    "sentence-transformers/all-MiniLM-L6-v2",
)


def load_doc_roots() -> list[str]:
    if not INDEX_CONFIG.exists():
        raise FileNotFoundError(
            f"index.docs.json not found at {INDEX_CONFIG}\n"
            "Run `npx ai-spector index` first to create it."
        )
    cfg = json.loads(INDEX_CONFIG.read_text())
    return [
        str(PROJECT_ROOT / src["root"])
        for src in cfg.get("sources", {}).values()
    ]


def make_embed():
    if EMBED_MODEL.startswith("openai:"):
        model = EMBED_MODEL.removeprefix("openai:")
        return cocoindex.functions.OpenAIEmbed(model=model)
    return cocoindex.functions.SentenceTransformerEmbed(model=EMBED_MODEL)


def make_storage():
    if DB_URL:
        return cocoindex.storages.Postgres(table_name="doc_chunks")
    return cocoindex.storages.LanceDB(uri=LANCE_PATH, table_name="doc_chunks")


@cocoindex.flow_def(name="ai_spector_docs")
def docs_flow(flow_builder: cocoindex.FlowBuilder, db: cocoindex.DataScope):
    embed = make_embed()
    storage = make_storage()

    for root in load_doc_roots():
        docs = flow_builder.add_source(
            cocoindex.sources.LocalFile(
                path=root,
                included_patterns=["**/*.md"],
            )
        )
        chunks = docs.transform(
            cocoindex.functions.SplitRecursively(),
            language="markdown",
            chunk_size=400,
            chunk_overlap=50,
        )
        chunks.transform(embed).save_to(db["doc_chunks"], storage)


def run_search(query: str, limit: int, threshold: float) -> None:
    """Semantic search — prints JSON array of results to stdout."""
    import json

    try:
        embed_fn = make_embed()
        query_vec = embed_fn.embed_query(query)
    except Exception as e:
        print(json.dumps({"error": f"Embedding failed: {e}"}))
        return

    try:
        storage = make_storage()
        rows = storage.search(
            table="doc_chunks",
            vector=query_vec,
            limit=limit,
            score_threshold=threshold,
        )
    except Exception as e:
        print(json.dumps({"error": f"Search failed: {e}"}))
        return

    results = [
        {
            "docPath": row.get("filename", ""),
            "heading": row.get("heading", ""),
            "excerpt": row.get("text", ""),
            "score": round(float(row.get("score", 0)), 4),
        }
        for row in rows
    ]
    print(json.dumps(results))


if __name__ == "__main__":
    import sys

    if len(sys.argv) > 1 and sys.argv[1] == "search":
        import argparse

        parser = argparse.ArgumentParser(prog="pipeline.py search")
        parser.add_argument("--query", required=True)
        parser.add_argument("--limit", type=int, default=5)
        parser.add_argument(
            "--threshold",
            type=float,
            default=float(os.getenv("COCOINDEX_SIMILARITY_THRESHOLD", "0.75")),
        )
        args = parser.parse_args(sys.argv[2:])
        run_search(args.query, args.limit, args.threshold)
    else:
        cocoindex.cli.main()
