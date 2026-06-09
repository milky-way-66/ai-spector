# Work 09 — Index the Project

**Course:** [Index](README.md) · [Overview](00-overview.md) · [Previous](08-generate-srs.md)

**Goal:** Rebuild the project index so the agent has an up-to-date picture of your docs, graph, and section registry.

**Before you start:** Work 08 (Generate SRS), or any time you edit documents manually.

---

## What Indexing Does

Indexing does three things:

1. **Rebuilds the section registry** — maps every heading in every doc to a graph node ID, so impact analysis knows which sections to flag when something changes.
2. **Updates the graph** — merges any manual edits you made to docs back into the graph.
3. **Syncs CocoIndex** *(if configured)* — updates the semantic search embeddings.
4. **Updates the translation queue** *(if 2+ languages)* — enqueues jobs when primary-language files change so secondary copies can be synced (see [Work 10 — Multi-language](10-multi-language.md)).

You should re-index after:
- Generating or editing any document
- Adding new source material
- Making manual edits to `.ai-spector/traceability.graph.json`

---

## Steps

### 1. Open chat

### 2. Type this

```
refresh the index
```

or

```
re-index the graph
```

---

### 3. Wait for the agent

Indexing is usually fast — 10–30 seconds. The agent prints a step-by-step report showing which steps passed, were skipped, or failed.

---

### 4. Review the report

A healthy index report looks like:

```
graph-load    ✓
graph-merge   ✓
registry      ✓
validate      ✓
cocoindex     skipped (not configured)
```

If any step shows `failed`, see Troubleshooting below.

---

## Check

Ask the agent:

```
validate the graph
```

After indexing, the graph should still be valid (no new errors introduced).

---

## Troubleshooting

**"graph-merge failed"**

The graph file may have a structural problem. Run:

```
validate the graph
```

Fix any errors it reports, then index again.

**"registry failed"**

A document has a heading that can't be mapped to a graph node. Check that your docs use consistent heading IDs. The agent can usually diagnose this — ask:

```
why did indexing fail?
```

**Index is slow**

Large PDF files slow down indexing. If you have very large PDFs in `docs/data-source/`, consider extracting only the relevant sections into a `.md` file.

---

## Next

Go to [Work 10 — Multi-language Documentation](10-multi-language.md) if you need more than one language, or [Work 11 — Generate Basic Design](11-generate-basic-design.md) to continue with one language.
