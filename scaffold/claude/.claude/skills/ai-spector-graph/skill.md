---
name: ai-spector-graph
description: "Runs AI Spector traceability graph operations: analyze data-source, index refresh, graph validate, impact and regen scope, visualize, semantic link-graph, knowledge. Use when the user asks to analyze sources, refresh or validate the graph, see impact of changes, visualize traceability, or re-index after edits."
---

# AI Spector — Graph

## When to use

- "analyze my data source", "build the knowledge graph"
- "validate the graph", "graph errors"
- "re-index", "sync the graph"
- "what's the impact of my changes", "what should I regenerate"
- "visualize the graph"

## Invocation rule

Use **MCP tools** when `ai-spector` server is configured. CLI is fallback only.

## Runbooks by intent

### Analyze (ingest data-source)

```
analyze({})                              # MCP — prepare graph scaffold
# agent extracts entities → writes knowledge.json
knowledge_validate({})                   # MCP — validate before merge
knowledge_status({})                     # MCP — confirm entity counts
graph_merge({ fromKnowledge: true })     # MCP — commit to graph
graph_validate({})                       # MCP — verify result
```

CLI fallback: `npx ai-spector analyze` → `npx ai-spector graph merge --from-knowledge` → `npx ai-spector graph validate`

### Index (refresh after doc edits)

```
index({ cocoindexSync: true })           # MCP — refresh graph + embeddings
```

CLI fallback: `npx ai-spector index && npx ai-spector cocoindex index`

**Always run index before checking translation status.**

### Validate

```
graph_validate({})                       # MCP
graph_report({})                         # MCP — layer health audit
```

CLI fallback: `npx ai-spector graph validate`

### Impact (what to regenerate)

```
graph_impact({ git: true, change: "content_change" })        # git diff
graph_impact({ originId: "<id>", change: "content_change" }) # specific node
graph_impact({ file: "<path>", change: "content_change" })   # specific file
```

CLI fallback: `npx ai-spector graph impact --git --change content_change --json`

Output buckets: `regenerate` (must redo), `review` (may need update), `semanticSuggestions` (CocoIndex).
- `noTraceabilityImpact: true` → changed files not in graph — no doc regen needed
- `truncated: true` → BFS hit cap — results may be incomplete, warn user

**Run after every doc edit**, then `index({ cocoindexSync: true })`.

### Query a node

```
graph_query({ seedId: "<id>" })          # MCP — walk subgraph
graph_query_fuzzy({ query: "…" })       # MCP — natural language lookup
```

CLI fallback: `npx ai-spector graph query <id> --json`

### Visualize

```bash
npx ai-spector graph visualize --open    # CLI only — no MCP equivalent
```

## Checklist

```
- [ ] Identified correct runbook
- [ ] Used MCP tools (not CLI) when ai-spector server is configured
- [ ] After doc edits: graph_impact + index({ cocoindexSync: true })
- [ ] Presented output to user (impact table, validate errors, etc.)
- [ ] On failure: showed output, offered fix/workaround
```

## Rules

- Do not implement impact BFS manually — always use MCP or CLI tool
- Do not invent regen lists if impact tool failed
- Do not run whole-repo regen outside tool buckets
- Never skip `cocoindexSync` when CocoIndex is configured and docs changed
