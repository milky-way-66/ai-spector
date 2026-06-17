# Resolve task — Standard tier

Extends Fast with generate-style gates **scoped to affected paths only**.

**Load:** [workspace-check.md](../../ai-spector/references/workspace-check.md), [context-readiness.md](../../ai-spector/references/context-readiness.md), [plan-and-briefing.md](../../ai-spector/references/plan-and-briefing.md), [context-store.md](../../ai-spector/references/context-store.md)

## Gate order

```
tier → check → clarify (+ scoped readiness) → briefing → plan file → approve → execute → verify → report
```

Mark `design` step **skipped**.

## 1. workspace_check

Same as generate CHECK — fix errors before continuing.

Record `snapshot.workspaceCheckAt`, mark `check` done.

## 2. Clarify + scoped readiness

Fill GoalSpec (domain, scope, criteria, notes).

Run `readiness_assess` for the **affected doc type only** (infer from scope paths). Show criteria table for nodes that match scope — not the full DAG.

Set `snapshot.readinessReportShown`, mark `clarify` done.

## 3. Briefing

Per affected file: criteria covered, sources, assumptions. User confirms.

Set `snapshot.briefingConfirmedAt`, mark `briefing` done.

## 4. Implementation plan file

Write bite-sized plan to:

`docs/superpowers/plans/YYYY-MM-DD-resolve-<slug>.md`

Follow Superpowers writing-plans structure (exact paths, steps, verify commands). No placeholders.

Set `snapshot.implementationPlanPath`.

## 5. Plan table + approval

Show GoalSpec + TaskPlan in chat (reference plan file path). Wait for explicit **yes** → `task_approve_plan`.

## 6–8. Execute / verify / report

See [resolve-execute.md](./resolve-execute.md).
