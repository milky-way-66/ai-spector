---
name: ai-spector-generate-detail-design
description: >-
  FULL GENERATE workflow for detail design from the graph (common → feature list → per-feature).
  Uses gated CHECK → CLARIFY → BRIEFING → PLAN → GENERATE — NOT resolve-task tier workflow.
  Do NOT use for incremental edits ("update feature X section") — use ai-spector-resolve-task.
---

# Generate Detail Design

> **This is a generate workflow**, not resolve-task. Do **not** use `task_confirm_tier` or resolve-tier gates.
> Follow [generate-workflow.md](../ai-spector/references/generate-workflow.md) end-to-end.

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

## Gated flow (mandatory — same as SRS / basic design)

```
1. CHECK     workspace_check → snapshot.workspaceCheckAt
2. CLARIFY   readiness_assess({ docType: "detail-design" }) → full criteria table → context store
3. BRIEFING  per-file context → snapshot.briefingConfirmedAt
4. PLAN      plan table → explicit user yes → task_approve_plan
5. GENERATE  DAG waves → readiness_scan + output compliance → task_record_wave → index each wave
6. EXTRACT   offer spec_record → snapshot.extractOffered → task_complete
```

### Forbidden before `task_approve_plan`

- Edit / Write under `docs/detail-design/`
- `index`, `graph_merge`, spec extraction
- Resolve-task tools (`task_confirm_tier`, `resolve_task` for doc edits)

After plan approval: each DAG wave ends with `readiness_scan` → `readiness_output_checklist` → agent compliance → `workspace_check` → `task_record_wave` → **`index`**.

## Load at start

1. Step 0 above (task_list → create or resume)
2. [references/runbook.md](references/runbook.md)
3. [../ai-spector/references/generate-workflow.md](../ai-spector/references/generate-workflow.md)
4. `workspace_check` + `context_list({ docType: "detail-design" })`

## Load when needed

| Situation | Load |
|---|---|
| Readiness assessment (before clarify) | [../ai-spector/references/context-readiness.md](../ai-spector/references/context-readiness.md) |
| Clarify gaps / stale Q-ids | [../ai-spector/references/clarify.md](../ai-spector/references/clarify.md), [../ai-spector/references/context-store.md](../ai-spector/references/context-store.md) |
| User adds chapters mid-session | [../ai-spector/references/incremental-continuation.md](../ai-spector/references/incremental-continuation.md) |
| Briefing + plan gate | [../ai-spector/references/plan-and-briefing.md](../ai-spector/references/plan-and-briefing.md) |
| Output compliance (after each wave) | [../ai-spector/references/output-compliance.md](../ai-spector/references/output-compliance.md) |
| Graph queries / merge | [../ai-spector/references/generate-graph.md](../ai-spector/references/generate-graph.md) |
| After generation (spec extraction) | [../ai-spector/references/extract-specs.md](../ai-spector/references/extract-specs.md) |
| Writing guides | [references/dd-context/](./references/dd-context/) |
| CLI fails | [../ai-spector/references/cli-failures.md](../ai-spector/references/cli-failures.md) |

## Checklist

```
- [ ] task_list bootstrap generate-detail-design (NOT resolve task)
- [ ] CHECK → CLARIFY → BRIEFING → PLAN → task_approve_plan
- [ ] Each wave: write → readiness_scan → compliance → task_record_wave → index
- [ ] Offer spec extraction → task_complete
```

"detail design", "feature detail design", "generate detail design", "I want to generate detail design" → **this skill**.
