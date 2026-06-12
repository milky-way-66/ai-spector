---
name: ai-spector-task
description: >-
  Manage workflow task state: create, list, resume, pause, complete. Use for
  "resume my SRS task", "continue generation", "active tasks", "pause task".
---

# AI Spector — Task state

Task files live in `.ai-spector/.docflow/tasks/`. Use MCP `task_*` tools (not chat memory).

## Session start

```
task_list({ status: ["active", "paused"] })
task_get(taskId)  OR  task_create(...)
task_resume(taskId)  when paused
```

## Tools

`task_create` · `task_list` · `task_get` · `task_update` · `task_approve_plan` ·
`task_pause` · `task_resume` · `task_record_wave` · `task_complete` · `task_abandon`

CLI: `npx ai-spector task <subcommand>`

Route to `ai-spector-generate-srs`, `ai-spector-generate-basic-design`, or
`ai-spector-resolve-task` after loading state.
