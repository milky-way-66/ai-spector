---
name: ai-spector-template-import
description: >-
  Guides the user through the three-factor template pack import workflow: read scan result, ask
  intent questions, draft manifest, refine template files, and install. Use when the user says
  "set up template pack", "import my template", "install template", "use my own template",
  "custom template", or similar. Do NOT use for "generate SRS", "generate docs", or
  "use builtin template" — those route to other skills.
paths:
  - ".ai-spector/packs/**"
  - ".ai-spector/docflow.config.json"
---

# AI Spector — Template Pack Import

## Required reading

[references/runbook.md](references/runbook.md) — follow all phases in order.

## Natural language

"set up template pack", "import my template", "install template", "use my own template",
"custom template" → this skill.
