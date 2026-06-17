---
name: ai-spector-resolve-task
description: >-
  FIRST CHOICE for incremental doc/graph changes: add feature, add requirement, update
  section, change prototype, "I want to…", "we need to…", create task. Tiered workflow:
  Fast (simple plan) / Standard (readiness + briefing + plan file) / Full (design spec +
  Superpowers depth). Agent proposes tier → user confirms → gates → task_approve_plan →
  execute → verify. Plan approval is task_approve_plan — NOT review_approve or spec_approve.
  Do NOT jump to edits or graph_impact before plan approval.
---

# AI Spector — Resolve Task

**Read first:** [references/runbook.md](references/runbook.md) — tier router + phased gates.

## Tiered Superpowers parity

| Tier | Depth |
|------|-------|
| **Fast** | Clarify → simple TaskPlan → approve → inline execute → verify |
| **Standard** | + workspace_check, scoped readiness, briefing, plan file |
| **Full** | + design spec approval, full writing-plans |

References: [tier-router.md](references/tier-router.md) · [resolve-standard.md](references/resolve-standard.md) · [resolve-full.md](references/resolve-full.md) · [resolve-execute.md](references/resolve-execute.md)

## You are in plan-first mode

The user described a **change**, not a full generate-from-scratch run. Propose **tier** after intent, then **plan and get approval before any write or impact tool**.

### Forbidden until the user replies **yes** to the plan

| Do NOT call | Do NOT do |
|-------------|-----------|
| `graph_impact` | Edit or Write any file |
| `index`, `graph_merge`, `resolve_task` | Generate SRS/basic-design chapters |
| `graph_validate`, `graph_report` | "Quick preview" edits |

### Allowed before approval (discover only)

`docs_search`, `graph_query_fuzzy`, `graph_query` — to find **where** a change belongs.

## Workflow (strict)

```
Phase 1  Receive intent          → task_list / task_create (resolve)
Phase 2  Tier proposal           → user confirms Fast/Standard/Full → task_update
Phase 3  Clarify                 → GoalSpec (+ scoped readiness for Standard/Full)
Phase 4  Design spec (Full only) → docs/superpowers/specs/…
Phase 5  Briefing (Std/Full)     → per-file context confirm
Phase 6  Plan                    → TaskPlan (+ plan file for Std/Full)
Phase 7  Approve                 → task_approve_plan
Phase 8  Execute                 → inline or subagent (Std/Full: user picks)
Phase 9  Verify                  → workspace_check (+ output checklist)
Phase 10 Report                  → task_complete
```

## First response template

> I'll handle this through the **resolve-task** workflow — tier first, plan before edits.
>
> Proposed tier: **…** because …
>
> Confirm: Fast / Standard / Full?
>
> To build the right plan:
> 1. …

## Checklist

```
- [ ] Proposed tier → user confirmed → snapshot.resolveTier + tierConfirmedAt
- [ ] GoalSpec complete (Standard/Full: readiness + briefing gates)
- [ ] Full: design spec approved; Std/Full: implementationPlanPath set
- [ ] Showed plan → explicit yes → task_approve_plan
- [ ] Executed → verified → task_complete
```
