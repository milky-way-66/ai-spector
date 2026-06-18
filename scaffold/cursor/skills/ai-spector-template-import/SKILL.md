---
name: ai-spector-template-import
description: >-
  Gated template pack import: template_scan, smart aspect-driven clarify, pack design spec,
  manifest plan approval, template_install. Use for "set up template pack", "import my template",
  "custom template". NOT for generate SRS/docs or builtin template switch.
paths:
  - ".ai-spector/packs/**"
  - ".ai-spector/docflow.config.json"
---

# AI Spector — Template Pack Import

## HARD-GATE — clarify

**Never** post a numbered list of 5–9 generic questions (legacy Phase 1).

**Always:**

1. `template_scan` → `task_create` (import) → `template_infer`
2. Follow [references/import-clarify.md](references/import-clarify.md)
3. Ask only `unknown` / `ambiguous` aspects + open `supplementalQuestions`
4. Batch **confirm-or-correct** for `inferred` proposals — do not MCQ every inferred row

## Required reading

| Step | Doc |
|------|-----|
| Full pipeline | [references/runbook.md](references/runbook.md) |
| Clarify | [references/import-clarify.md](references/import-clarify.md) |
| Aspects + MCP | [references/import-aspects.md](references/import-aspects.md) |

## Load when needed

| Phase | Load |
|-------|------|
| Generate skill | [references/skill-outline.md](references/skill-outline.md) |
| Readiness | [references/readiness-setup.md](references/readiness-setup.md) |
| Builtin gap matrix | [references/pack-gap-matrix.md](references/pack-gap-matrix.md) |

## Slash command

`/template-import` — routing override for this skill.
