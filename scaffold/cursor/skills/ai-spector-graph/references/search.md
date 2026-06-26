# Semantic Search

CocoIndex adds **semantic proximity** on top of the formal traceability graph. Use when you know a concept but not the exact node ID, or when you want to surface related docs with no formal graph edge.

Requires CocoIndex to be set up (`npx ai-spector cocoindex setup` or `ai-spector` core skill → Setup phase).

## Pre-flight

```
cocoindex_status({})    # MCP preferred
npx ai-spector setup --check  # CLI fallback
```

If `ready: false` → set up CocoIndex before proceeding.

## Semantic document search

Find all document sections about a concept:

```
docs_search({ query: "rate limiting", limit: 5 })
```

**CLI fallback:**
```bash
npx ai-spector cocoindex search --query "rate limiting" --json
```

Response includes `graphNodeId` when the matched section maps to a traceability node. Use that for `graph_query` to get full context.

## Natural language graph lookup

When node ID is unknown:

```
graph_query_fuzzy({ query: "user login flow" })
```

Resolves to best-matching graph node via semantic search, returns the subgraph. Check `resolvedNodeId` and `confidence`.

**Fallback (no CocoIndex):** `graph_validate({})` to list all node IDs, then `graph_query({ seedId })`.

## Full impact (formal + semantic)

`graph_impact` automatically includes `semanticSuggestions` when CocoIndex is configured:

```
graph_impact({ originId: "uc.auth.login", change: "added MFA requirement" })
```

Response:
```json
{
  "regenerate": [...],
  "review": [...],
  "semanticSuggestions": [
    { "docPath": "docs/basic-design/security-arch.md", "score": 0.87,
      "graphNodeId": "doc.basic.security", "reason": "semantically similar" }
  ]
}
```

Treat `semanticSuggestions` as "review recommended" — not "must regenerate".

## Find comments on a topic

1. `docs_search({ query: "payment processing" })` → list of `docPath`
2. For each path: `comments inbox --file <docPath> --json` → threads on that section
3. Report aggregated results

## Rebuild embeddings after doc edits

```
index({ cocoindexSync: true })   # preferred — graph + embeddings in one call
```

Or separately: `cocoindex_index({})` + `index({})`.

## Checklist

```
- [ ] cocoindex_status({}) → ready: true
- [ ] Embeddings refreshed after doc edits: index({ cocoindexSync: true })
- [ ] Used graph_query_fuzzy when node ID unknown (not graph_query with a guess)
- [ ] Treated semanticSuggestions as "review recommended"
```
