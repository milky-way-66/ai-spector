# AI Spector workflow (Cursor)

**You use slash commands.** The agent runs `ai-spector` CLI in the terminal when needed. Do not ask the user to run `analyze`, `graph merge`, or `graph query` manually.

## One-time setup (terminal)

```bash
npm install ai-spector
npx ai-spector init
```

Add source material under `docs/data-source/`, open the project in Cursor, and enable the **ai-spector** skill.

## Day-to-day (slash commands only)

| Step | You run | Agent runs (CLI) |
|------|---------|------------------|
| 1 | **`/analyze`** | `ai-spector analyze` → Graphify extract → `graph merge --from-knowledge` → `graph validate` → optional `graph visualize --open` |
| 2 | **`/validate-graph`** | `ai-spector graph validate` |
| 3 | **`/generate-srs`** | `graph validate` → `graph query <seed> --json` per target → write docs → `graph validate` |
| 4 | **`/index-docs srs`** (optional) | index update per command |
| 5 | **`/generate-basic-design`** | same `graph query` pattern |
| 6 | **`/generate-detail-design`** | same `graph query` pattern |
| After edits | **`/graph-impact <nodeId>`** | `graph impact <id> --json` |
| Inspect graph | **`/visualize-graph`** | `graph visualize --open` |

## Typical first run

```text
npx ai-spector init          ← only CLI step you run yourself
docs/data-source/            ← add files
/analyze
/validate-graph
/generate-srs
```

## If something fails

| Symptom | You run |
|---------|---------|
| No use cases in graph | `/analyze` again (after updating `docs/data-source/`) |
| Validate errors | `/analyze` or `/validate-graph` — agent fixes graph from CLI output |
| Wrong or empty SRS context | `/analyze` then `/generate-srs` |
| Changed a section and unsure what to regen | `/graph-impact <section-or-UC-id>` |

Technical CLI details: [_graph.md](./_graph.md). Prerequisites: [_prerequisites.md](./_prerequisites.md).
