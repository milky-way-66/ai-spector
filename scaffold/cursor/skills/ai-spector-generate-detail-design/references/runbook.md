# Generate detail design

Generate detail design markdown **from the traceability graph**, SRS, and basic design.

**User runs this command;** the agent runs CLI.

| Shared workflow | Document |
|-----------------|----------|
| Scope cases, waves, merge, guardrails | [generate-workflow.md](../../ai-spector/references/generate-workflow.md) |
| Graph query + ingest | [generate-graph.md](../../ai-spector/references/generate-graph.md) |

## Prerequisites

- `ai-spector graph validate` passes
- SRS + basic design minimum on disk (`workflow.dependencies.json` → `generate-detail-design`)

## Config

- `dag.detail-design.json`
- `dag.detail-design.graph-seeds.json` (if present)
- `completeness-rules.detail-design.json`

Templates: `.ai-spector/templates/detail_design/`

## Intent → DAG hints

Use `dag.detail-design.json` + graph `feature` nodes. Common phrases:

| User phrase | Typical outputs |
|-------------|-----------------|
| feature detail, implementation spec | per-feature files under `docs/detail-design/` |
| architecture overview, deployment, error handling | shared chapters per DAG |
| one feature, checkout | that feature’s detail doc only — case 2 |

Case 3 confirmation: [generate-workflow.md](../../ai-spector/references/generate-workflow.md) § Case 3.

## Required behavior

Follow [generate-workflow.md](../../ai-spector/references/generate-workflow.md) (plan → waves → per-target query/write/merge/validate).

1. **Gate** — `ai-spector graph validate`
2. **Plan** — load `dag.detail-design.json`; build waves; map seeds from graph-seeds config
3. **Per target** — seed = `feature` id or detail `document` node:

```bash
ai-spector graph query <seed> --direction both --depth 3 --json
```

4. Load SRS + basic-design paths from `projectionPaths` only (no full `docs/` glob)
5. Read template; write; merge `rendersTo` + `dependsOn`; validate per wave
6. **Finish** — `ai-spector index` if command scope touched many files; suggest `/summary` when workflow lists it

## Guardrails

- Same wave / merge / validate rules as [generate-workflow.md](../../ai-spector/references/generate-workflow.md)
- Do not read all of `docs/` manually when CLI failed — [cli-failures.md](../../ai-spector/references/cli-failures.md)

## If blocked

Fix validate/query errors; ensure basic design exists. Re-run **`/generate-detail-design`**.
