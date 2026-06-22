---
name: ai-spector-docops
description: >-
  Bootstrap or migrate the Writer .docops/ contract for Kari Writer. Use when the user asks to
  init docops, migrate legacy layout, fix empty templates in Writer, or set up the Writer contract.
  Do not use for full ai-spector project setup — use ai-spector-setup instead.
---

# AI Spector — Docops / Writer contract

**Core:** [../ai-spector/skill.md](../ai-spector/skill.md)

## Runbook

Read [references/runbook.md](references/runbook.md).

## CLI only (no MCP)

| Step | Command |
|------|---------|
| Assess | `npx ai-spector docops status --json` |
| Init | `npx ai-spector docops init --lang <codes>` |
| Migrate | `npx ai-spector docops migrate` |
| Repair | `npx ai-spector docops migrate --repair` |
| Templates | `npx ai-spector docops migrate --templates-only` |

## Natural language triggers

"migrate to docops", "init docops", "kari writer templates empty", "writer contract",
"docops migrate", ".docops setup", "legacy layout" → this skill.

For **full ai-spector bootstrap** (`.ai-spector/`, skills, hooks): `ai-spector-setup` — not this skill.
