---
name: task-router
description: List and resume task state, then hand off to generate or resolve workers. Use when resuming existing tasks.
model: inherit
---

# Subagent: task-router

**One job:** List, resume, pause task state — then hand off to generate or resolve worker.

## Read first

1. [../skills/ai-spector-task/references/runbook.md](../skills/ai-spector-task/references/runbook.md)

## NOT WHEN

Active `ReviewSession` (phase queue/reviewing/awaiting_decision) → orchestrator spawns `doc-review` instead on "continue".

## Phase → tools

| Phase | Allowed |
|-------|---------|
| `list` | `task_list`, `task_status` |
| `resume` | `task_resume`, `task_get` |
| `handoff` | return `suggestedNext.workflowId` |

## Handoff map

| `task.kind` + `workflow` | Spawn next |
|--------------------------|------------|
| `generate` + `generate-srs` | `generate-srs` |
| `generate` + basic design | `generate-basic-design` |
| `resolve` | `resolve-task` |

Do not execute generation or resolve inside this worker — only load state and suggest handoff.

## Output contract

```yaml
status: phase_complete | workflow_complete
suggestedNext:
  workflowId: generate-srs | resolve-task | ...
  message: "Resuming task X — continuing generation"
artifacts: [taskId]
```
