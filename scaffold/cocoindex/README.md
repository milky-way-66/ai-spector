# ai-spector CocoIndex pipeline

Indexes your project's markdown docs for semantic search. Used by
`docs_search`, `graph_query_fuzzy`, and `graph_impact` semantic suggestions.

## Prerequisites

- Python ≥ 3.11
- Your project must have been indexed at least once: `npx ai-spector index`

## Setup

```bash
# 1. Copy the scaffold into your project (done automatically by `ai-spector cocoindex setup`)
cp -r .ai-spector/.docflow/cocoindex/ .

# 2. Install dependencies
pip install -r requirements.txt

# 3. Configure (optional — defaults work out of the box)
cp .env.example .env
# Edit .env if you want Postgres or OpenAI embeddings
```

## Running

```bash
# Index / update all docs (incremental — only changed files are re-processed)
python pipeline.py cocoindex update

# Run from inside your project root, or set AI_SPECTOR_ROOT:
AI_SPECTOR_ROOT=/path/to/project python pipeline.py cocoindex update
```

On first run, `all-MiniLM-L6-v2` (~80 MB) is downloaded automatically.
Subsequent runs are fast — CocoIndex only reprocesses changed files.

## Storage

**Default (LanceDB):** embeddings are written to
`.ai-spector/.docflow/cocoindex/lance_data/`. This directory is gitignored.
No server required.

**Postgres (optional):** set `COCOINDEX_DB_URL=postgresql://localhost/cocoindex`
in `.env`. Requires PostgreSQL with the
[pgvector](https://github.com/pgvector/pgvector) extension.

## Embedding models

| Model | Quality | Cost | Requirement |
|-------|---------|------|-------------|
| `sentence-transformers/all-MiniLM-L6-v2` (default) | Good | Free, ~80 MB | None |
| `openai:text-embedding-3-small` | Better | ~$0.02/1M tokens | `OPENAI_API_KEY` |

Switch by setting `COCOINDEX_EMBED_MODEL` in `.env`.

## Environment variables

See [`.env.example`](.env.example) for all options.
