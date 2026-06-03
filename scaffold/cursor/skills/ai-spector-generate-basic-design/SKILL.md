---
name: ai-spector-generate-basic-design
description: >-
  Generates or updates basic design documents from the traceability graph and SRS: screen list and
  screen details, API list and endpoint details, database design under docs/basic-design/. Use when
  the user asks for basic design, wireframes, screen map, API design, ERD, or list-screens.md. Do not
  use for SRS-only work, detail design, HTML prototype, or graph analyze/index without doc generation.
paths:
  - "docs/basic-design/**"
  - ".ai-spector/templates/basic_design/**"
---

# AI Spector — Generate basic design

**Core:** [../ai-spector/SKILL.md](../ai-spector/SKILL.md)

## Required reading

1. [references/runbook.md](references/runbook.md)
2. [../ai-spector/references/generate-workflow.md](../ai-spector/references/generate-workflow.md)
3. [../ai-spector/references/generate-graph.md](../ai-spector/references/generate-graph.md) § perEndpoint / perScreen

## Checklist

```
- [ ] language confirmed (language-picker.md — check before first write)
- [ ] graph validate; SRS on disk
- [ ] index after every wave (mandatory)
- [ ] one file per endpoint row / Screen Index row — not per F-xx
```

## Natural language

“basic design”, “screen list”, “API list”, “wireframe for login” → this skill.
