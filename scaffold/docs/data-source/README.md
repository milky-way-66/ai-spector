# Data source

Put **your** input files here (briefs, notes, exports, diagrams, legacy docs) before **`/analyze`**.

## Not your inputs: `graphify-out/`

If you see `docs/data-source/graphify-out/`, it was created by **Graphify MCP** during **`/analyze`** in Cursor — not by `npx ai-spector analyze`.

| Location | What it is |
|----------|------------|
| `docs/data-source/graphify-out/` | Graphify scratch/export (optional, often accidental) |
| `.ai-spector/.docflow/graph/graphify-index` | Graphify index (configured) |
| `.ai-spector/.docflow/graph/graphify-out` | Preferred Graphify output (see `analyze.graphify.json`) |
| `.ai-spector/.docflow/analysis/knowledge.json` | **AI Spector staging** → merged into the traceability graph |

You can **delete** `graphify-out/` under `docs/data-source/`; it is gitignored. The agent should write extract results to `knowledge.json`, not rely on that folder.

Override inputs: `/analyze path/to/other-folder`
