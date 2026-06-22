# Graph — Docops Module Guide

## Native config (Writer)

Enable with `capabilities.graph: true` in `.docops/docops.config.json`.

Writer reads `.docops/adapters/graph.json` when present:

```json
{
  "schemaVersion": "1.0",
  "artifacts": {
    "nodes": ".ai-spector/graph/nodes.json",
    "edges": ".ai-spector/graph/edges.json"
  }
}
```

Paths in `artifacts` are repo-relative. Writer does not compute the graph — it displays pre-built artifacts.

If `graph` is `true` but adapter file or artifacts are missing, Writer hides the graph UI and logs a warning.

## Custom adapter

ai-spector graph plugin or a custom tool:

1. Writes `nodes.json` / `edges.json` (or paths declared in adapter config)
2. Updates `.docops/adapters/graph.json` to point at artifacts
3. Sets `capabilities.graph: true`

Set `capabilities.graph: false` when traceability graph is not used.
