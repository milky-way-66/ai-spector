---
name: ai-spector-generate-detail-design
description: >-
  Generates detail design chapters from the traceability graph in DAG order (common patterns,
  feature list, per-feature detail). Do NOT use for incremental adds like "update feature X section"
  — use ai-spector-resolve-task instead. Do not use for SRS, basic design, HTML prototype, or
  graph-only analyze/index tasks.
paths:
  - "docs/detail-design/**"
  - ".ai-spector/templates/detail_design/**"
---

# Generate Detail Design
## Step 0 — HARD GATE (before anything else)

**Do not** run `workspace_check`, read templates, or write under `docs/detail-design/` until task state exists.

```
task_list({
  status: ["active", "paused"],
  bootstrap: {
    kind: "generate",
    workflow: "generate-detail-design",
    docType: "detail-design",
    trigger: "<user request>"
  }
})
  → activeForSlot → task_resume(taskId)
  → bootstrapped   → continue with new task id
```

### Forbidden before `task_approve_plan`

- Edit / Write under `docs/detail-design/`
- `index`, `graph_merge`, spec extraction

After plan approval: each DAG wave ends with `readiness_scan` → `workspace_check` → `task_record_wave`.
Mark clarify done only after `snapshot.readinessReportShown`. Mark complete only after `snapshot.extractOffered`.

## Load at start
1. Step 0 above (task_list → create or resume)
2. [references/runbook.md](references/runbook.md)
3. [../ai-spector/references/generate-workflow.md](../ai-spector/references/generate-workflow.md) — gated flow + task state
4. Run `workspace_check` and `context_list({ docType: "detail-design" })` before planning

## Load when needed

| Situation | Load |
|---|---|
| Clarify gaps / stale Q-ids | [../ai-spector/references/clarify.md](../ai-spector/references/clarify.md), [../ai-spector/references/context-store.md](../ai-spector/references/context-store.md) |
| Briefing + plan gate | [../ai-spector/references/plan-and-briefing.md](../ai-spector/references/plan-and-briefing.md) |
| Graph queries / merge | [../ai-spector/references/generate-graph.md](../ai-spector/references/generate-graph.md) |
| After generation (spec extraction) | [../ai-spector/references/extract-specs.md](../ai-spector/references/extract-specs.md) |
| CLI fails | [../ai-spector/references/cli-failures.md](../ai-spector/references/cli-failures.md) |

## On CLI failure
Pause. Report full output. Offer fix + retry. Details in cli-failures.md.

"detail design", "feature detail design", "dd/feature-list" → this skill.
