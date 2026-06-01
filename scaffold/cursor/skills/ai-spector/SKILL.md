---
name: ai-spector
description: >-
  AI Spector docflow core — traceability graph, .ai-spector project, CLI failure rules, templates.
  Use when working in an ai-spector project but task is unclear; read _skill-router.md to pick a task skill.
---

# AI Spector (core)

Shared rules for **all** ai-spector work. For a specific task, also load the matching task skill (see router below).

**Workflow index:** `.cursor/commands/_workflow.md`
**Skill router:** `.cursor/skills/_skill-router.md`

## CLI failure rule (non-negotiable)

When `ai-spector` exits non-zero or required `--json` is missing/invalid:

1. **Stop** — no generate, no bulk `docs/srs/**` reads, no hand-editing the whole graph.
2. **Report** per `.cursor/commands/_cli-failures.md` (verbatim CLI output + fix steps).
3. **Fix**, then **re-run the same CLI**.

Never bypass CLI with manual graph edits or invented content.

## Graphify MCP

`init` writes `.cursor/mcp.json` → graph at `.ai-spector/.docflow/graph/graphify-out/graph.json`.

## Heart of the system

`.ai-spector/graph/traceability.graph.json` — context via `ai-spector graph query <id> --json`.

Run CLI from project root; prefer `npx ai-spector` if not on PATH.

## Task skills (auto-routing)

| User intent | Skill | Command doc |
|-------------|-------|---------------|
| Analyze, index, validate, impact, visualize graph | `ai-spector-graph` | `commands/analyze.md`, `index.md`, `impact.md`, … |
| Generate SRS / basic design / detail design | `ai-spector-generate` | `commands/generate-*.md` |
| Resolve review comments under `comments/` | `ai-spector-resolve-comments` | `commands/resolve-comments.md` |

When the user uses a **slash command** (`/analyze`, `/generate-srs`, `/resolve-comments`), follow that command file directly — skills reinforce the same rules.

## Templates

Read from `.ai-spector/templates/` before any generation. Missing templates → `npx ai-spector init --force`.
