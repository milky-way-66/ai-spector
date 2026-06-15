# Semantic search & second editor

**Section:** [Advanced](README.md) · **Course:** [Home](../README.md)  
**Time:** ~10 min · **Optional**

**Goal:** Search by meaning and support both Cursor and Claude Code.

---

## Semantic search *(Python 3.11+)*

Enable at init or later: `npx ai-spector cocoindex setup`

```
find all mentions of rate limiting
which docs describe login
show graph for user login
```

---

## What you should see

- `docs_search` returns ranked doc sections with paths.
- `graph_query_fuzzy` finds nodes when you don't know the id.

---

## Second editor

Re-run init with both editors:

```bash
npx ai-spector init --target both
```

Enable skills and reload MCP for the new editor (same as [Setup & skills](../01-get-started/02-setup-and-skills.md)).

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Search returns nothing | Run `cocoindex setup`; `refresh the index` |
| Fuzzy graph empty | Analyze sources first; index with cocoindex sync |

---

## Course complete

[Course home](../README.md)
