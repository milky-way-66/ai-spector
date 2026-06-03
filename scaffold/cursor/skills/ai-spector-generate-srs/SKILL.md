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

# AI Spector — Generate SRS

**Core:** [../ai-spector/SKILL.md](../ai-spector/SKILL.md)

## Required reading

1. [references/runbook.md](references/runbook.md) — SRS-specific DAG, waves, finish
2. [../ai-spector/references/generate-workflow.md](../ai-spector/references/generate-workflow.md) — scope, confirm, per-wave checklist
3. [../ai-spector/references/generate-graph.md](../ai-spector/references/generate-graph.md) — query, merge, ingest

## Checklist

```
- [ ] language confirmed (language-picker.md — check before first write)
- [ ] graph validate
- [ ] runbook + generate-workflow followed
- [ ] templates from .ai-spector/templates/srs/
- [ ] merge + validate each wave
- [ ] ai-spector index when runbook says so
```

## Natural language

“generate SRS”, “write requirements”, “use case chapter”, “feature list” → this skill.
