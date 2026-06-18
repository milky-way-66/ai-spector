# Workflow triggers (routing override)

Natural language usually works — Claude Code matches skill `description` and [_skill-router.md](../skills/_skill-router.md).

When routing picks the **wrong workflow**, say `workflow: <name>`. **The trigger wins** over skill matching for that turn.

| Say | Skill | Use when |
|---------|-------|----------|
| `workflow: generate-srs` | `ai-spector-generate-srs` | Full SRS from graph (gated generate) |
| `workflow: generate-basic-design` | `ai-spector-generate-basic-design` | Screen/API basic design (gated generate) |
| `workflow: generate-detail-design` | `ai-spector-generate-detail-design` | Detail design from graph — **not** resolve-task |
| `workflow: resolve-task` | `ai-spector-resolve-task` | Incremental add/update ("add login", "update section") |
| `workflow: review` | `ai-spector-review` | Document sign-off (`review_approve`) |
| `workflow: task` | `ai-spector-task` | Resume or list active generation/resolve tasks |
| `workflow: check` | `ai-spector-check` | Workspace structure, pre-commit blockers, clarifications |
| `workflow: graph` | `ai-spector-graph` | Analyze data source, index, validate graph |
| `workflow: resolve-comments` | `ai-spector-resolve-comments` | Comment inbox → plan → commit |
| `workflow: adopt` | `ai-spector-adopt` | Migrate legacy docs into ai-spector layout |
| `workflow: template-import` | `ai-spector-template-import` | Gated custom template pack import (scan → install) |

Still unsure? Say **"help me approve"** or ask the agent to call **`workflow_route({ message })`**.

Pipeline overview: [WORKFLOW.md](../../WORKFLOW.md)
