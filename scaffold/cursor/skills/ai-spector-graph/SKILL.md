---
name: ai-spector-graph
description: >-
  Runs AI Spector traceability graph operations: analyze data-source, index refresh, graph validate,
  impact and regen scope, visualize, semantic link-graph, knowledge.json. Use when
  the user asks to analyze sources, refresh or validate the graph, see impact of changes, visualize
  traceability, or re-index after edits. Do not use for writing SRS, basic design, or HTML prototype content.
paths:
  - ".ai-spector/graph/**"
  - ".ai-spector/.docflow/**"
  - "docs/data-source/**"
  - "docs/srs/**"
  - "docs/basic-design/**"
---

# AI Spector — Graph

**Core:** [../ai-spector/SKILL.md](../ai-spector/SKILL.md) · **Workflow:** [../../WORKFLOW.md](../../WORKFLOW.md)

## When this skill applies

Read **one** runbook under `references/` for the user’s intent, then execute it end-to-end:

| Intent | Runbook |
|--------|---------|
| Analyze / ingest data-source | [references/analyze.md](references/analyze.md) |
| Refresh graph after doc edits | [references/index.md](references/index.md) |
| Validate graph | [references/validate-graph.md](references/validate-graph.md) |
| Impact / what to regenerate | [references/impact.md](references/impact.md) |
| Visualize in browser | [references/visualize-graph.md](references/visualize-graph.md) |
| Semantic relatesTo links | [references/link-graph.md](references/link-graph.md) |
| Repair graph from registry | [references/sync-graph.md](references/sync-graph.md) |
| Human doc summaries | [references/summary.md](references/summary.md) |

## Checklist

```
- [ ] Matched runbook read completely
- [ ] MCP first (ai-spector server) → CLI fallback (npx ai-spector) — see ai-spector/SKILL.md#invocation-rule
- [ ] On failure: pause; offer fix / workaround / pause per ai-spector/references/cli-failures.md
```

## Shared references

- [../ai-spector/references/cli-reference.md](../ai-spector/references/cli-reference.md) — full CLI options + examples
- [../ai-spector/references/graph.md](../ai-spector/references/graph.md)
- [../ai-spector/references/generate-graph.md](../ai-spector/references/generate-graph.md)
- [references/graph-commands.md](references/graph-commands.md)
