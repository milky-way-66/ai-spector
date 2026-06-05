---
name: ai-spector-setup
description: >-
  One-shot AI Spector project setup for Cursor: install dependency, scaffold, git hook, skills,
  and verify checklist. Use when the user asks to set up, initialize, or bootstrap an ai-spector
  project, or "help me get started". Do not use for generating SRS or analyzing data — use task
  skills after setup completes.
paths:
  - "package.json"
  - ".ai-spector/**"
  - ".cursor/**"
---

# AI Spector — Project setup

**Core:** [../ai-spector/SKILL.md](../ai-spector/SKILL.md)

## Required reading

[references/runbook.md](references/runbook.md) — follow phases in order.

## Checklist

```
- [ ] setup --check (audit)
- [ ] npm install -D ai-spector (if package.json and dep missing)
- [ ] setup --yes --languages <codes> --install-dep
- [ ] Tell user: enable skills, reload MCP, add docs/data-source/
```

## Natural language

"setup ai-spector", "initialize project", "bootstrap docflow", "get started with ai-spector" → this skill.
