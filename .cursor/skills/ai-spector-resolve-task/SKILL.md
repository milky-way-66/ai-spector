---
name: ai-spector-resolve-task
description: >-
  FIRST CHOICE for incremental doc/graph changes: add feature, add requirement, update
  section, change prototype, "I want to…", "we need to…", create task. Mandatory
  workflow: clarify → show GoalSpec + TaskPlan → wait for explicit yes →
  task_approve_plan → then execute. Plan approval is task_approve_plan — NOT
  review_approve (document sign-off; use ai-spector-review) or spec_approve (SPEC-NNN).
  Do NOT jump to edits or graph_impact before plan approval. Do NOT use generate-srs
  for single-feature additions.
paths:
  - "docs/**"
  - "prototype/**"
  - ".ai-spector/**"
---

# AI Spector — Resolve Task

## Subagent worker

**workflowId:** `resolve-task` · **Brief:** [../../agents/resolve-task.md](../../agents/resolve-task.md)

Orchestrator spawns this worker. Workers do not call `workflow_route` or read `_skill-router.md`.

**Read first:** [references/runbook.md](references/runbook.md) — follow every phase in order.

## You are in plan-first mode

The user described a **change**, not a full generate-from-scratch run. Your job is to **plan and get approval before any write or impact tool**.

### Forbidden until the user replies **yes** to the plan

| Do NOT call | Do NOT do |
|-------------|-----------|
| `graph_impact` | Edit or Write any file |
| `index`, `graph_merge`, `resolve_task` | Generate SRS/basic-design chapters |
| `graph_validate`, `graph_report` | "Quick preview" edits |
| Bulk reads of `docs/**` for writing | Run impact "to check scope" |

### Allowed before approval (discover only)

`docs_search`, `graph_query_fuzzy`, `graph_query` — to find **where** a change belongs. No impact, no edits.

## Workflow (strict)

```
Phase 1  Receive intent          → task_list / task_create (resolve)
Phase 2  Clarify (≤3 questions) → fill GoalSpec fields
Phase 3  Discover (optional)    → read-only lookup for scope
Phase 4  Show plan              → GoalSpec + TaskPlan table
Phase 5  Wait for approval      → task_update + task_approve_plan
Phase 6  Execute                → edits + resolve_task({ taskId })
Phase 7  Report                 → task_complete + summary
```

**Never skip Phase 2–5.** "Add login with Google" is not specific enough — you still clarify domain, target file/section, and done criteria.

## First response template

When this skill activates, start like this (adapt to the user's message):

> I'll handle this through the **resolve-task** workflow — plan first, execute after you approve.
>
> To build the right plan:
> 1. …
> 2. …
> 3. …

Do not run tools in this first message unless the user already named exact file paths.

## Triggers → this skill (not generate-*)

| User says | Route here |
|-----------|------------|
| "I want to add login with Google" | **this skill** |
| "add a requirement for …" | **this skill** |
| "update the SRS section on …" | **this skill** |
| "change prototype theme" | **this skill** |
| "generate SRS" / "write chapter 4" | `ai-spector-generate-srs` |
| "generate basic design" / "screen list" | `ai-spector-generate-basic-design` |

## Checklist

```
- [ ] Announced resolve-task workflow (plan-first)
- [ ] Asked clarifying questions → GoalSpec complete
- [ ] Showed GoalSpec + TaskPlan → got explicit yes
- [ ] Executed approved steps only
- [ ] Reported state update
```
