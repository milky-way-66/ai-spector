---
name: ai-spector-graph
description: >-
  AI Spector graph operations — analyze docs/data-source, index refresh, validate traceability graph,
  impact/regen scope, visualize graph, link semantic edges. Use for /analyze, /index, /validate-graph,
  /impact, /visualize-graph, or when user asks about traceability graph, knowledge.json, Graphify, or what to regenerate.
---

# AI Spector — Graph

**Core rules:** `.cursor/skills/ai-spector/SKILL.md` (CLI failure, graph path).

## Route to command doc

| Trigger | Read first | CLI |
|---------|------------|-----|
| `/analyze`, ingest data-source, extract knowledge | `commands/analyze.md` | `ai-spector analyze` → graphify → merge → validate |
| `/index`, refresh graph after edits | `commands/index.md` | `ai-spector index` |
| `/validate-graph`, graph errors | `commands/validate-graph.md` | `ai-spector graph validate` |
| `/impact`, what breaks, regen scope, git diff impact | `commands/impact.md` | `ai-spector graph impact … --json` |
| `/visualize-graph`, explore graph in browser | `commands/visualize-graph.md` | `ai-spector graph visualize --open` |
| `/link-graph`, semantic relatesTo edges | `commands/link-graph.md` | `graph merge --semantic` |
| `/sync-graph` | `commands/sync-graph.md` | per command |
| `/summary` (index summaries only) | `commands/summary.md` | index build under `.ai-spector/index/` |

## Natural language → command

| User says | Action |
|-----------|--------|
| "analyze my data source", "run analyze" | `/analyze` flow → `analyze.md` |
| "refresh the graph", "re-index" | `/index` → `index.md` |
| "validate graph", "graph has errors" | `/validate-graph` |
| "what's the impact", "what do I need to regenerate" | `/impact` → `impact.md` |
| "show the graph", "visualize traceability" | `/visualize-graph` |

## References

- Graph CLI details: `commands/_graph.md`
- Generate graph patches: `commands/_generate-graph.md`
