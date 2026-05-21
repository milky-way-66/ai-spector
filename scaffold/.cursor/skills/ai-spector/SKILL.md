---
name: ai-spector
description: "Cursor-first docs: user runs slash commands; agent runs CLI; on CLI failure stop and help fix — no manual bypass."
---

# AI Spector Skill

**Workflow:** `.cursor/commands/_workflow.md` — user only runs `npx ai-spector init` once, then slash commands.

**Graphify MCP:** `init` configures `.cursor/mcp.json` → graph file at `.ai-spector/.docflow/graph/graphify-out/graph.json` (not `docs/data-source/graphify-out/`).

## CLI failure rule (non-negotiable)

When `ai-spector` exits non-zero or required `--json` is missing/invalid:

1. **Stop** — no generate, no bulk `docs/srs/**` reads, no hand-editing the whole graph.
2. **Report** using the format in `.cursor/commands/_cli-failures.md` (verbatim CLI output + plain fix steps).
3. **Fix** the root cause, then **re-run the same CLI** and continue the slash command.

Never ignore CLI errors and “work around” with index files, manual BFS, or inventing graph content. See `_cli-failures.md` for forbidden fallbacks.

## Slash commands (user)

| Command | Agent runs CLI |
|---------|----------------|
| `/analyze` | `analyze` → `graphify update` → Graphify MCP extract → `graph merge` → `graph validate` |
| `/validate-graph` | `graph validate` |
| `/visualize-graph` | `graph visualize --open` |
| `/generate-srs` | All DAG, explicit paths, or natural-language scope (confirm before gen) → waves → query → write → merge |
| `/graph-impact` | `graph impact <id> --json` |
| `/generate-basic-design` | Same as SRS: all / paths / request (**confirm**) → waves → query → merge (`dag.basic-design.*`) |
| `/generate-detail-design` | `graph query` per target |

Run CLI from **project workspace root**; prefer `npx ai-spector` if the binary is not on PATH.

## Heart of the system

`.ai-spector/graph/traceability.graph.json`

Context: **`ai-spector graph query <seedId> --json`** — depth 4 for targets, depth 2 for DAG deps; use `projectionPaths`. After each generated file: **`graph merge`** projection patch with `rendersTo` + `dependsOn`. Details: `_generate-graph.md`, `_graph.md`.

**Generate:** accuracy over speed — batch only same-wave independent targets; merge + validate after each wave.

Templates: `node_modules/ai-spector/templates/` (monorepo `example/`: `../templates/`).
