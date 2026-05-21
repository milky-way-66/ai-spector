# Workflow prerequisites (shared)

User workflow: [**_workflow.md**](./_workflow.md). Agent CLI details: [**_graph.md**](./_graph.md).

Load `.ai-spector/.docflow/config/workflow.dependencies.json` for the active step.

## When checks fail

1. **Stop immediately** — do not read templates, spawn subagents, or write outputs.
2. Reply using the format in each command’s **If blocked** section.

## Graph-first context (primary)

When `traceability.graph.json` has domain nodes for the task:

1. Run **`ai-spector graph validate`** (or stop on errors).
2. For each generation target: **`ai-spector graph query <seedId> --json`** per [_graph.md](./_graph.md).
3. Open **only** `projectionPaths` from CLI JSON — not whole `docs/` trees.

**Index fallback:** Use `.ai-spector/index/*.md` only when the graph lacks domain nodes or neighbors return an empty subgraph. After generate, prefer updating the graph over relying on index alone.

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
| `graph-merged` | `state.json` → `analysis.graphMergedAt` is set ( `/analyze` committed domain nodes) |

Agent should also verify at least one `useCase` or `feature` node in the graph before `/generate-srs`; block with “run `/analyze` and merge into graph” if only section shells exist.

## Stale warnings

- **Data source** newer than `analysis.lastRunAt` → suggest `/analyze`.
- **Projections** changed but graph not updated → suggest `/sync-graph` or manual `rendersTo` edges.
- **Index** stale → warn; graph neighbors remain primary when graph is populated.
