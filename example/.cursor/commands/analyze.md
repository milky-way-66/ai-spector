# /analyze

Ingest `docs/data-source/` and commit knowledge into the traceability graph.

**User runs this command only.** The agent runs all CLI steps below — see [_workflow.md](./_workflow.md).

## Usage

- `/analyze` — default root `docs/data-source`
- `/analyze <path1> ...` — override inputs

## Prerequisites

1. **`npx ai-spector init`** was run once (project scaffold exists).
2. `docs/data-source/` has at least one real input file.

**On success, suggest:** `/visualize-graph` (optional) → `/validate-graph` → `/generate-srs`.

## Required Behavior

### 0. Prepare graph structure (CLI — agent runs first)

```bash
ai-spector analyze
```

Creates section/document nodes from templates. Do not ask the user to run this separately.

### A. Extract (Graphify MCP)

1. Load `data-source.json`, `analyze.graphify.json`.
2. Resolve paths → `scope.json` → `sources`.
3. Build/update Graphify index for that scope.
4. Query / fallback to extract:
   - actors, useCases, features, functionalRequirements, nfrs, entities, interfaces, constraints, openQuestions
5. Persist staging:
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

## If blocked

Reply with what failed (CLI exit code, validate errors, or missing Graphify). Do not continue to `/generate-srs`.
