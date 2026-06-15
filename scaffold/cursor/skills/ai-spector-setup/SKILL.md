---
name: ai-spector-setup
description: >-
  One-shot AI Spector project setup for Cursor: install dependency, scaffold, git hook, skills,
  and verify checklist. Use when the user asks to set up, initialize, or bootstrap an ai-spector
  project, "help me get started", or asks how to set up ai-spector. Do not use for generating
  SRS or analyzing data — use task skills after setup completes.
paths:
  - "package.json"
  - ".ai-spector/**"
  - ".cursor/**"
---

# AI Spector — Project setup

## Subagent worker

**workflowId:** `setup-check` · **Brief:** [../../subagents/setup-check.md](../../subagents/setup-check.md)

Orchestrator spawns this worker for setup flows.

**Core:** [../ai-spector/SKILL.md](../ai-spector/SKILL.md)

## Two paths

| User wants | Read |
|-----------|------|
| AI handles setup (recommended) | [references/runbook.md](references/runbook.md) |
| Manual CLI steps | [references/cli-setup.md](references/cli-setup.md) |

## Checklist (AI path)

```
- [ ] setup --check (audit)
- [ ] npm install -D ai-spector (if package.json exists and dep missing)
- [ ] Ask: which languages? (default: en)
- [ ] Ask: enable CocoIndex semantic search? (optional, requires Python 3.11+)
- [ ] setup --yes --languages <codes> --install-dep
- [ ] cocoindex setup (if user opted in)
- [ ] Tell user: enable skills in Cursor, reload MCP, add docs/data-source/
```

## Natural language triggers

"setup ai-spector", "initialize project", "bootstrap docflow", "get started",
"how do I set up ai-spector", "set up a new project" → this skill.
