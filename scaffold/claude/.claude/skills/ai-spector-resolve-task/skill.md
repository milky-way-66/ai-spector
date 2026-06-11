---
name: ai-spector-resolve-task
description: >-
  Conversational task workflow (create task, resolve task): clarify intent, build
  GoalSpec + TaskPlan, get approval, then execute via resolve_task MCP or CLI.
  Use for create task, add/update requirements, doc edits, prototype changes, or
  any multi-step change described in natural language.
---

# AI Spector — Resolve Task

## When to use

- "create task", "create a task", "new task", "resolve task"
- "add requirement", "update docs", "change prototype", "I want to…", "we need to…"
- Any open-ended doc/graph change that is not a full generate-from-scratch workflow

## Workflow

```
1. Receive user intent (do not act yet)
2. Ask ≤3 clarifying questions → build GoalSpec
3. Show GoalSpec + TaskPlan → wait for approval
4. Execute: direct edits + resolve_task MCP (or CLI)
5. Report state update
```

Full runbook: `.cursor/skills/ai-spector-resolve-task/references/runbook.md` (same content after init/sync-cursor).

## Checklist

```
- [ ] Clarified intent → GoalSpec (domain, scope, criteria)
- [ ] Showed plan and got user approval
- [ ] Executed steps (edits + resolve_task for index/graph steps)
- [ ] Reported results + state update
```

## MCP

`resolve_task({ intent, goalSpec, plan, dryRun? })` — only after user approves the plan.

CLI fallback: `npx ai-spector resolve-task plan.json`
