# Active worker status (orchestrator)

Optional observability for subagent routing. Persisted under `.ai-spector/.docflow/`.

## MCP

```text
workflow_status({})
```

Returns:

```json
{
  "active": {
    "workflowId": "doc-review",
    "phase": "reviewing",
    "displayLabel": "doc-review (reviewing srs/01-overview)",
    "context": { "logicalPath": "srs/01-overview" }
  },
  "statusLine": "Active worker: doc-review (reviewing srs/01-overview)",
  "recentTransitions": [...]
}
```

## Orchestrator behavior

1. At session start (or after routing), call `workflow_status` and show `statusLine` once if `active` is set.
2. After `workflow_route` with `handoff`, active state is updated automatically.
3. Review session phase changes (`review_check`, `review_queue`, `review_status`, …) update active worker via `.session.json` hooks.
4. `review_approve` / `review_reject` clears active doc-review worker.

## Cursor status line (optional)

In Cursor Settings → Status Line, you can reference project context. Simpler approach: orchestrator prefixes replies when `workflow_status.active` exists:

> **Active worker:** doc-review (reviewing srs/01-overview)

Files:

| Path | Purpose |
|------|---------|
| `workflow-active.json` | Current worker + phase |
| `workflow-log.jsonl` | Recent transitions (tail) |

Design: [../../docs/subagent-routing-design.md](../../docs/subagent-routing-design.md)
