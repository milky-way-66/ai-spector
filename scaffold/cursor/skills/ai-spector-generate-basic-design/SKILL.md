---
name: ai-spector-generate-basic-design
description: >-
  Generates basic design chapters from the traceability graph in DAG order (screen list, API list,
  wireframes wave). Do NOT use for incremental adds like "add an API endpoint" or "update screen X"
  — use ai-spector-resolve-task instead. Do not use for SRS-only work, HTML prototype, or graph-only
  analyze/index tasks.
paths:
  - "docs/basic-design/**"
  - ".ai-spector/templates/basic_design/**"
---

# Generate Basic Design

## Load at start
1. [references/runbook.md](references/runbook.md)
2. [../ai-spector/references/generate-workflow.md](../ai-spector/references/generate-workflow.md)

## Load when needed

| Situation | Load |
|---|---|
| Language not set | [../ai-spector/references/language-picker.md](../ai-spector/references/language-picker.md) |
| Writing DB design | [references/bd-context/db-design.md](references/bd-context/db-design.md) |
| Writing API list | [references/bd-context/api-list.md](references/bd-context/api-list.md) |
| Writing API detail (per endpoint) | [references/bd-context/api-detail.md](references/bd-context/api-detail.md) |
| Writing screen list | [references/bd-context/screen-list.md](references/bd-context/screen-list.md) |
| Writing screen detail (per screen) | [references/bd-context/screen-detail.md](references/bd-context/screen-detail.md) |
| Graph queries / merge | [../ai-spector/references/generate-graph.md](../ai-spector/references/generate-graph.md) |
| CLI fails | [../ai-spector/references/cli-failures.md](../ai-spector/references/cli-failures.md) |
| Run of 5+ files | [../ai-spector/references/context-management.md](../ai-spector/references/context-management.md) |

## On CLI failure
Pause. Report full output. Offer fix + retry. Details in cli-failures.md.

"basic design", "screen list", "API list", "wireframe for login" → this skill.
