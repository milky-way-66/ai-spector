---
name: ai-spector
description: >-
  Provides shared rules for AI Spector docflow projects: CLI failure handling, traceability graph path,
  and routing to task skills. Use when the user mentions ai-spector, docflow, or .npx ai-spector but the
  task is unclear, or for init and project layout. Do not use when the user clearly wants SRS,
  basic design, HTML prototype, graph operations, or comment resolution — use the
  matching task skill instead.
---

# AI Spector (core)

**Workflow:** [../../WORKFLOW.md](../../WORKFLOW.md) · **Router:** [_skill-router.md](../_skill-router.md)

## Invocation rule — MCP first, CLI fallback

When the `ai-spector` MCP server is enabled (`.cursor/mcp.json` or `.mcp.json` lists it), **call the MCP tool** instead of shelling out to `npx ai-spector`. MCP returns structured JSON, avoids spawning a Node process, and is the preferred channel for agents.

| Operation | MCP tool | CLI fallback |
|-----------|----------|--------------|
| Re-index project | `index({})` | `npx ai-spector index` |
| Merge knowledge → graph | `graph_merge({ fromKnowledge: true })` | `npx ai-spector graph merge --from-knowledge` |
| Validate graph | `graph_validate({})` | `npx ai-spector graph validate` |
| Impact analysis | `graph_impact({ originId, change })` | `npx ai-spector graph impact …` |
| Walk graph from node | `graph_query({ id, … })` | `npx ai-spector graph query <id> --json` |
| **Analyze data-source** | *(no MCP tool — CLI only)* | `npx ai-spector analyze` |

Use CLI **only** when: MCP server is not configured, the tool errors and MCP is unavailable, or the operation has no MCP equivalent (e.g. `analyze`).

## CLI and tool failure (non-negotiable)

When `npx ai-spector` exits non-zero, required `--json` is invalid, or a required MCP/terminal step fails:

1. **Pause** — no generation, no bulk `docs/**` reads, no silent workarounds.
2. **Report** per [references/cli-failures.md](references/cli-failures.md) (include full output).
3. **Offer recovery** — fix and retry (default), bounded workaround if applicable, or pause; wait for user unless [auto-fix](references/cli-failures.md#agent-may-fix-without-asking-small-local) applies.
4. **Continue** the same task from the failed step after fix or user-approved workaround; re-run the same CLI when possible.

## Project anchors

| Item | Path |
|------|------|
| Config (languages, paths) | `.ai-spector/docflow.config.json` |
| Graph | `.ai-spector/graph/traceability.graph.json` |
| Query | `graph_query({ id })` MCP · fallback: `npx ai-spector graph query <id> --json` |
| Templates | `.ai-spector/templates/` |
| Doc output | `docs/srs/{lang.code}/` · `docs/basic-design/{lang.code}/` |

## Route to a task skill

| Intent | Skill |
|--------|-------|
| Setup / bootstrap project | `ai-spector-setup` |
| Analyze, index, validate, impact, visualize | `ai-spector-graph` |
| SRS | `ai-spector-generate-srs` |
| Basic design | `ai-spector-generate-basic-design` |
| Prototype | `ai-spector-generate-prototype` |
| Comments | `ai-spector-resolve-comments` |
| Translation status / stale languages | `ai-spector-lang-status` |
| Resolve / sync translations | `ai-spector-resolve-translation` |
| “Generate docs” (vague) | `ai-spector-generate` |

When a task skill applies, read its `references/` runbook fully before acting.

## More

- [references/cli-reference.md](references/cli-reference.md) — full command reference (all options + examples)
- [references/project-conventions.md](references/project-conventions.md)
