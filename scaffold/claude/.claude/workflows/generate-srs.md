# Generate SRS

**Workflow trigger:** activate **`ai-spector-generate-srs`** immediately.

Do **not** use `ai-spector-resolve-task` for full SRS generation.

Read `.claude/skills/ai-spector-generate-srs/skill.md` and `references/runbook.md` before any tool call.

## Bootstrap

```
task_list({
  status: ["active", "paused"],
  bootstrap: {
    kind: "generate",
    workflow: "generate-srs",
    docType: "srs",
    trigger: "<user text after this command>"
  }
})
```

## Gated flow

CHECK → CLARIFY → BRIEFING → PLAN → user **yes** → `task_approve_plan` → waves → `index` → offer spec extraction.

**Forbidden:** writes under `docs/srs/` before `task_approve_plan`.

## Not this command

| You mean | Use instead |
|----------|-------------|
| "add login with Google" (one feature) | `workflow: resolve-task` |
| Document sign-off | `workflow: review` |
| Approve SPEC-003 | `spec_approve` after extraction |

References: [generate-workflow.md](../skills/ai-spector/references/generate-workflow.md)
