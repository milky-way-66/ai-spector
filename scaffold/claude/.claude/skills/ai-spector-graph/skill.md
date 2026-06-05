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

## Workflow

```
1. Identify intent → pick runbook below
2. Run CLI from project root (npx ai-spector)
3. On failure: show output, offer fix/workaround/pause
4. If the tool or workflow caused friction (even if recovered): offer to write a feedback report to docs/feedback/
```

## Runbooks by intent

### Analyze (ingest data-source)

```bash
npx ai-spector analyze
```

Reads `docs/data-source/`, builds knowledge graph, writes `.ai-spector/graph/`. Run after adding or changing source files.

### Index (refresh after doc edits)

```bash
npx ai-spector index
```

Updates fingerprints, reconciles translation queue. Run after any doc edit. **Always run index before checking translation status.**

### Validate

```bash
npx ai-spector graph validate
```

Reports broken references, missing nodes, DAG errors. Fix errors before generating docs.

### Impact (what to regenerate)

```bash
# Current git diff (most common)
npx ai-spector graph impact --git --change content_change --json

# Specific file
npx ai-spector graph impact --file <repo-relative-path> --json

# Specific node
npx ai-spector graph impact <originId> --change content_change --json
```

Output buckets: `regenerate` (must redo), `review` (may need update).
- `noTraceabilityImpact: true` → changed files not in graph (config, source code, etc.) — no doc regen needed
- `truncated: true` → BFS hit propagation cap — results may be incomplete, warn user

Report the table with `projectionPath`. For each `regenerate` entry, suggest the appropriate generate skill.

**Run this after every doc edit**, then run `npx ai-spector index`.

### Visualize

```bash
npx ai-spector graph visualize --open
```

### Query a node

```bash
npx ai-spector graph query <id-or-text> --json
```

## Checklist

```
- [ ] Identified correct runbook
- [ ] Ran CLI from project root
- [ ] Presented output to user (impact table, validate errors, etc.)
- [ ] After doc edits: ran impact + index
- [ ] On failure: showed output, offered fix/workaround
```

## Rules

- Do not implement impact BFS manually — always use CLI
- Do not invent regen lists if impact CLI failed
- Do not run whole-repo regen outside CLI buckets
