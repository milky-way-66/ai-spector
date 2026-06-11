---
name: ai-spector-resolve-task
description: >-
  Conversational task workflow (create task, resolve task): agent clarifies user
  intent, builds a GoalSpec + TaskPlan, shows it for approval, then executes via
  the resolve_task MCP tool or CLI. Use when the user wants to create a task,
  add/update a requirement, change a prototype, update docs, regenerate
  sections, or any multi-step doc/graph change described in natural language.
paths:
  - "docs/**"
  - "prototype/**"
  - ".ai-spector/**"
---

# AI Spector — Resolve Task

**Core:** [../ai-spector/SKILL.md](../ai-spector/SKILL.md)

## Required reading

[references/runbook.md](references/runbook.md) — follow phases in order.

## Checklist

```
- [ ] Receive user intent (free-form)
- [ ] Ask ≤3 clarifying questions → build GoalSpec
- [ ] Show GoalSpec + TaskPlan → wait for approval
- [ ] Execute via resolve_task MCP tool (or CLI)
- [ ] Report results + state update
```

## Natural language triggers → this skill

"create task", "create a task", "new task", "resolve task", "run a task",
"add requirement", "update docs", "change prototype", "new feature section",
"update SRS", "regenerate screens", "I want to…", "we need to…",
any open-ended change request that is not a full generate-from-scratch workflow.
