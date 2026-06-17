# Adopt (migrate existing docs)

**Workflow trigger:** activate **`ai-spector-adopt`**.

Read `.claude/skills/ai-spector-adopt/skill.md` and `references/runbook.md`.

## Gates

1. `workspace_check` → `adopt_scan` (Gate 1)
2. `adopt_plan` → user **approve plan** (Gate 2)
3. `adopt_apply` → user confirms bootstrap (Gate 3) → `adopt_bootstrap`
4. `adopt_validate` → user **migration complete** → `adopt_setup_mark migration.complete` (Gate 4)

**Forbidden:** `adopt_apply` before plan approved; `task_approve_plan` is **not** adopt plan approval.
