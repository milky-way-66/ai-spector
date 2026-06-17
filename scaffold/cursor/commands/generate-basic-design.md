# Generate basic design

**Routing override:** activate **`ai-spector-generate-basic-design`** immediately.

Read `.cursor/skills/ai-spector-generate-basic-design/SKILL.md` and `references/runbook.md` before any tool call.

## Bootstrap

```
task_list({
  status: ["active", "paused"],
  bootstrap: {
    kind: "generate",
    workflow: "generate-basic-design",
    docType: "basic-design",
    trigger: "<user text after this command>"
  }
})
```

## Gated flow

CHECK → CLARIFY → BRIEFING → PLAN → user **yes** → `task_approve_plan` → waves → `index`.

**Forbidden:** writes under `docs/basic-design/` before `task_approve_plan`.

## Not this command

| You mean | Use instead |
|----------|-------------|
| Incremental screen/API tweak | `/resolve-task` |
| Detail design (feature-level) | `/generate-detail-design` |
| Document sign-off | `/review` |

References: [generate-workflow.md](../skills/ai-spector/references/generate-workflow.md)
