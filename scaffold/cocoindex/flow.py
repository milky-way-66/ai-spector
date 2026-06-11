"""
CocoIndex 1.0 flow definition and search logic for ai-spector.

Config via environment variables:
  AI_SPECTOR_ROOT       — project root (default: cwd)
  COCOINDEX_DB_URI      — LanceDB URI (default: <cocoindex_dir>/lancedb_data)
  COCOINDEX_EMBED_MODEL — embedding model (default: all-MiniLM-L6-v2)
"""

from __future__ import annotations

import json
import os
from dataclasses import dataclass
from pathlib import Path
from typing import Annotated, AsyncIterator

from numpy.typing import NDArray

import cocoindex as coco
from cocoindex.connectors import lancedb, localfs
from cocoindex.ops.text import RecursiveSplitter
from cocoindex.ops.sentence_transformers import SentenceTransformerEmbedder
from cocoindex.resources.chunk import Chunk
from cocoindex.resources.file import FileLike, PatternFilePathMatcher
from cocoindex.resources.id import IdGenerator

# ── Config ────────────────────────────────────────────────────────────────────

_SCRIPT_DIR = Path(__file__).parent

# COCOINDEX_DB is required by CocoIndex 1.0+ for its LMDB state store.
# Default to a sibling directory so the pipeline works without any .env setup.
os.environ.setdefault("COCOINDEX_DB", str(_SCRIPT_DIR / "cocoindex_state"))

PROJECT_ROOT = Path(os.getenv("AI_SPECTOR_ROOT", str(Path.cwd())))
INDEX_CONFIG = PROJECT_ROOT / ".ai-spector/.docflow/config/index.docs.json"
LANCEDB_URI = os.getenv(
    "COCOINDEX_DB_URI",
    str(_SCRIPT_DIR / "lancedb_data"),
)
TABLE_NAME = "doc_chunks"
EMBED_MODEL = os.getenv(
    "COCOINDEX_EMBED_MODEL",
    "sentence-transformers/all-MiniLM-L6-v2",
)

# ── Context keys ──────────────────────────────────────────────────────────────

LANCE_DB = coco.ContextKey[lancedb.LanceAsyncConnection]("ai_spector_db")
EMBEDDER = coco.ContextKey[SentenceTransformerEmbedder]("embedder", detect_change=True)

_splitter = RecursiveSplitter()


# ── Schema ────────────────────────────────────────────────────────────────────

@dataclass
class DocChunk:
    id: int
    filename: str
    heading: str
    chunk_start: int
    chunk_end: int
    text: str
    embedding: Annotated[NDArray, EMBEDDER]


# ── Lifespan ──────────────────────────────────────────────────────────────────

@coco.lifespan
async def coco_lifespan(builder: coco.EnvironmentBuilder) -> AsyncIterator[None]:
    conn = await lancedb.connect_async(LANCEDB_URI)
    builder.provide(LANCE_DB, conn)
    builder.provide(EMBEDDER, SentenceTransformerEmbedder(EMBED_MODEL))
    yield


# ── Pipeline ──────────────────────────────────────────────────────────────────

def _extract_heading(text: str) -> str:
    """Return first markdown heading found, or empty string."""
    for line in text.splitlines():
        if line.startswith("#"):
            return line.lstrip("#").strip()
    return ""


@coco.fn
async def process_chunk(
    chunk: Chunk,
    filename: str,
    id_gen: IdGenerator,
    table: lancedb.TableTarget[DocChunk],
) -> None:
    table.declare_row(
        row=DocChunk(
            id=await id_gen.next_id(chunk.text),
            filename=filename,
            heading=_extract_heading(chunk.text),
            chunk_start=chunk.start.char_offset,
            chunk_end=chunk.end.char_offset,
            text=chunk.text,
            embedding=await coco.use_context(EMBEDDER).embed(chunk.text),
        ),
    )


@coco.fn(memo=True)
async def process_file(
    file: FileLike,
    table: lancedb.TableTarget[DocChunk],
) -> None:
    text = await file.read_text()
    chunks = _splitter.split(
        text, chunk_size=400, chunk_overlap=50, language="markdown"
    )
    id_gen = IdGenerator()
    await coco.map(process_chunk, chunks, str(file.file_path.path), id_gen, table)


def _load_doc_roots() -> list[Path]:
    # Deduplicate by resolved path: docs/data-source is usually already listed
    # in index.docs.json, and mounting the same tree twice makes CocoIndex
    # collide on filename keys ("Path ... already exists").
    roots: list[Path] = []
    seen: set[Path] = set()

    def add_root(path: Path) -> None:
        resolved = path.resolve()
        if path.exists() and resolved not in seen:
            seen.add(resolved)
            roots.append(path)

    if INDEX_CONFIG.exists():
        cfg = json.loads(INDEX_CONFIG.read_text())
        for src in cfg.get("sources", {}).values():
            add_root(PROJECT_ROOT / src["root"])
    add_root(PROJECT_ROOT / "docs" / "data-source")
    return roots


@coco.fn
async def app_main() -> None:
    target_table = await lancedb.mount_table_target(
        LANCE_DB,
        table_name=TABLE_NAME,
        table_schema=await lancedb.TableSchema.from_class(
            DocChunk, primary_key=["id"]
        ),
    )
    for root in _load_doc_roots():
        files = localfs.walk_dir(
            root,
            recursive=True,
            path_matcher=PatternFilePathMatcher(included_patterns=["**/*.md"]),
        )
        await coco.mount_each(process_file, files.items(), target_table)


app = coco.App(
    coco.AppConfig(name="ai_spector_docs"),
    app_main,
)
