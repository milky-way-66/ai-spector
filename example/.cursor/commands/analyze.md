# /analyze

Ingest `docs/data-source/` and **commit knowledge into the traceability graph** via CLI merge. Graphify extracts entities; the graph remains the source of truth.

## Usage

- `/analyze` — default root `docs/data-source`
- `/analyze <path1> ...` — override inputs

## Prerequisites

1. **`ai-spector analyze`** (CLI) — section/document structure already in `traceability.graph.json`.
2. `docs/data-source/` exists with at least one real input file.

**On success, suggest next:** `/validate-graph` → `/generate-srs`. See [_graph.md](./_graph.md).

## Required Behavior

### A. Extract (Graphify MCP)

1. Load `data-source.json`, `analyze.graphify.json`.
2. Resolve paths → record in `scope.json` → `sources`.
3. Build/update Graphify index for that scope.
4. Query / fallback to extract:
   - actors, useCases, features, functionalRequirements, nfrs, entities, interfaces, constraints, openQuestions
5. Persist staging (for review and merge):
   - `.ai-spector/.docflow/analysis/knowledge.json` — **required shape** (see `schemas/schema.knowledge.json` in package)
   - `.ai-spector/.docflow/analysis/gaps.json`
   - `.ai-spector/.docflow/analysis/scope.json`
6. Optional: write normalized patch for review:
   - `ai-spector graph merge --from-knowledge --write-patch .ai-spector/.docflow/extract/patch.json --dry-run`

### B. Commit to graph (CLI — do not hand-edit graph JSON)

7. Run from project root:

```bash
ai-spector graph merge --from-knowledge
ai-spector graph validate
```

Or merge a patch file directly:

```bash
ai-spector graph merge .ai-spector/.docflow/extract/patch.json
```

**`knowledge.json` fields (minimum):**

| Entity | `id` | `title` / `name` | `listedInSection` (optional) | Links |
|--------|------|------------------|------------------------------|-------|
| use case | `UC-01` | required | defaults to §3.2 list section | — |
| feature | `F-01` | required | defaults to §4.2 list section | `satisfies`: `["UC-01"]` |
| actor | `actor.customer` | `name` or `title` | defaults to §2.2 user classes | — |
| requirement | `REQ-01` | required | section id | `tracesTo` optional |
| entity | `ENT-Order` | `name` | defaults to §5.2 logical model | — |

Omit `listedInSection` to use bundled defaults (registry section ids).

### C. State

8. CLI merge sets `state.json` → `analysis.graphMergedAt`. Also set `analysis.lastRunAt`, `analysis.dataSource`, scope hash in `/analyze`.

## Success Criteria

- Graphify scope is current.
- **`ai-spector graph validate` passes** with domain nodes (`useCase`, `feature`, …) anchored via `listedIn` / `describedIn` / `definedIn`.
- `knowledge.json` mirrors extract (staging); graph is authoritative for `/generate-srs`.
- Gaps explicit in `gaps.json`.

## Why graph + merge CLI

| `knowledge.json` | `traceability.graph.json` |
|------------------|---------------------------|
| Staging / human review | **Canonical store** |
| Flat lists | Structure + traceability + **neighbors for context** |
| Input to `graph merge` | Powers `/generate-*` and `graph impact` |
