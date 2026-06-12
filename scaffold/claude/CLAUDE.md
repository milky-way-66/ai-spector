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
| **Analyze data-source** | *(agent step — read `docs/data-source/`, write `analysis/knowledge.json`, then `index({})`)* | — |

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
| Prepare graph scaffold | `index({})` | `npx ai-spector index` |
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
| Add/update feature or section ("I want to add…") | `ai-spector-resolve-task` (plan-first — no impact/edits before approval) |
| Generate SRS / basic design (full chapter) | `ai-spector-generate-srs` / `ai-spector-generate-basic-design` |

## Quick reference

### MCP tools (prefer these)

| Tool | Purpose |
|------|---------|
| `knowledge_status({})` | Check knowledge.json entity counts |
| `knowledge_validate({})` | Validate knowledge.json schema |
| `graph_merge({ fromKnowledge: true })` | Merge knowledge.json into graph |
| `graph_validate({})` | Check graph integrity |
| `graph_report({})` | Graph layer health audit |
| `graph_impact({ git: true, change: "…" })` | Impact of current git diff |
| `graph_query({ seedId: "…" })` | Walk graph from a node |
| `index({})` | Full index pipeline: graph structure, knowledge merge, SRS/basic-design body extract, doc indexes, translation queue. Report includes `sources` + `nextAction` |
| `index({ cocoindexSync: true })` | Refresh graph + translation queue + embeddings |
| `lang_queue({})` | Translation queue status |
| `cocoindex_status({})` | CocoIndex readiness check |
| `cocoindex_index({})` | Rebuild semantic embeddings |
| `docs_search({ query })` | Semantic doc search (CocoIndex) |
| `graph_query_fuzzy({ query })` | Natural language graph lookup (CocoIndex) |
| `resolve_task({ intent, goalSpec, plan })` | Execute an approved task plan (index, graph_merge, etc.) |
| `workspace_check({ fix? })` | Structural workspace check (dirs, config, languages, stale clarifications). Errors block generate runs and pre-commit |
| `context_list({ docType?, status? })` | List stored clarifications (open / answered / stale) |
| `context_record({ docType, question, answer?, sourceRefs? })` | Record a clarification (answer optional — one step if known) |
| `context_resolve({ docType, id, answer })` | Answer an open/stale clarification |
| `spec_list({ docType?, status? })` | Extracted-spec review queue |
| `spec_record({ docType, specs })` | Queue extracted key specs (pending) after a generate run |
| `spec_approve({ docType, id })` | Approve a spec — merges its graph patch (validated) |
| `spec_reject({ docType, id, note? })` | Reject a spec (kept for audit, never merged) |

### CLI (fallback / MCP-unavailable or no tool equivalent)

```bash
npx ai-spector index                # fallback for index({})
npx ai-spector graph validate       # fallback for graph_validate({})
npx ai-spector graph impact --git --json   # fallback for graph_impact({ git: true })
npx ai-spector lang queue pending --json   # pending translation jobs
npx ai-spector setup --check        # audit project setup
npx ai-spector template list        # list installed packs + active
npx ai-spector template scan <path> # scan a template folder → scan-result.json
npx ai-spector template install     # install pack from staging (AI writes manifest first)
npx ai-spector template use <name>  # switch active pack (use "builtin" to revert)
npx ai-spector resolve-task plan.json   # execute approved task plan

# CocoIndex (opt-in — requires Python 3.11+)
npx ai-spector cocoindex setup      # scaffold pipeline into project
npx ai-spector cocoindex index      # run pipeline (update embeddings)
```

On MCP tool or CLI failure: show the output, offer fix / workaround / pause. Do not invent results.

## Pipeline order

The entry point is **index**. Run `index({})` and follow the report's `sources` / `nextAction`:

```
index
  → data-source files present, knowledge not extracted?
      analyze (agent: read docs/data-source/, write analysis/knowledge.json) → index again
  → SRS exists?          indexed by the same run
  → basic design exists? indexed by the same run
  → no SRS yet?          STOP — report analysis done; wait for user to ask "generate SRS"

generate SRS (gated) → index → validate graph → spec review (spec_approve → graph merge)
  → generate basic design (gated) → index
  → generate detail design
  → prototype setup → generate HTML screens
```

### Gated generation (mandatory for every generate run)

```
1. CHECK     workspace_check({}) — stop on errors
2. CLARIFY   resolve ALL missing info (context_list open/stale → ask → context_record/resolve)
3. BRIEFING  state exactly which sources, graph nodes, Q-xxx answers, and assumptions
             will shape each document → user confirms
4. PLAN      plan table (output × sources × key points) → explicit "yes" before any write
5. GENERATE  DAG waves
6. EXTRACT   key specs → spec_record → human review queue (never docs/data-source/)
```

No auto-confirm and no question cap: generation never starts while a clarification
gap is unanswered and unaccepted, and never before the user approves the plan.
