# /generate-basic-design

Basic design from graph-selected SRS context. **User runs this command;** agent runs CLI. [_workflow.md](./_workflow.md), [_graph.md](./_graph.md).

## Prerequisites

Graph merged + `ai-spector graph validate`. Minimum SRS on disk.

## Required Behavior

1. `ai-spector graph validate`
2. Resolve seed: target **`feature`** id `F-xx` (from file arg or DAG).
3. Per seed:

```bash
ai-spector graph query F-xx --direction both --depth 3 --json
```

4. Load only `projectionPaths` + referenced sources from JSON.
5. Generate; update graph edges (`tracesTo` / `references`); `ai-spector graph validate`.

Index (`.ai-spector/index/srs.md`) — fallback only if query returns empty subgraph.
