---
name: ai-spector-generate-srs
description: >-
  Generates SRS chapters from the traceability graph in DAG order (full waves, "generate SRS",
  "write chapter 4", use case list from graph). Do NOT use for incremental adds like "add a feature",
  "I want to add login" — use ai-spector-resolve-task instead. Do not use for basic design,
  HTML prototype, or graph-only analyze/index tasks.
paths:
  - "docs/srs/**"
  - ".ai-spector/templates/srs/**"
---

# Generate SRS

## Step 0 — HARD GATE (before anything else)

**Do not** run `workspace_check`, read templates, or write under `docs/srs/` until task state exists.

```
task_list({
  status: ["active", "paused"],
  bootstrap: {
    kind: "generate",
    workflow: "generate-srs",
    docType: "srs",
    trigger: "<user request>"
  }
})
  → activeForSlot → task_resume(taskId)
  → bootstrapped   → continue with new task id
```

An empty `tasks/index.json` (`active: {}`) is **not** “ready” — `bootstrap` creates the task in the same call.

### Forbidden before `task_approve_plan`

- Edit / Write under `docs/srs/`
- `index`, `graph_merge`, spec extraction
- Proceeding because briefing/plan was shown in chat without MCP task calls

After plan approval: each DAG wave ends with `readiness_scan` → `workspace_check` → `task_record_wave`.
Mark clarify done only after `snapshot.readinessReportShown`. Mark complete only after `snapshot.extractOffered`.

## Load at start
1. Step 0 above (task_list → create or resume)
2. [references/runbook.md](references/runbook.md)
3. [../ai-spector/references/generate-workflow.md](../ai-spector/references/generate-workflow.md) — gated flow + task state
4. Run `workspace_check` and `context_list({ docType: "srs" })` before planning

## Load when needed

| Situation | Load |
|---|---|
| Readiness assessment (before clarify) | [../ai-spector/references/context-readiness.md](../ai-spector/references/context-readiness.md) |
| Clarify gaps / stale Q-ids | [../ai-spector/references/clarify.md](../ai-spector/references/clarify.md), [../ai-spector/references/context-store.md](../ai-spector/references/context-store.md) |
| User adds chapters mid-session | [../ai-spector/references/incremental-continuation.md](../ai-spector/references/incremental-continuation.md) |
| Briefing + plan gate | [../ai-spector/references/plan-and-briefing.md](../ai-spector/references/plan-and-briefing.md) |
| After generation (spec extraction) | [../ai-spector/references/extract-specs.md](../ai-spector/references/extract-specs.md) |
| Language not set | [../ai-spector/references/language-picker.md](../ai-spector/references/language-picker.md) |
| Writing §1 Introduction | [references/srs-context/introduction.md](references/srs-context/introduction.md) |
| Writing §2 Overall Description | [references/srs-context/overall-description.md](references/srs-context/overall-description.md) |
| Writing §3 UC list or UC-xx detail | [references/srs-context/use-case-detail.md](references/srs-context/use-case-detail.md) |
| Writing §4 feature list or F-xx detail | [references/srs-context/feature-detail.md](references/srs-context/feature-detail.md) |
| Writing §5 Data Requirements | [references/srs-context/data-requirements.md](references/srs-context/data-requirements.md) |
| Writing §6 External Interfaces | [references/srs-context/external-interfaces.md](references/srs-context/external-interfaces.md) |
| Writing §7 Quality Attributes | [references/srs-context/quality-attributes.md](references/srs-context/quality-attributes.md) |
| Graph queries / merge | [../ai-spector/references/generate-graph.md](../ai-spector/references/generate-graph.md) |
| CLI fails | [../ai-spector/references/cli-failures.md](../ai-spector/references/cli-failures.md) |
| Run of 5+ files | [../ai-spector/references/context-management.md](../ai-spector/references/context-management.md) |

## On CLI failure
Pause. Report full output. Offer fix + retry. Details in cli-failures.md.

"generate SRS", "write chapter 3", "feature list from graph", "all UC details" → this skill.

"add feature", "I want to add …", "update auth section" → **ai-spector-resolve-task** (plan-first).
