# Validate, index & explore

**Section:** [Graph & sources](README.md) · **Course:** [Home](../README.md)  
**Time:** ~10 min · **Before:** [Add sources & analyze](01-sources-and-analyze.md)

**Goal:** Fix graph errors, keep the index fresh, and explore impact.

---

## Validate

```
validate the graph
```

Fix all **errors** before generating documents. **Warnings** are gaps to review.

| Problem | Fix |
|---------|-----|
| Missing actors | Add to sources → re-analyze |
| Wrong project content | Remove unrelated files from `docs/data-source/` |

---

## What you should see (validate)

- Error/warning list with node ids or paths.
- Exit success when zero errors (warnings may remain).

---

## Index

After any doc or graph edit:

```
refresh the index
```

Rebuilds section registry and syncs graph with documents.

---

## Explore *(optional)*

**Visualize** — interactive HTML graph:

```
show the graph
```

Or: `npx ai-spector graph visualize --open`

**Impact** — what to regenerate after changes:

```
what's impacted by my changes
```

Lists affected docs and semantic suggestions when CocoIndex is ready.

---

## What you should see (impact)

- Buckets: docs to regenerate, review-only, informational.
- Suggested chat commands for next steps.

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Validate fails after manual graph edit | Fix reported nodes or re-analyze from sources |
| Stale index | `refresh the index` after every doc wave |
| visualize won't open | Run CLI: `npx ai-spector graph visualize --open` |

---

## Next section

[Generate documents](../04-generate/README.md)
