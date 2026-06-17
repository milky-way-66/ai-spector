# Task (resume / manage)

**Routing override:** activate **`ai-spector-task`** immediately.

Read `.cursor/skills/ai-spector-task/SKILL.md` and `references/runbook.md`.

## Steps

1. `task_list({ status: ["active", "paused"] })` — show table
2. User picks task → `task_resume` / `task_get`
3. Route to the task's workflow skill (`generate-*` or `resolve-task`) and continue from snapshot phase

Do **not** call `task_approve_plan` unless user explicitly approves the **plan table** shown in chat.

## Not this command

| You mean | Use instead |
|----------|-------------|
| Start new full SRS | `/generate-srs` |
| Start incremental change | `/resolve-task` |
| Document sign-off | `/review` |
