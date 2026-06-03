---
name: ai-spector-generate-srs
description: >-
  Generates or updates the System Requirements Specification from the traceability graph and
  docs/data-source context. Use when the user asks to generate or update SRS, requirements, use cases
  (UC-xx), features (F-xx), or files under docs/srs/. Do not use for basic design screens/APIs,
  detail design, HTML prototype, or graph-only analyze/index tasks.
paths:
  - "docs/srs/**"
  - ".ai-spector/templates/srs/**"
---

# Generate SRS

## Load at start
1. [references/runbook.md](references/runbook.md)
2. [../ai-spector/references/generate-workflow.md](../ai-spector/references/generate-workflow.md)

## Load when needed

| Situation | Load |
|---|---|
| Language not set | [../ai-spector/references/language-picker.md](../ai-spector/references/language-picker.md) |
| Writing §1 Introduction | [references/srs-context/introduction.md](references/srs-context/introduction.md) |
| Writing §2 Overall Description | [references/srs-context/overall-description.md](references/srs-context/overall-description.md) |
| Writing §3 UC list or UC-xx detail | [references/srs-context/use-case-detail.md](references/srs-context/use-case-detail.md) |
| Writing §4 feature list or F-xx detail | [references/srs-context/feature-detail.md](references/srs-context/feature-detail.md) |
| Writing §5 Data Requirements | [references/srs-context/data-requirements.md](references/srs-context/data-requirements.md) |
| Writing §6 External Interfaces | [references/srs-context/external-interfaces.md](references/srs-context/external-interfaces.md) |
| Writing §7 Quality Attributes | [references/srs-context/quality-attributes.md](references/srs-context/quality-attributes.md) |
| Graph queries / merge | [../ai-spector/references/generate-graph.md](../ai-spector/references/generate-graph.md) |
| CLI fails | [../ai-spector/references/cli-failures.md](../ai-spector/references/cli-failures.md) |
| Run of 5+ files | [../ai-spector/references/context-management.md](../ai-spector/references/context-management.md) |

## On CLI failure
Pause. Report full output. Offer fix + retry. Details in cli-failures.md.

"generate SRS", "write requirements", "use case chapter", "feature list" → this skill.
