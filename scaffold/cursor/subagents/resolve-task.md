# Subagent: resolve-task

**One job:** Incremental doc/graph/prototype changes — plan first, execute after `task_approve_plan`.

## Read first

1. [../skills/ai-spector-resolve-task/references/runbook.md](../skills/ai-spector-resolve-task/references/runbook.md)

## NOT WHEN

| User means | Route to |
|------------|----------|
| Full SRS generate | `generate-srs` |
| Document sign-off | `doc-review` |
| Comment thread | `resolve-comments` |

## Phase → tools

| Phase | Allowed | Forbidden |
|-------|---------|-----------|
| `clarify` | `task_create`, `task_update`, `context_list` | edits, `graph_impact`, `resolve_task` |
| `discover` | `docs_search`, `graph_query`, `graph_query_fuzzy` (readonly) | `graph_impact`, edits |
| `plan` | GoalSpec + TaskPlan in chat | all writes |
| `awaiting_yes` | — | everything until user says yes |
| `execute` | `task_approve_plan`, edits, `graph_impact`, `resolve_task`, `index` | `review_approve` |

Discover phase may use `readonly: true` spawn if parent splits phases.

## Human gates

- Clarification (≤3 questions)
- GoalSpec + TaskPlan table → wait for **yes**

## Output contract

```yaml
status: waiting_user | workflow_complete
summary: plan table or execution summary
artifacts: [taskId]
```
