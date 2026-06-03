---
name: ai-spector-generate
description: >-
  Routes ambiguous document-generation requests to the correct AI Spector layer skill (SRS, basic
  design, or HTML prototype). Use only when the user says generate docs or generate requirements
  without naming a layer. Do not use when the request clearly targets SRS, screens, APIs, or prototype HTML.
---

# AI Spector — Generate (router)

Ask one question or infer from context, then **switch skill** and read that skill's runbook:

| Layer | Skill |
|-------|-------|
| Requirements / SRS | `ai-spector-generate-srs` |
| Screens, APIs, DB | `ai-spector-generate-basic-design` |
| HTML mockups | `ai-spector-generate-prototype` |
