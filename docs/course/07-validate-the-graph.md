# Work 07 — Validate the Graph

**Course:** [Index](README.md) · [Overview](00-overview.md) · [Previous](06-analyze-data-source.md)

**Goal:** Check the traceability graph for structural errors, missing links, and schema violations before generating any documents.

**Before you start:** Work 06 (Analyze Data Source).

---

## Why Validate?

The graph is the source of truth for all generated documents. Errors in the graph become errors in the SRS and basic design. Validating early saves time.

---

## Steps

### 1. Open chat

### 2. Type this

```
validate the graph
```

---

### 3. Read the report

The agent runs validation and reports:

**Errors (must fix)** — structural problems that will cause document generation to fail or produce incorrect output. Examples:
- A use case node with no actor connection
- An edge pointing to a node that doesn't exist
- Missing required fields on a node

**Warnings (review)** — possible gaps that may or may not be real problems. Examples:
- A feature with no linked use case
- An actor that appears in only one use case

---

### 4. Fix errors

If there are errors, the most common fix is to update your source documents to be more specific, then re-run:

```
analyze data source
```

Then validate again.

For manual fixes, you can edit `.ai-spector/traceability.graph.json` directly, but only if you know the graph schema. The agent can also apply targeted fixes — just describe the problem:

```
the UC-03 use case has no actor — link it to the Customer actor
```

---

### 5. Confirm the graph is clean

Once the agent reports zero errors (warnings are OK), you're ready to generate documents.

---

## Check

The agent's validation output should say something like:

```
Graph is valid. 0 errors, 3 warnings.
```

Zero errors is the goal. Warnings can be left for later.

---

## Troubleshooting

**Many errors after the first analyze**

This is normal for a first run on rough source documents. Run analyze again after adding clearer descriptions to your source files.

**Validation never finishes**

The graph file may be malformed JSON. Check:

```bash
node -e "JSON.parse(require('fs').readFileSync('.ai-spector/traceability.graph.json', 'utf8'))"
```

If it throws, the file is broken. Ask the agent to re-analyze and rebuild the graph from scratch.

**"Graph file not found"**

The analyze step in Work 06 didn't run or failed silently. Run Work 06 first.

---

## Next

Go to [Work 08 — Generate SRS](08-generate-srs.md).
