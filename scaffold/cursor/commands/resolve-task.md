# Resolve task (incremental change)

**Routing override:** activate **`ai-spector-resolve-task`** immediately.

Do **not** use generate skills (`generate-srs`, `generate-basic-design`, `generate-detail-design`) for single-feature adds or section updates.

Read `.cursor/skills/ai-spector-resolve-task/SKILL.md` and `references/runbook.md` before any tool call.

## Bootstrap

```
task_list({
  status: ["active", "paused"],
  bootstrap: {
    kind: "resolve",
    trigger: "<user text after this command>"
  }
})
```

## Tiered flow

1. Propose **Fast / Standard / Full** → `task_confirm_tier` after user agrees
2. **Full:** design spec → `task_approve_design_spec`
3. **Standard/Full:** `workspace_check`, readiness, briefing (per tier)
4. TaskPlan → user **yes** → `task_approve_plan` only
5. Execute → verify → `task_complete`

**Forbidden until plan approval:** `graph_impact`, edits under `docs/` or `prototype/`, `resolve_task`.

## Not this command

| You mean | Use instead |
|----------|-------------|
| Full SRS / BD / DD from graph | `/generate-srs`, `/generate-basic-design`, `/generate-detail-design` |
| Document sign-off | `/review` |
| Yes to a generate plan only | `task_approve_plan` in active generate task |

References: [tier-router.md](../skills/ai-spector-resolve-task/references/tier-router.md)
