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

# AI Spector — Generate detail design

**Core:** [../ai-spector/SKILL.md](../ai-spector/SKILL.md)

## Required reading

1. [references/runbook.md](references/runbook.md)
2. [../ai-spector/references/generate-workflow.md](../ai-spector/references/generate-workflow.md)
3. [../ai-spector/references/generate-graph.md](../ai-spector/references/generate-graph.md)

## Checklist

```
- [ ] language confirmed (language-picker.md — check before first write)
- [ ] graph validate; SRS + basic design present
- [ ] generate-workflow waves + merge per target
```

## Natural language

“detail design”, “implementation spec”, “feature detail for F-03” → this skill.
