---
name: ai-spector-generate-basic-design
description: >-
  Generates basic design chapters from the traceability graph in DAG order (screen list, API list,
  wireframes wave). Do NOT use for incremental adds like "add an API endpoint" or "update screen X"
  — use ai-spector-resolve-task instead. Do not use for SRS-only work, HTML prototype, or graph-only
  analyze/index tasks.
paths:
  - "docs/basic-design/**"
  - ".ai-spector/templates/basic_design/**"
---

# Generate Basic Design

## Step 0 — HARD GATE (before anything else)

**Do not** run `workspace_check`, read templates, or write under `docs/basic-design/` until task state exists.

```
task_list({
  status: ["active", "paused"],
  bootstrap: {
    kind: "generate",
    workflow: "generate-basic-design",
    docType: "basic-design",
    trigger: "<user request>"
  }
})
  → activeForSlot → task_resume(taskId)
  → bootstrapped   → continue with new task id
```

### Forbidden before `task_approve_plan`

- Edit / Write under `docs/basic-design/`
- `index`, `graph_merge`, spec extraction

After plan approval: each DAG wave ends with `task_record_wave` + `workspace_check({ paths: [written files] })`.

## Load at start
1. Step 0 above (task_list → create or resume)
2. [references/runbook.md](references/runbook.md)
3. [../ai-spector/references/generate-workflow.md](../ai-spector/references/generate-workflow.md) — gated flow + task state
4. Run `workspace_check` and `context_list({ docType: "basic-design" })` before planning

## Load when needed

| Situation | Load |
|---|---|
| Readiness assessment (before clarify) | [../ai-spector/references/context-readiness.md](../ai-spector/references/context-readiness.md) |
| Clarify gaps / stale Q-ids | [../ai-spector/references/clarify.md](../ai-spector/references/clarify.md), [../ai-spector/references/context-store.md](../ai-spector/references/context-store.md) |
| User adds chapters mid-session | [../ai-spector/references/incremental-continuation.md](../ai-spector/references/incremental-continuation.md) |
| Briefing + plan gate | [../ai-spector/references/plan-and-briefing.md](../ai-spector/references/plan-and-briefing.md) |
| After generation (spec extraction) | [../ai-spector/references/extract-specs.md](../ai-spector/references/extract-specs.md) |
| Language not set | [../ai-spector/references/language-picker.md](../ai-spector/references/language-picker.md) |
| Writing DB design | [references/bd-context/db-design.md](references/bd-context/db-design.md) |
| Writing API list | [references/bd-context/api-list.md](references/bd-context/api-list.md) |
| Writing API detail (per endpoint) | [references/bd-context/api-detail.md](references/bd-context/api-detail.md) |
| Writing screen list | [references/bd-context/screen-list.md](references/bd-context/screen-list.md) |
| Writing screen detail (per screen) | [references/bd-context/screen-detail.md](references/bd-context/screen-detail.md) |
| Graph queries / merge | [../ai-spector/references/generate-graph.md](../ai-spector/references/generate-graph.md) |
| CLI fails | [../ai-spector/references/cli-failures.md](../ai-spector/references/cli-failures.md) |
| Run of 5+ files | [../ai-spector/references/context-management.md](../ai-spector/references/context-management.md) |

## On CLI failure
Pause. Report full output. Offer fix + retry. Details in cli-failures.md.

"basic design", "screen list", "API list", "wireframe for login" → this skill.
