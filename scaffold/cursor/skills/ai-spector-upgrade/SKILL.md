---
name: ai-spector-upgrade
description: >-
  Upgrade ai-spector to a newer package version: scan checklist, sync scaffold,
  apply config migrations, verify hooks and MCP. Use when the user says
  "upgrade ai-spector", "update ai-spector", "sync skills after update",
  "stale scaffold", "new version of ai-spector", or "continue upgrade".
  Do NOT use for greenfield setup (ai-spector-setup) or doc migration (ai-spector-adopt).
paths:
  - "package.json"
  - ".ai-spector/**"
  - ".cursor/**"
  - ".claude/**"
---

# AI Spector — Upgrade

Guided workflow to bump `ai-spector`, refresh editor scaffold, backfill config, and complete the version checklist.

**Related but different:** `ai-spector-setup` (greenfield init); `ai-spector-adopt` (migrate misplaced docs).

## Required reading

[references/runbook.md](references/runbook.md) — follow all phases in order.

## Natural language

"upgrade ai-spector", "update ai-spector", "I installed a new version", "sync skills after update",
"stale scaffold", "continue upgrade" → this skill.
