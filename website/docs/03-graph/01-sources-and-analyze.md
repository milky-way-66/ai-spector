# Add sources & analyze

**Section:** [Graph & sources](README.md) · **Course:** [Home](../README.md)  
**Time:** ~10 min

**Goal:** Put requirements in place and extract them into the traceability graph.

---

## What is the traceability graph?

A structured map of **actors**, **use cases**, and **features** extracted from your sources. Generation reads this graph — it does not bulk-read every file each time.

**On disk:** `.ai-spector/graph/traceability.graph.json`

---

## Add source material

Drop files into `docs/data-source/` — `.md`, `.txt`, or `.pdf` (text must be selectable).

Include meeting notes, user stories, BRDs, API descriptions. The agent reads but never modifies these files.

```bash
ls docs/data-source/   # at least one file before analyze
```

---

## Analyze

```
analyze my data source
```

The agent extracts actors, use cases, and features into the graph. Review the summary; add detail to sources and re-run if something is missing.

---

## What you should see

- Summary listing extracted actors, use cases, feature count.
- `traceability.graph.json` updated (larger file, recent timestamp).
- Agent may run `knowledge_validate` / `graph_merge` / `graph_validate` — watch for errors.

---

## Check

```
validate the graph
```

No critical errors (warnings are OK at this stage).

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Empty graph | Add more detail to `docs/data-source/`; re-analyze |
| PDF not extracted | Ensure text is selectable (not scanned image only) |
| Analyze CLI error | Agent should offer fix / workaround per cli-failures |

---

## Next

[Validate, index & explore](02-validate-index-explore.md)
