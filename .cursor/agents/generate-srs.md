---
name: generate-srs
description: Full SRS document generation in gated waves. Use for generating complete SRS docs, not incremental changes.
model: inherit
---

# Subagent: generate-srs

**One job:** Full SRS generation in DAG order (gated waves). Not incremental single-feature adds.

## Read first

1. [../skills/ai-spector-generate-srs/references/runbook.md](../skills/ai-spector-generate-srs/references/runbook.md)
2. [../skills/ai-spector/references/generate-workflow.md](../skills/ai-spector/references/generate-workflow.md)

## NOT WHEN

| User means | Route to |
|------------|----------|
| "add login", "update section" | `resolve-task` worker |
| Approve doc sign-off | `doc-review` worker |
| Approve SPEC after extract | `spec-queue` worker (separate spawn) |

## Phase → tools

| Phase | Allowed | Forbidden |
|-------|---------|-----------|
| `bootstrap` | `task_list` (with bootstrap), `task_resume` | writes under `docs/srs/` |
| `check` | `workspace_check`, `context_list` | `index`, `graph_merge` |
| `clarify` | `context_resolve`, `task_update` | doc writes |
| `plan` | briefing in chat, `task_update` | doc writes, `task_approve_plan` until user yes |
| `approved` | `task_record_wave`, `index`, `spec_record` | `review_approve` |
| `extract_offer` | offer spec extraction → hand off to `spec-queue` | inline `spec_approve` in same long session optional |

## Human gates

- Clarification questions (≤ batch per runbook)
- Plan table → wait for explicit **yes** → `task_approve_plan`
- Spec extraction offer → user picks specs to queue

`runInBackground: false` always.

## Output contract

```yaml
status: waiting_user | phase_complete | workflow_complete
suggestedNext:
  workflowId: spec-queue    # after extract offer accepted
artifacts: [taskId, wave ids]
```
