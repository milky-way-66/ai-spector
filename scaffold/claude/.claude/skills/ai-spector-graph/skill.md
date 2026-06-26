---
name: ai-spector-graph
description: >-
  Traceability graph operations: analyze data-source, index refresh, graph validate, impact,
  visualize, semantic search (CocoIndex), natural language graph lookup, doc summaries, and
  layer sync audit (design drift since baseline). Use when the user asks to analyze sources,
  refresh or validate the graph, see impact, visualize traceability, find docs by concept,
  or check doc drift since baseline. Do not use for writing SRS, basic design, HTML prototype,
  or formal document sign-off.
---

# AI Spector — Graph

**Core:** [../ai-spector/skill.md](../ai-spector/skill.md) · **Workflow:** [../../WORKFLOW.md](../../WORKFLOW.md)

## Route by intent

Read **one** runbook section for the user's intent, then execute it end-to-end:

| Intent | Runbook section |
|--------|-----------------|
| Analyze / ingest data-source | [references/analyze.md](references/analyze.md) |
| Refresh graph after doc edits | [references/index.md](references/index.md) |
| Validate graph | [references/validate-graph.md](references/validate-graph.md) |
| Impact / what to regenerate | [references/impact.md](references/impact.md) |
| Visualize in browser | [references/visualize-graph.md](references/visualize-graph.md) |
| Semantic relatesTo links | [references/link-graph.md](references/link-graph.md) |
| Repair graph from registry | [references/sync-graph.md](references/sync-graph.md) |
| Human doc summaries | [references/summary.md](references/summary.md) |
| Semantic search / find docs by concept | [references/search.md](references/search.md) |
| Layer sync audit / design drift | [references/sync-audit.md](references/sync-audit.md) |

## Checklist

```
- [ ] Matched runbook section read completely
- [ ] MCP first (ai-spector server) → CLI fallback (npx ai-spector) — see ai-spector/skill.md
- [ ] On failure: pause → report → fix per ai-spector/references/cli-failures.md
- [ ] No .docops/guide/ links
```

## Shared references

- [../ai-spector/references/cli-reference.md](../ai-spector/references/cli-reference.md)
- [../ai-spector/references/graph.md](../ai-spector/references/graph.md)
- [../ai-spector/references/generate-graph.md](../ai-spector/references/generate-graph.md)
- [references/graph-commands.md](references/graph-commands.md)
