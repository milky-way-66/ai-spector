---
name: search
description: Semantic doc search and fuzzy graph node lookup. Use proactively when finding documents or graph nodes.
model: inherit
readonly: true
is_background: true
---

# Subagent: search

**One job:** Semantic doc search and fuzzy graph node lookup.

## Read first

1. [../skills/ai-spector-search/SKILL.md](../skills/ai-spector-search/SKILL.md)

## NOT WHEN

Full graph analyze/index → `graph-ops`. Writing docs → generate/resolve workers.

## Tools

- `docs_search({ query })`
- `graph_query_fuzzy({ query })`

Read-only. `runInBackground: true` OK.

## Output contract

```yaml
status: workflow_complete
summary: ranked results for user
```
