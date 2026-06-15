---
name: ai-spector-search
description: >-
  Semantic search over project documentation using CocoIndex. Use when the user
  asks to find sections about a concept, when graph_query returns no results for
  a node ID, or when you need to find all docs related to a topic across the
  entire project. Requires CocoIndex to be set up (npx ai-spector cocoindex setup).
---

# AI Spector — Semantic Search
**Core:** [../ai-spector/skill.md](../ai-spector/skill.md)

CocoIndex adds **semantic proximity** on top of the formal traceability graph.
Use it when you know the concept but not the exact node ID, or when you want to
surface related docs that have no formal graph edge.

## When this skill applies

| User intent | Workflow |
|-------------|----------|
| "Find every mention of rate limiting" | [Semantic search](#1-semantic-search) |
| "Show me the graph for the login feature" (no node ID known) | [Natural language graph lookup](#2-natural-language-graph-lookup) |
| "What's the full blast radius of this change?" | [Full impact: formal + semantic](#3-full-impact-formal--semantic) |
| "Are there any comments about payment flow?" | [Find comments on a topic](#4-find-comments-on-a-topic) |

---

## Workflows

### 1. Semantic search

Find all document sections about a concept:

**MCP (preferred):**
```
docs_search(query: "rate limiting", limit: 5)
```

**CLI fallback:**
```bash
npx ai-spector cocoindex search --query "rate limiting" --json
```

Response includes `graphNodeId` when the matched section maps to a traceability node.
Use that to run `graph_query` for full context.

---

### 2. Natural language graph lookup

When you know the concept but not the exact node ID:

```
graph_query_fuzzy(query: "user login flow")
```

This resolves the query to the best-matching graph node via semantic search,
then returns the subgraph in one call. Check `resolvedNodeId` and `confidence`
in the response.

Fallback if CocoIndex is not configured:
```bash
npx ai-spector graph query <nodeId> --json
# (use graph validate to list all node IDs)
```

---

### 3. Full impact: formal + semantic

`graph_impact` automatically includes `semanticSuggestions` when CocoIndex is
configured — no extra step needed:

```
graph_impact(originId: "uc.auth.login", change: "added MFA requirement")
```

Response shape:
```json
{
  "regenerate": [...],   // formal edges — must regenerate
  "review":    [...],    // formal edges — review recommended
  "semanticSuggestions": [
    { "docPath": "docs/basic-design/security-arch.md",
      "heading": "Auth Overview", "score": 0.87,
      "graphNodeId": "doc.basic.security",
      "reason": "semantically similar to changed section" }
  ]
}
```

Treat `semanticSuggestions` as "review recommended" — they may be affected but
have no formal graph edge yet.

---

### 4. Find comments on a topic

No code change needed — chain two MCP calls:

1. `docs_search(query: "payment processing")` → list of `docPath` values
2. For each path: `comments_list(filePath: docPath)` → comments on that section
3. Report aggregated results to user

---

## Setup check

Before using any semantic workflow, verify CocoIndex is ready:

**MCP (preferred):**
```
cocoindex_status({})
```

Check `ready: true`. If any issue is listed, fix it before searching.

**CLI fallback:**
```bash
npx ai-spector setup --check
```

If CocoIndex is missing, run `npx ai-spector cocoindex setup` (or ask agent to set it up via `ai-spector-setup` skill).

---

## Rebuild embeddings after doc edits

Semantic search goes stale when docs change. After any batch of doc edits:

**Preferred — one call:**
```
index({ cocoindexSync: true })
```

**Or separately:**
```
cocoindex_index({})
index({})
```

---

## Checklist

```
- [ ] cocoindex_status({}) → ready: true (or setup done)
- [ ] Embeddings refreshed after doc edits: index({ cocoindexSync: true })
- [ ] Used graph_query_fuzzy when node ID is unknown (not graph_query with a guess)
- [ ] Treated semanticSuggestions as "review recommended", not "must regenerate"
```
