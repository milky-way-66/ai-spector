---
name: ai-spector
description: >-
  Provides shared rules for AI Spector docflow projects: CLI failure handling, traceability graph path,
  and routing to task skills. Use when the user mentions ai-spector, docflow, or .ai-spector but the
  task is unclear, or for init and project layout. Do not use when the user clearly wants SRS,
  basic design, detail design, HTML prototype, graph operations, or comment resolution — use the
  matching task skill instead.
---

# AI Spector (core)

**Workflow:** [../../WORKFLOW.md](../../WORKFLOW.md) · **Router:** [_skill-router.md](../_skill-router.md)

## CLI failure (non-negotiable)

When `ai-spector` exits non-zero or required `--json` is invalid:

1. **Stop** — no generation, no bulk `docs/**` reads, no hand-editing the whole graph.
2. **Report** per [references/cli-failures.md](references/cli-failures.md).
3. **Fix**, then **re-run the same CLI**.

## Project anchors

| Item | Path |
|------|------|
| Graph | `.ai-spector/graph/traceability.graph.json` |
| Query | `ai-spector graph query <id> --json` |
| Templates | `.ai-spector/templates/` |

## Route to a task skill

| Intent | Skill |
|--------|-------|
| Analyze, index, validate, impact, visualize | `ai-spector-graph` |
| SRS | `ai-spector-generate-srs` |
| Basic design | `ai-spector-generate-basic-design` |
| Detail design | `ai-spector-generate-detail-design` |
| Prototype | `ai-spector-generate-prototype` |
| Comments | `ai-spector-resolve-comments` |
| “Generate docs” (vague) | `ai-spector-generate` |

When a task skill applies, read its `references/` runbook fully before acting.

## More

[references/project-conventions.md](references/project-conventions.md)
