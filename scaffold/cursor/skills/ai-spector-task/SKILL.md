---
name: ai-spector-task
description: >-
  Manage workflow task state: create, list, resume, pause, complete. Use for "resume my SRS task",
  "continue generation", "what tasks are in progress", "list active tasks", "pause this task".
  Every generate and resolve run should use task files — not chat memory.
paths:
  - ".ai-spector/.docflow/tasks/**"
---

# AI Spector — Task state
**Read first:** [references/runbook.md](references/runbook.md)

## When to use

| User says | Action |
|-----------|--------|
| resume / continue / pick up where we left off | `task_list` → `task_resume` → `task_get` |
| what tasks are active / in progress | `task_list({ status: ["active", "paused"] })` |
| start generate SRS | `task_create({ kind: "generate", workflow: "generate-srs", docType: "srs", trigger })` |
| start incremental change | `task_create({ kind: "resolve", workflow: "resolve", trigger })` |
| pause / stop for now | `task_pause` |
| done / finished | `task_complete` |

## MCP tools

`task_create` · `task_list` · `task_get` · `task_update` · `task_approve_plan` · `task_pause` · `task_resume` · `task_record_wave` · `task_complete` · `task_abandon`

CLI: `npx ai-spector task <subcommand>`

## Route to workflow skills

After loading task state, hand off to:
- **generate** → `ai-spector-generate-srs` or `ai-spector-generate-basic-design`
- **resolve** → `ai-spector-resolve-task`
