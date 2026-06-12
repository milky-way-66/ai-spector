---
name: ai-spector-resolve-task
description: >-
  FIRST CHOICE for incremental changes: add feature, add requirement, update section,
  "I want to…", create task. Mandatory: clarify → plan → explicit yes → execute.
  No graph_impact or edits before approval. Not for full SRS generation — use
  ai-spector-generate-srs for DAG waves.
---

# AI Spector — Resolve Task

## Plan-first mode

**Forbidden before user approves the plan:** `graph_impact`, `index`, `graph_merge`, `resolve_task`, Edit/Write.

**Allowed for discovery only:** `docs_search`, `graph_query_fuzzy`, `graph_query`, Read (structure).

## Workflow

```
1. task_list → task_create(resolve) or task_resume
2. Clarify (≤3 questions) → GoalSpec
3. Discover scope (read-only, optional)
4. Show GoalSpec + TaskPlan → task_update + task_approve_plan after yes
5. resolve_task({ taskId }) + direct edits
6. task_complete
```

## Routing

| "I want to add login with Google" | **this skill** |
| "generate SRS" / "write chapter 4" | `ai-spector-generate-srs` |

Runbook: `.cursor/skills/ai-spector-resolve-task/references/runbook.md`
