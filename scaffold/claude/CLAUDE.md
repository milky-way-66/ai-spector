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

### 3. Check impact and refresh embeddings after any doc edit

After editing any file under `docs/srs/`, `docs/basic-design/`, or `docs/detail-design/`:

**a) Impact:**
```
graph_impact({ git: true, change: "content_change" })   # MCP preferred
npx ai-spector graph impact --git --change content_change --json  # CLI fallback
```

**b) Re-index + embeddings (mandatory when CocoIndex is configured):**
```
index({ cocoindexSync: true })    # preferred — refreshes graph + embeddings in one call
```

Or separately:
```
index({})
cocoindex_index({})
```

CLI fallback: `npx ai-spector index && npx ai-spector cocoindex index`

Skip impact/index only when the user explicitly says it was a typo-only fix with no traceability concern. **Never skip `cocoindexSync` when CocoIndex is configured** — semantic search goes stale silently.

### 4. Use MCP/graph — not file search

| Need | MCP (preferred) | CLI fallback |
|------|-----------------|--------------|
| Prepare graph scaffold | `analyze({})` | `npx ai-spector analyze` |
| Check knowledge.json before merge | `knowledge_status({})` · `knowledge_validate({})` | *(no CLI)* |
| Merge knowledge → graph | `graph_merge({ fromKnowledge: true })` | `npx ai-spector graph merge --from-knowledge` |
| Find what needs regeneration | `graph_impact({ git: true, change: "content_change" })` | `npx ai-spector graph impact --git --json` |
| Find node by exact ID | `graph_query({ seedId: "…" })` | `npx ai-spector graph query <id> --json` |
| Find node by concept | `graph_query_fuzzy({ query: "…" })` — requires CocoIndex | — |
| Search docs by meaning | `docs_search({ query: "…" })` — requires CocoIndex | — |
| Check graph health | `graph_validate({})` · `graph_report({})` | `npx ai-spector graph validate` |
| Translation queue | `lang_queue({})` | `npx ai-spector lang queue pending --json` (after index) |
| CocoIndex readiness | `cocoindex_status({})` | `npx ai-spector setup --check` |
| Rebuild embeddings | `cocoindex_index({})` or `index({ cocoindexSync: true })` | `npx ai-spector cocoindex index` |

**Only fall back to `grep` or `Read` when the tool returns no results or you need raw file content for editing.**

## Skill → task mapping

| You want to… | Skill |
|-------------|-------|
| Analyze data source / build graph | `ai-spector-graph` |
| Check impact of changes | `ai-spector-graph` |
| Semantic search / fuzzy graph lookup | `ai-spector-search` |
| Import / set up custom template pack | `ai-spector-template-import` |
| Generate documents (check active packs first) | read `packs.srs` + `packs.basicDesign` → use skill below |
| → `packs.srs` is custom pack | `ai-spector-generate-<packname>` for SRS requests |
| → `packs.srs` is `"builtin"` | `ai-spector-generate-srs` |
| → `packs.basicDesign` is custom pack | `ai-spector-generate-<packname>` for basic-design requests |
| → `packs.basicDesign` is `"builtin"` | `ai-spector-generate-basic-design` |
| HTML prototype | `ai-spector-generate-prototype` |
| Translation status | `ai-spector-lang-status` |
| Resolve translations | `ai-spector-resolve-translation` |
| Resolve comments | `ai-spector-resolve-comments` |

## Quick reference

### MCP tools (prefer these)

| Tool | Purpose |
|------|---------|
| `analyze({})` | Prepare graph scaffold from templates |
| `knowledge_status({})` | Check knowledge.json entity counts |
| `knowledge_validate({})` | Validate knowledge.json schema |
| `graph_merge({ fromKnowledge: true })` | Merge knowledge.json into graph |
| `graph_validate({})` | Check graph integrity |
| `graph_report({})` | Graph layer health audit |
| `graph_impact({ git: true, change: "…" })` | Impact of current git diff |
| `graph_query({ seedId: "…" })` | Walk graph from a node |
| `index({})` | Refresh graph + translation queue |
| `index({ cocoindexSync: true })` | Refresh graph + translation queue + embeddings |
| `lang_queue({})` | Translation queue status |
| `cocoindex_status({})` | CocoIndex readiness check |
| `cocoindex_index({})` | Rebuild semantic embeddings |
| `docs_search({ query })` | Semantic doc search (CocoIndex) |
| `graph_query_fuzzy({ query })` | Natural language graph lookup (CocoIndex) |

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
