# AI Spector — Claude Agent Rules

You are working in an **AI Spector** managed project. The agent workflow is: read skills, call **MCP tools** (preferred) or `npx ai-spector` CLI (fallback), report results. You do not write doc content from scratch — MCP tools / CLI + skills do the work.

Enable all skills under `.claude/skills/` before starting.

## Mandatory Rules

### 1. MCP first, CLI fallback

When the `ai-spector` MCP server is available, **call the MCP tool** instead of shelling out to `npx ai-spector`.

| Operation | MCP tool | CLI fallback |
|-----------|----------|--------------|
| Re-index project | `index({})` | `npx ai-spector index` |
| Merge knowledge → graph | `graph_merge({ fromKnowledge: true })` | `npx ai-spector graph merge --from-knowledge` |
| Validate graph | `graph_validate({})` | `npx ai-spector graph validate` |
| Impact analysis | `graph_impact({ originId, change })` | `npx ai-spector graph impact …` |
| Walk graph from node | `graph_query({ id })` | `npx ai-spector graph query <id> --json` |
| **Analyze data-source** | *(CLI only — no MCP tool)* | `npx ai-spector analyze` |

### 2. Refresh index before any staleness check

Before checking translation status, pending queue, or "what's outdated":

```
index({})                    # MCP preferred
npx ai-spector index         # CLI fallback
```

Then read the queue. **Never read `.ai-spector/.docflow/translation-queue/pending.json` without running index first** — the queue is only accurate after indexing.

### 3. Check impact before finishing any doc edit

After editing any file under `docs/srs/`, `docs/basic-design/`, or `docs/detail-design/`, run impact before closing the task:

```
graph_impact({ git: true, change: "content_change" })   # MCP preferred
npx ai-spector graph impact --git --change content_change --json  # CLI fallback
```

Then refresh index:

```
index({})
```

Skip only when the user explicitly says it was a typo-only fix with no traceability concern.

### 4. Use MCP/graph — not file search

| Need | MCP (preferred) | CLI fallback |
|------|-----------------|--------------|
| Find what needs regeneration | `graph_impact({ git: true, change: "content_change" })` | `npx ai-spector graph impact --git --json` |
| Find node by exact ID | `graph_query({ id: "…" })` | `npx ai-spector graph query <id> --json` |
| Find node by concept | `graph_query_fuzzy(query: "…")` — requires CocoIndex | — |
| Search docs by meaning | `docs_search(query: "…")` — requires CocoIndex | — |
| Check graph health | `graph_validate({})` | `npx ai-spector graph validate` |
| See pending translations | *(CLI only)* | `npx ai-spector lang queue pending --json` (after index) |

**Only fall back to `grep` or `Read` when the tool returns no results or you need raw file content for editing.**

## Skill → task mapping

| You want to… | Skill |
|-------------|-------|
| Analyze data source / build graph | `ai-spector-graph` |
| Check impact of changes | `ai-spector-graph` |
| Semantic search / fuzzy graph lookup | `ai-spector-search` |
| Import / set up custom template pack | `ai-spector-template-import` |
| Generate documents (check active pack first) | read `packs.active` → use skill below |
| → Custom pack active | `ai-spector-generate-<packname>` (installed by `template install`) |
| → Builtin: Write SRS | `ai-spector-generate-srs` |
| → Builtin: Write basic design | `ai-spector-generate-basic-design` |
| HTML prototype | `ai-spector-generate-prototype` |
| Translation status | `ai-spector-lang-status` |
| Resolve translations | `ai-spector-resolve-translation` |
| Resolve comments | `ai-spector-resolve-comments` |

## Quick reference

### MCP tools (prefer these)

| Tool | Purpose |
|------|---------|
| `index({})` | Refresh fingerprints + translation queue |
| `graph_merge({ fromKnowledge: true })` | Merge knowledge.json into graph |
| `graph_validate({})` | Check graph integrity |
| `graph_impact({ git: true, change: "content_change" })` | Impact of current git diff |
| `graph_query({ id: "…" })` | Walk graph from a node |

### CLI (fallback / MCP-unavailable or no tool equivalent)

```bash
npx ai-spector analyze              # ingest data-source, build graph (no MCP equivalent)
npx ai-spector index                # fallback for index({})
npx ai-spector graph validate       # fallback for graph_validate({})
npx ai-spector graph impact --git --json   # fallback for graph_impact({ git: true })
npx ai-spector lang queue pending --json   # pending translation jobs
npx ai-spector setup --check        # audit project setup
npx ai-spector template list        # list installed packs + active
npx ai-spector template scan <path> # scan a template folder → scan-result.json
npx ai-spector template install     # install pack from staging (AI writes manifest first)
npx ai-spector template use <name>  # switch active pack (use "builtin" to revert)

# CocoIndex (opt-in — requires Python 3.11+)
npx ai-spector cocoindex setup      # scaffold pipeline into project
npx ai-spector cocoindex index      # run pipeline (update embeddings)
```

On MCP tool or CLI failure: show the output, offer fix / workaround / pause. Do not invent results.

## Pipeline order

```
analyze → validate graph → generate SRS → index
  → generate basic design → index
  → generate detail design
  → prototype setup → generate HTML screens
```
