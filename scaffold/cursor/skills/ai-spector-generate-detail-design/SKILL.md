---
name: ai-spector-generate-detail-design
description: >-
  Generates or updates detail design and implementation specification documents under
  docs/detail-design/ from the traceability graph, SRS, and basic design. Use when the user asks for
  detail design, feature detail docs, or implementation specs. Do not use for SRS, basic design screens,
  or HTML prototype.
paths:
  - "docs/detail-design/**"
  - ".ai-spector/templates/detail_design/**"
---

# Generate Detail Design

## Load at start
1. [references/runbook.md](references/runbook.md)
2. [../ai-spector/references/generate-workflow.md](../ai-spector/references/generate-workflow.md)

## Load when needed

| Situation | Load |
|---|---|
| Language not set | [../ai-spector/references/language-picker.md](../ai-spector/references/language-picker.md) |
| Graph queries / merge | [../ai-spector/references/generate-graph.md](../ai-spector/references/generate-graph.md) |
| CLI fails | [../ai-spector/references/cli-failures.md](../ai-spector/references/cli-failures.md) |
| Run of 5+ files | [../ai-spector/references/context-management.md](../ai-spector/references/context-management.md) |

## On CLI failure
Pause. Report full output. Offer fix + retry. Details in cli-failures.md.

"detail design", "implementation spec", "feature detail for F-03" → this skill.
