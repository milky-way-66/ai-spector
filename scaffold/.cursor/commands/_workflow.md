# AI Spector workflow (Cursor)

**You use slash commands.** The agent runs `ai-spector` CLI in the terminal. Do not ask the user to run `analyze`, `graph merge`, or `graph query` manually.

If CLI fails: agent **stops**, shows output, and helps you fix — see [**_cli-failures.md**](./_cli-failures.md). No silent fallbacks.

## One-time setup (terminal)

```bash
npm install ai-spector
npx ai-spector init
```

Add source material under `docs/data-source/`, open the project in Cursor, **reload MCP** (Graphify is in `.cursor/mcp.json` from `init`), and enable the **ai-spector** skill.

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

**Any step fails?** Agent reports the error and fix steps, then you re-run the **same** slash command. The agent does not bypass CLI with manual graph edits or folder-wide doc reads.

## Typical first run

```text
npx ai-spector init          ← only CLI step you run yourself
docs/data-source/            ← add files
/analyze
/validate-graph
/generate-srs
```

## If something fails

| Symptom | What to do |
|---------|------------|
| Red error after `/analyze` | Read agent’s **Blocked** message; fix data-source or Graphify; run **`/analyze`** again |
| Validate errors | **`/validate-graph`** — agent explains each `[ERROR]` and fixes or guides you |
| Empty SRS / wrong context | **`/analyze`** then **`/generate-srs`** — not “read all docs manually” |
| Unsure what regen | **`/graph-impact <id>`** |

Details: [_cli-failures.md](./_cli-failures.md). CLI reference: [_graph.md](./_graph.md). Prerequisites: [_prerequisites.md](./_prerequisites.md).
