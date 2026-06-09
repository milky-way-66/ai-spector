# Work 18 — Enable CocoIndex (Optional)

**Course:** [Index](README.md) · [Overview](00-overview.md) · [Previous](16-visualize-the-graph.md)

**Goal:** Add semantic (meaning-based) search to your project so the agent can find relevant graph nodes and documents using natural language queries, not just exact IDs.

**Before you start:** Work 03 (Finish Setup in Chat), Python 3.11+ installed.

---

## What CocoIndex Adds

Without CocoIndex, graph queries use node IDs and exact matches. With CocoIndex enabled:

- `docs_search` MCP tool — finds documents by meaning, not keyword
- `graph_query_fuzzy` MCP tool — resolves a natural language phrase to the closest graph node, then queries from there

Example: without CocoIndex you must say `query graph from UC-03`. With CocoIndex you can say `query graph from the user registration flow` and the agent finds the right node.

---

## Requirements

| Requirement | Notes |
|-------------|-------|
| Python 3.11+ | Check: `python3 --version` |
| A database | PostgreSQL (recommended) or SQLite — CocoIndex stores embeddings here |
| An embedding model | OpenAI `text-embedding-3-small` (default) or a local model |

You need at least a local SQLite database if you don't have PostgreSQL. OpenAI API key is needed for the default embedding model.

---

## Steps

### 1. Open chat

### 2. Type this

```
enable CocoIndex for this project
```

---

### 3. Answer the agent's questions

The agent will ask:

**Database type:** `postgres` or `sqlite`

Choose `sqlite` if you want the simplest setup. Choose `postgres` if you have a running PostgreSQL instance.

**Embedding model:** OpenAI or local

Choose `openai` and provide your API key if you have one. The agent stores the key in your local environment only — it is not committed to the repo.

---

### 4. Wait for scaffolding

The agent:

1. Creates `.ai-spector/.docflow/cocoindex/pipeline.py`
2. Sets up a virtual environment in `.ai-spector/.docflow/cocoindex/venv/`
3. Installs Python dependencies
4. Runs an initial index to build embeddings

This takes 2–5 minutes on the first run.

---

### 5. Verify

```
search docs for "user authentication"
```

The agent should return ranked document sections — not an error about CocoIndex not being configured.

---

## Check

```
search docs for "payment flow"
```

You should see ranked results from your documents.

---

## Troubleshooting

**"Python not found"**

Make sure Python 3.11+ is on your PATH:

```bash
python3 --version
```

If not, install it from [python.org](https://python.org).

**"OpenAI API key not set"**

The agent will prompt you for the key. Or set it in your environment:

```bash
export OPENAI_API_KEY=sk-...
```

**"Pipeline failed to install dependencies"**

Try installing manually:

```bash
cd .ai-spector/.docflow/cocoindex
python3 -m pip install -r requirements.txt
```

**Embeddings are slow to build**

The first run indexes all documents and is slow. Subsequent runs are incremental and fast.

---

## Day-to-Day Usage

After enabling CocoIndex, re-index after any document change to keep embeddings fresh:

```
refresh the index
```

The index step automatically syncs CocoIndex when it is configured.

---

## Next

Go to [Work 19 — Add Another Editor (Optional)](19-add-another-editor.md), or return to your regular workflow.
