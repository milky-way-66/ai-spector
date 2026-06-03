# Task: sync-graph

Reconcile **disk projections** (`docs/srs/`, etc.) with **graph nodes** — add missing `document` nodes, `rendersTo` edges, detect orphans.

## Usage

- `/sync-graph`
- `/sync-graph docs/srs`

## When to run

- **Repair** when `/generate-srs` skipped per-file `graph merge` ingest
- After manual edits to markdown outside `/generate-*`
- Before `/validate-graph` when files exist but graph lacks `document` nodes
- After bulk import of SRS files

**Preferred during SRS generation:** per-file `graph merge` with `projection-patch.json` (see [generate-graph.md](../../ai-spector/references/generate-graph.md)) — not batch sync at the end.

## Required Behavior

1. Load `traceability.graph.json` + `section-registry.json`.
2. Glob projection roots (`docs/srs/**/*.md`, etc.).
3. For each file:
   - Match to `document` node by `output` path; if missing, create `document` + link sections from registry where possible.
   - Add **`rendersTo`** from document (or primary section) → file path.
4. For each graph `document` with `output` missing on disk → mark orphan in report (do not delete nodes without user confirm).
5. Run **`npx ai-spector graph validate`**.
6. Summarize: added nodes, added edges, orphans, stale projections.

## Guardrails

- Do not remove domain nodes without explicit user request.
- Preserve stable ids (`UC-01`, `sec.*`) when linking new files.
