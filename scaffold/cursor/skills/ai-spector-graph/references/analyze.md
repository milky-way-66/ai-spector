# Task: analyze

Ingest `docs/data-source/` and commit knowledge into the traceability graph.

All steps have MCP equivalents. Use MCP when the `ai-spector` server is configured.

## Usage

- Default root: `docs/data-source`
- User may name other paths in chat — use those as inputs

## Prerequisites

1. **`npx ai-spector init`** was run once (project scaffold exists).
2. `docs/data-source/` has at least one real input file.

**On success:** if no SRS documents exist yet (`index` report shows `srs: —`), **stop here** — report that analysis is done and suggest `/generate-srs`. Otherwise suggest: visualize graph (optional) → validate graph.

## Required Behavior

### 0. Prepare graph structure

**MCP (preferred):**
```
index({})
```

**CLI fallback:**
```bash
npx ai-spector index
```

Creates section/document nodes from templates. Do not ask the user to run this separately.

### A. Extract from markdown sources

1. Load `data-source.json` to resolve the data-source root (default: `docs/data-source/`).
2. **Read all markdown files** under that root directly — each file is well-structured markdown with headings, tables, and labeled fields.
3. Extract the following entities, mapping them to their canonical ids and fields:

| Entity | `id` | Required fields | Links |
|--------|------|-----------------|-------|
| use case | `UC-01` | `title` | — |
| feature | `F-01` | `title` | `satisfies`: `["UC-01"]` |
| actor | `actor.customer` | `name` or `title` | — |
| functional requirement | `FR-01` | `title` | `tracesTo` optional |
| NFR | `NFR-01` | `title` | — |
| data entity | `ENT-Order` | `name` | — |

4. Persist staging (canonical for AI Spector):
   - `.ai-spector/.docflow/analysis/knowledge.json` (schema: `schemas/schema.knowledge.json`)
   - `.ai-spector/.docflow/analysis/gaps.json`
   - `.ai-spector/.docflow/analysis/scope.json`

### B. Commit to graph

Re-run index — it merges `knowledge.json` into the graph and validates in one pass:

**MCP (preferred when ai-spector server is configured):**

```
index({})
```

**CLI fallback:**

```bash
npx ai-spector index
```

Optional for the user:

```bash
npx ai-spector graph visualize --open
```

### C. State

Update `state.json`: `analysis.lastRunAt`, `analysis.dataSource`, scope hash. Merge sets `analysis.graphMergedAt`.

## Success Criteria

- `npx ai-spector graph validate` passes with domain nodes (`useCase`, `feature`, …) anchored to sections.
- `knowledge.json` mirrors extract; graph is authoritative for `/generate-srs`.
- Gaps recorded in `gaps.json`.

## Steps — stop on first failure

| Step | MCP (preferred) | CLI fallback |
|------|-----------------|--------------|
| 0 prepare | `index({})` | `npx ai-spector index` |
| A extraction | Agent writes `knowledge.json` | Agent writes `knowledge.json` |
| A verify | `knowledge_status({})` → check `ready: true` | *(no CLI)* |
| A validate | `knowledge_validate({})` → check `valid: true` | *(no CLI)* |
| B index (merge + validate) | `index({})` | `npx ai-spector index` |

If any step fails, **pause** and use [cli-failures.md](../../ai-spector/references/cli-failures.md). Do not skip to generate SRS without user choice.

## If blocked

Use the **Blocked** template in [cli-failures.md](../../ai-spector/references/cli-failures.md). Include which step failed, exit code, verbatim CLI output, fix steps, and **1 / 2 / 3** choices.

**Do not:** hand-edit the full graph, generate SRS, or read all of `docs/srs/` as a workaround.
