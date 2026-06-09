# Work 06 — Analyze Data Source

**Course:** [Index](README.md) · [Overview](00-overview.md) · [Previous](05-add-source-material.md)

**Goal:** Have the agent read your requirements documents and extract actors, use cases, and features into the traceability graph.

**Before you start:** Work 04 (Enable Agent Skills), Work 05 (Add Source Material).

---

## What Happens

When you say "analyze data source", the agent:

1. Reads every file in `docs/data-source/`
2. Extracts actors (who uses the system), use cases (what they do), and features (how the system supports them)
3. Writes the results into `.ai-spector/traceability.graph.json`
4. Merges the extracted knowledge into the graph

This is the foundation for every other document the agent generates.

---

## Steps

### 1. Open chat in your editor

Cursor: `Cmd+L` / `Ctrl+L`
Claude Code: the terminal prompt

---

### 2. Type this in chat

```
analyze my data source
```

or

```
analyze the data source
```

Both phrases work.

---

### 3. Wait for the agent to finish

The agent will show you its progress. For a typical project with a few documents, this takes 30–60 seconds. For large PDFs it may take a few minutes.

---

### 4. Review the summary

When the agent finishes, it will print a summary of what it extracted:

- Number of actors found
- Number of use cases extracted
- Number of features identified
- Any sections it was uncertain about

Read the summary. If something important is missing (e.g. a key actor not mentioned), you can add clarifying notes to your source documents and run this step again.

---

### 5. Iterate if needed

You can run "analyze data source" as many times as you want. Each run re-reads the source files and updates the graph. New documents you add to `docs/data-source/` are picked up automatically on the next run.

---

## Check

Ask the agent:

```
validate the graph
```

It should report no critical errors (minor warnings about missing connections are normal at this stage).

Or check the graph file directly:

```bash
cat .ai-spector/traceability.graph.json | head -50
```

You should see nodes with `type: "actor"`, `type: "useCase"`, or `type: "feature"`.

---

## Troubleshooting

**Agent says "no source documents found"**

The `docs/data-source/` folder is empty or the files are in an unsupported format. Go back to Work 05 and add `.md`, `.txt`, or `.pdf` files.

**Graph looks incomplete**

Your source documents may not describe the system clearly enough. Try adding more detail or headings. You can also give the agent a hint:

```
analyze data source — focus on the payment and user management features
```

**PDF content not extracted**

Some PDFs are image-only (scanned). Check by trying to select text in the PDF. If you can't select text, export it to `.txt` or type out the key sections manually.

---

## Next

Go to [Work 07 — Validate the Graph](07-validate-the-graph.md).
