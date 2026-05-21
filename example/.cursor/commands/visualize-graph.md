# /visualize-graph

Open an HTML report of the traceability graph and `knowledge.json` for a quick sanity check.

## Usage

- `/visualize-graph`

## Required Behavior

Run from project root (agent executes — user does not):

```bash
ai-spector graph visualize --open
```

Default output: `.ai-spector/views/graph-knowledge.html`

If merge has not run yet, the report still shows structure + staging knowledge tables.

## When to suggest

- After **`/analyze`** completes
- When the user asks to “see the graph” or verify UC/F links
