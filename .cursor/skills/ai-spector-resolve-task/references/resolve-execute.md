# Resolve task — execute, verify, complete

After `task_approve_plan` only.

## Execution choice (Standard / Full)

```
Plan saved to <implementationPlanPath>

How should I execute?
1. Subagent-driven — fresh subagent per plan task, review between tasks
2. Inline — this session with TodoWrite checkpoints
```

Record via **`task_set_execution_mode({ taskId, mode: "inline" | "subagent" })`** or `task_update` snapshot.

**Fast tier:** inline only — no prompt.

## Inline

- TodoWrite per plan task
- Edit steps: Edit/Write; MCP steps: `resolve_task({ taskId })`
- Stop on blocker — ask skip / retry / stop

## Subagent-driven

Adapt Superpowers subagent-driven-development for **doc edits**:

- Implementer: plan task + GoalSpec + file paths + style refs
- Spec reviewer: matches plan + criteria
- Quality reviewer: template compliance, traceability

Parent constructs context per subagent — no chat history inheritance.

## Verify (before `task_complete`)

| Tier | Checks |
|------|--------|
| Fast | `workspace_check({ paths: changed })` |
| Standard | + `readiness_output_checklist({ paths })` — score in chat |
| Full | + map each GoalSpec criterion to evidence; spec self-review |

Mark `verify` done, then `task_complete`.

## Report template

```
✓ Task task-abc — COMPLETE (tier: standard)
  Plan: docs/superpowers/plans/...
  Execution: inline

Steps:
  ✓ [s1] <file>
  ✓ verify — workspace_check pass
```
