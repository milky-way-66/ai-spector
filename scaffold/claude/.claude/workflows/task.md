# Task (resume / manage)

**Workflow trigger:** activate **`ai-spector-task`** immediately.

Read `.claude/skills/ai-spector-task/skill.md` and `references/runbook.md`.

## Steps

1. `task_list({ status: ["active", "paused"] })` — show table
2. User picks task → `task_resume` / `task_get`
3. Route to the task's workflow skill (`generate-*` or `resolve-task`) and continue from snapshot phase

Do **not** call `task_approve_plan` unless user explicitly approves the **plan table** shown in chat.

## Not this command

| You mean | Use instead |
|----------|-------------|
| Start new full SRS | `workflow: generate-srs` |
| Start incremental change | `workflow: resolve-task` |
| Document sign-off | `workflow: review` |
