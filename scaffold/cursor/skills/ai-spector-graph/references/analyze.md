# Task: analyze

Ingest `docs/data-source/` and commit knowledge into the traceability graph.

The agent runs all CLI steps below — see [WORKFLOW.md](../../WORKFLOW.md).

## Usage

- Default root: `docs/data-source`
- User may name other paths in chat — use those as inputs

## Prerequisites

1. **`npx ai-spector init`** was run once (project scaffold exists).
2. `docs/data-source/` has at least one real input file.

**On success, suggest:** visualize graph (optional) → validate graph → generate SRS.

## Required Behavior

### 0. Prepare graph structure (CLI — agent runs first)

```bash
ai-spector analyze
```

Creates section/document nodes from templates. Do not ask the user to run this separately.

### A. Extract (semantic-first; Graphify sidecar)

1. Load `data-source.json`, `analyze.graphify.json`.
2. **Graphify paths (from `ai-spector init`):**
   - Output dir: `.ai-spector/.docflow/graph/graphify-out` (`GRAPHIFY_OUT`)
   - Graph file: `.ai-spector/.docflow/graph/graphify-out/graph.json` (MCP + queries use `--graph` only on `graphify query`, not on `update`)
3. **Code ingest sidecar (CLI — agent runs):**

```bash
ai-spector graphify update
```

This runs `graphify update docs/data-source` with `GRAPHIFY_OUT` set. **Forbidden:** `graphify update … --graph …` (`unknown option: --graph`).

Fallback if needed:

```bash
GRAPHIFY_OUT=.ai-spector/.docflow/graph/graphify-out graphify update docs/data-source
```

The command removes stale `docs/data-source/graphify-out/` if Graphify created it by mistake.

4. **Semantic extract (Graphify MCP)** — query profiles in `analyze.graphify.json`; use graph at `graphJsonPath` for `graphify query "…" --graph .ai-spector/.docflow/graph/graphify-out/graph.json`.
5. Resolve paths → `scope.json` → `sources`.
6. Query / fallback to extract:
   - actors, useCases, features, functionalRequirements, nfrs, entities, interfaces, constraints, openQuestions
7. Persist staging (canonical for AI Spector):
   - `.ai-spector/.docflow/analysis/knowledge.json` (see package `schemas/schema.knowledge.json`)
   - `.ai-spector/.docflow/analysis/gaps.json`
   - `.ai-spector/.docflow/analysis/scope.json`

### B. Commit to graph (CLI — agent runs; no hand-edited graph JSON)

```bash
ai-spector graph merge --from-knowledge
ai-spector graph validate
```

Optional for the user:

```bash
ai-spector graph visualize --open
```

Or suggest **`/visualize-graph`**.

**`knowledge.json` minimum fields:**

| Entity | `id` | `title` / `name` | `listedInSection` (optional) | Links |
|--------|------|------------------|------------------------------|-------|
| use case | `UC-01` | required | defaults to §3.2 list section | — |
| feature | `F-01` | required | defaults to §4.2 list section | `satisfies`: `["UC-01"]` |
| actor | `actor.customer` | `name` or `title` | defaults to §2.2 user classes | — |
| requirement | `REQ-01` | required | section id | `tracesTo` optional |
| entity | `ENT-Order` | `name` | defaults to §5.2 logical model | — |

### C. State

Update `state.json`: `analysis.lastRunAt`, `analysis.dataSource`, scope hash. Merge sets `analysis.graphMergedAt`.

## Success Criteria

- `ai-spector graph validate` passes with domain nodes (`useCase`, `feature`, …) anchored to sections.
- `knowledge.json` mirrors extract; graph is authoritative for `/generate-srs`.
- Gaps recorded in `gaps.json`.

## CLI steps — stop on first failure

Run in order. If any step fails, **stop** and use [cli-failures.md](../../ai-spector/references/cli-failures.md) (show full CLI output + fix steps). Do not skip to merge, validate, or `/generate-srs`.

| Step | Command |
|------|---------|
| 0 | `ai-spector analyze` |
| B | `ai-spector graph merge --from-knowledge` |
| B | `ai-spector graph validate` |

Graphify indexing is **sidecar** for code-aware context. Markdown-only or empty sources may skip Graphify and continue.
Only block if semantic extract / `knowledge.json` generation fails.

## If blocked

Use the **Blocked** template in [cli-failures.md](../../ai-spector/references/cli-failures.md). Include which step failed, exit code, verbatim CLI output, what it means, and how to fix. Offer to apply small fixes (e.g. one bad `listedInSection`) then re-run the same step.

**Do not:** hand-edit the full graph, generate SRS, or read all of `docs/srs/` as a workaround.
