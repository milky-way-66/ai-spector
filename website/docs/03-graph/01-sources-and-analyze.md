# Add sources & analyze

**Section:** [Graph & sources](README.md) · **Course:** [Home](../README.md)  
**Time:** ~10 min

**Goal:** Put requirements in place and extract them into the traceability graph.

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

The agent extracts actors, use cases, and features into `.ai-spector/graph/traceability.graph.json`. Review the summary; add detail to sources and re-run if something is missing.

---

## Check

```
validate the graph
```

No critical errors (warnings are OK at this stage).

---

## Next

[Validate, index & explore](02-validate-index-explore.md)
