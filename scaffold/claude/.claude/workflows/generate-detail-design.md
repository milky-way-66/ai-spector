# Generate detail design

**Workflow trigger:** activate **`ai-spector-generate-detail-design`** immediately.

Do **not** use `ai-spector-resolve-task`, `task_confirm_tier`, or resolve-tier gates.

Read `.claude/skills/ai-spector-generate-detail-design/skill.md` and `references/runbook.md` before any tool call.

## Bootstrap

```
task_list({
  status: ["active", "paused"],
  bootstrap: {
    kind: "generate",
    workflow: "generate-detail-design",
    docType: "detail-design",
    trigger: "<user text after this command>"
  }
})
```

## Gated flow (mandatory)

1. **CHECK** — `workspace_check` → `snapshot.workspaceCheckAt`
2. **CLARIFY** — `readiness_assess({ docType: "detail-design" })` → criteria table → context store
3. **BRIEFING** — per-file context → `snapshot.briefingConfirmedAt`
4. **PLAN** — plan table → user **yes** → `task_approve_plan` only
5. **GENERATE** — DAG waves → `task_record_wave` → `index` each wave

**Forbidden:** any write under `docs/detail-design/` before `task_approve_plan`.

## Not this command

| You mean | Use instead |
|----------|-------------|
| Update one feature or section | `workflow: resolve-task` |
| Sign off a document | `workflow: review` |
| Approve extracted SPEC-NNN | "approve SPEC-001" (spec queue) |

References: [generate-workflow.md](../skills/ai-spector/references/generate-workflow.md)
