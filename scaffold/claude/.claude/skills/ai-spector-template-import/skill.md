---
name: ai-spector-template-import
description: >-
  Guides the user through the three-factor template pack import workflow: read scan result, ask
  intent questions, draft manifest, refine template files, and install. Use when the user says
  "set up template pack", "import my template", "install template", "use my own template",
  "custom template", or similar. Do NOT use for "generate SRS", "generate docs", or
  "use builtin template" — those route to other skills.
---

# AI Spector — Template Pack Import

## Required reading

[references/runbook.md](references/runbook.md) — follow all phases in order.

## Load when needed

| Phase | Load |
|-------|------|
| Phase 5 — Write generate skill | [references/skill-outline.md](references/skill-outline.md) |
| Readiness + gated workflow (custom packs) | [references/readiness-setup.md](references/readiness-setup.md) |
| Builtin vs custom gap matrix | [references/pack-gap-matrix.md](references/pack-gap-matrix.md) |

## Natural language

"set up template pack", "import my template", "install template", "use my own template",
"custom template" → this skill.
