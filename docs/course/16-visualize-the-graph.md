# Work 16 — Visualize the Graph

**Course:** [Index](README.md) · [Overview](00-overview.md) · [Previous](15-resolve-comments.md)

**Goal:** Open an interactive HTML view of the traceability graph to explore connections between actors, use cases, features, and documents.

**Before you start:** Work 06 (Analyze Data Source).

---

## What the Visualization Shows

The graph viewer displays:

- **Nodes** — actors, use cases, features, documents, sections (each type has a distinct color and shape)
- **Edges** — directed connections (actor → use case, use case → feature, feature → doc section)
- **Layers** — the tri-layer structure: requirements → design → implementation
- **Hover details** — click a node to see its ID, type, label, and linked nodes

This is useful for:
- Explaining the system structure to stakeholders
- Spotting missing connections (isolated nodes)
- Verifying that the graph matches your mental model

---

## Steps

### 1. Open chat

### 2. Type this

```
visualize the graph
```

or

```
open the graph visualization
```

---

### 3. The browser opens automatically

The agent generates an HTML file and opens it in your default browser. If the browser doesn't open, the agent will give you the file path — open it manually:

```bash
open .ai-spector/graph.html
```

---

### 4. Explore the graph

In the browser:

- **Drag** nodes to rearrange
- **Scroll** to zoom in and out
- **Click** a node to highlight its connections
- **Filter** by layer or node type using the controls (if your template supports it)

---

### 5. Share with stakeholders

The graph is a self-contained HTML file. You can share it by:

- Sending the `.html` file directly
- Committing it to your repo and sharing a link
- Hosting it on any static file server

---

## Check

After the command runs, a browser tab should open showing a network diagram with colored nodes and edges. If the graph is empty (no nodes), the analyze step in Work 06 didn't produce any output — re-run it.

---

## Troubleshooting

**Browser doesn't open**

Run the CLI command directly:

```bash
npx ai-spector graph visualize --open
```

**Graph is too crowded to read**

Use the filter controls to show only one layer or node type at a time. Or ask the agent to visualize a subgraph:

```
visualize the graph starting from UC-03
```

**All nodes appear disconnected**

The graph has nodes but no edges. This usually means the source documents didn't clearly express relationships between concepts. Add more context to `docs/data-source/` and re-run analyze.

---

## Next

Go to [Work 17 — Custom Template Packs (Optional)](17-custom-template-packs.md), [Work 18 — Enable CocoIndex (Optional)](18-enable-cocoindex.md), or [Work 19 — Add Another Editor (Optional)](19-add-another-editor.md). Or return to day-to-day workflow — see the [Course Overview](00-overview.md).
