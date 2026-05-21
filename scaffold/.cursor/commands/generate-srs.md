# /generate-srs

Generate SRS projections. **User runs this command;** agent runs CLI (`graph validate`, `graph query`, …). See [_workflow.md](./_workflow.md).

## Usage

- `/generate-srs` | `/generate-srs <file>`

## Prerequisites

`workflow.dependencies.json` → `generate-srs`. Block if `analysis.graphMergedAt` missing or **`ai-spector graph validate`** fails.

## Required Behavior

### 1. Gate

```bash
ai-spector graph validate
```

### 2. Plan targets

DAG + scan `docs/srs/` (`good` | `missing_content` | `missing_file`). Map each target to graph **seed** id.

### 3. Context per target (CLI — mandatory)

```bash
ai-spector graph query <seedId> --direction both --depth 3 --json
```

Parse JSON:

- Load **only** `projectionPaths`
- Use `nodes` / `edges` for UC/F text and relationships
- Supplement `docs/data-source/**` only when query + graph nodes are insufficient

**Forbidden:** manual graph traversal; glob `docs/srs/**` when query failed or validate failed.

### If `graph validate` or `graph query` fails

Stop immediately. Report via [_cli-failures.md](./_cli-failures.md). Do not generate SRS from index or folder-wide reads.

### 4. Generate + update graph

Fill templates; write files; add `rendersTo` / domain nodes; then:

```bash
ai-spector graph validate
```

### 5. State + logs

Update `state.json`, run log, Graphify sync if configured.

## Guardrails

- CLI `graph query` for every target seed — on failure, stop and help user fix (see _cli-failures.md).
- Never overwrite `good` without force.
- Final `graph validate` must pass; if not, show errors and do not claim success.

## If blocked

Use [_cli-failures.md](./_cli-failures.md). User re-runs **`/generate-srs`** after validate/query succeed.
