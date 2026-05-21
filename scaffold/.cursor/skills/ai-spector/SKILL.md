---
name: ai-spector
description: "Cursor-first docs: user runs slash commands; agent runs CLI; on CLI failure stop and help fix — no manual bypass."
---

# AI Spector Skill

**Workflow:** `.cursor/commands/_workflow.md` — user only runs `npx ai-spector init` once, then slash commands.

## CLI failure rule (non-negotiable)

When `ai-spector` exits non-zero or required `--json` is missing/invalid:

1. **Stop** — no generate, no bulk `docs/srs/**` reads, no hand-editing the whole graph.
2. **Report** using the format in `.cursor/commands/_cli-failures.md` (verbatim CLI output + plain fix steps).
3. **Fix** the root cause, then **re-run the same CLI** and continue the slash command.

Never ignore CLI errors and “work around” with index files, manual BFS, or inventing graph content. See `_cli-failures.md` for forbidden fallbacks.

## Slash commands (user)

| Command | Agent runs CLI |
|---------|----------------|
| `/analyze` | `analyze` → Graphify → `graph merge --from-knowledge` → `graph validate` |
| `/validate-graph` | `graph validate` |
| `/visualize-graph` | `graph visualize --open` |
| `/generate-srs` | `graph validate` + `graph query <seed> --json` per target |
| `/graph-impact` | `graph impact <id> --json` |
| `/generate-basic-design`, `/generate-detail-design` | `graph query` per target |

Run CLI from **project workspace root**; prefer `npx ai-spector` if the binary is not on PATH.

## Heart of the system

`.ai-spector/graph/traceability.graph.json`

Context: **`ai-spector graph query <seedId> --json`** — only after validate passes; use `projectionPaths` from stdout. Details: `_graph.md`.

Templates: `node_modules/ai-spector/templates/` (monorepo `example/`: `../templates/`).
