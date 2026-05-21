---
name: ai-spector
description: "Graph-centric docs: use ai-spector graph query/impact/validate CLI; never traverse JSON manually."
---

# AI Spector Skill

**Heart:** `.ai-spector/graph/traceability.graph.json`

**IDE rule:** Use **`ai-spector graph`** CLI for search, impact, and validation. Parse `--json` output. See `.cursor/commands/_graph.md`.

## Workflow

1. `ai-spector init`
2. `docs/data-source/` inputs
3. `ai-spector analyze` → structure in graph
4. `/analyze` → merge UC/F into graph
5. `ai-spector graph validate`
6. `/generate-srs` → per target: **`ai-spector graph query <seed> --json`**
7. `/graph-impact` → **`ai-spector graph impact <id> --json`**
8. `/generate-basic-design`, `/generate-detail-design` → same query pattern

## Context selection (mandatory)

```bash
ai-spector graph query <seedId> --direction both --depth 3 --json
```

Use `projectionPaths` and `nodes` from stdout. **Do not** implement BFS in the agent. **Do not** bulk-read `docs/srs/` when query returns paths.

## Impact

```bash
ai-spector graph impact <nodeId> --change content_change --json
```

Regenerate only `regenerate` bucket entries; query each for context.

## Commands

| Cursor | CLI |
|--------|-----|
| `/validate-graph` | `ai-spector graph validate` |
| `/generate-srs` | `graph query` per section/doc seed |
| `/graph-impact` | `graph impact` |
| `/analyze` | merge graph + `graph validate` |

Templates: `node_modules/ai-spector/templates/`
