---
name: ai-spector-generate-prototype
description: >-
  Generates static HTML/CSS/JS screen prototypes from basic-design screen specs and bundled UI themes.
  Use when the user asks for HTML prototype, screen mockups, or prototype/src files. When no theme is
  stored, recommends 3 best-fit themes from project context, opens preview samples in the browser,
  and waits for the user to choose before setup. Uses stored preference on subsequent runs. Do not use
  for markdown SRS/basic design only, or graph operations without HTML output.
paths:
  - "prototype/**"
---

# Generate Prototype

## Subagent worker

**workflowId:** `generate-prototype` · **Brief:** [../../agents/generate-prototype.md](../../agents/generate-prototype.md)

Orchestrator spawns this worker. Workers do not call `workflow_route` or read `_skill-router.md`.

## Load at start
1. [references/runbook.md](references/runbook.md)

## Load when needed

| Situation | Load |
|---|---|
| No tech stack stored — **must confirm before setup** | [references/stack-picker.md](references/stack-picker.md) |
| Language not set | [../ai-spector/references/language-picker.md](../ai-spector/references/language-picker.md) |
| No theme stored — **must confirm before setup** | [references/theme-picker.md](references/theme-picker.md) |
| No basic auth stored | [references/auth-picker.md](references/auth-picker.md) |
| Before writing each screen HTML | [references/prototype-graph-context.md](references/prototype-graph-context.md) |
| SPA buildMode (vue, react, nuxt, …) | [references/spa-prototype.md](references/spa-prototype.md) |
| Run of 5+ screens | [../ai-spector/references/context-management.md](../ai-spector/references/context-management.md) |
| CLI fails | [../ai-spector/references/cli-failures.md](../ai-spector/references/cli-failures.md) |

## On CLI failure
Pause. Report full output. Offer fix + retry. Details in cli-failures.md.

"HTML prototype", "mockup screens", "prototype with stripe theme" → this skill.
"Help me pick a theme" → load theme-picker.md directly.
