---
name: ai-spector
description: "Cursor-first docs workflow: user runs slash commands; agent runs ai-spector CLI. Graph is source of truth."
---

# AI Spector Skill

**User-facing workflow:** `.cursor/commands/_workflow.md` — user only runs `npx ai-spector init` once, then slash commands.

**Agent rule:** Run `ai-spector` CLI in the shell. Never tell the user to run `analyze`, `graph merge`, `graph query`, or `graph validate` manually.

## Slash commands (user)

| Command | Agent runs CLI |
|---------|----------------|
| `/analyze` | `analyze` → Graphify → `graph merge --from-knowledge` → `graph validate` |
| `/validate-graph` | `graph validate` |
| `/visualize-graph` | `graph visualize --open` |
| `/generate-srs` | `graph validate` + `graph query <seed> --json` per target |
| `/graph-impact` | `graph impact <id> --json` |
| `/generate-basic-design`, `/generate-detail-design` | `graph query` per target |

## Heart of the system

`.ai-spector/graph/traceability.graph.json` — sections, use cases, features, edges.

Context for generation: **`ai-spector graph query <seedId> --json`** — use `projectionPaths` and `nodes` from stdout only. Details: `_graph.md`.

## Mandatory patterns

```bash
ai-spector graph query <seedId> --direction both --depth 3 --json
ai-spector graph impact <nodeId> --change content_change --json
ai-spector graph validate
```

Do not implement graph BFS in the agent. Do not bulk-read `docs/srs/**` when query returned paths.

Templates: `node_modules/ai-spector/templates/` (or `../templates/` when developing from monorepo `example/`).
