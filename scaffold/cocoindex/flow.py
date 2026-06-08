"""
CocoIndex flow definition and shared search logic for ai-spector.

Config is read from environment variables:
  AI_SPECTOR_ROOT       — project root (default: cwd)
  COCOINDEX_DB_URL      — Postgres URL; omit to use LanceDB
  COCOINDEX_EMBED_MODEL — embedding model (default: all-MiniLM-L6-v2)
                          prefix with "openai:" to use OpenAI embeddings
"""

import json
import os
import sys
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
    roots = []
    for src in cfg.get("sources", {}).values():
        p = PROJECT_ROOT / src["root"]
        if p.exists():
            roots.append(str(p))
    data_source = PROJECT_ROOT / "docs" / "data-source"
    if data_source.exists():
        roots.append(str(data_source))
    return roots


def make_embed():
    if EMBED_MODEL.startswith("openai:"):
        return cocoindex.functions.OpenAIEmbed(model=EMBED_MODEL.removeprefix("openai:"))
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


def search(query: str, limit: int = 5, threshold: float = 0.75) -> list[dict]:
    """Returns a list of result dicts; never raises (errors return [])."""
    try:
        query_vec = make_embed().embed_query(query)
    except Exception as e:
        sys.stderr.write(f"Embedding failed: {e}\n")
        return []
    try:
        rows = make_storage().search(
            table="doc_chunks",
            vector=query_vec,
            limit=limit,
            score_threshold=threshold,
        )
    except Exception as e:
        sys.stderr.write(f"Search failed: {e}\n")
        return []
    return [
        {
            "docPath": row.get("filename", ""),
            "heading": row.get("heading", ""),
            "excerpt": row.get("text", ""),
            "score": round(float(row.get("score", 0)), 4),
        }
        for row in rows
    ]
