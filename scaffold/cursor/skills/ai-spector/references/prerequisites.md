# Workflow prerequisites (shared)

User workflow: [**_workflow.md**](./_workflow.md). **CLI failures:** [**cli-failures.md**](./cli-failures.md). Agent CLI: [**_graph.md**](./_graph.md).

Load `.ai-spector/.docflow/config/workflow.dependencies.json` for the active step.

## When checks fail

1. **Stop immediately** — do not read `.ai-spector/templates/`, spawn subagents, or write outputs.
2. Reply with the **Blocked** format in [cli-failures.md](./cli-failures.md) (include full CLI output).
3. Help the user fix the issue; re-run the failed CLI; then continue the slash command.

## Graph context (only after CLI succeeds)

1. **`ai-spector graph validate`** — exit 0 required before generate.
2. Per target: **`ai-spector graph query <seedId> --json`** — parse JSON; use `projectionPaths` and `nodes`.
3. Open **only** those paths (+ targeted `docs/data-source/**` if still insufficient).

**If validate or query fails:** follow [cli-failures.md](./cli-failures.md) — do **not** fall back to index or full-tree reads.

**If query succeeds but has no domain nodes:** tell the user; suggest **`/analyze`** — still no `docs/srs/**` glob.

## Check types

| type | Pass when |
|------|-----------|
| `pathExists` | Path exists on disk |
| `hasFiles` | At least `min` files matching `glob` under `path` |
| `stateNotNull` | `state.json` field is non-null |
| `jsonAnyNonEmpty` | JSON file exists; listed keys non-empty |
| `allPathsExist` | Every path in `paths` exists |
| `indexPopulated` | Index has `## File:` entries, no placeholder markers |
| `indexPopulatedIfSourceHasFiles` | Conditional index check |

## Graph checks (generate steps)

| id | Pass when |
|----|-----------|
| `graph-file` | `.ai-spector/graph/traceability.graph.json` exists |
| `graph-merged` | `state.json` → `analysis.graphMergedAt` is set |

If only section shells (no `useCase`/`feature`): **block** with fix steps → **`/analyze`**, not manual SRS from index.

## Stale warnings (not failures)

- Data source newer than `analysis.lastRunAt` → suggest `/analyze`.
- Projections changed → suggest `/sync-graph` after validate passes.
- Index stale → warn only; graph query remains primary when domain nodes exist.
