# Generate SRS

Full **SRS generation** from the traceability graph (gated waves). Not incremental single-feature adds.

## Orchestrator

Spawn **`generate-srs`** worker — brief: [../subagents/generate-srs.md](../subagents/generate-srs.md)

## Worker steps (MCP preferred)

| Phase | Action |
|-------|--------|
| 0 | `task_list` with bootstrap `generate-srs` — create or resume task |
| 1 | `workspace_check` + `context_list` |
| 2 | Clarify gaps → context store |
| 3 | Briefing + plan table → **wait for user yes** → `task_approve_plan` |
| 4 | DAG waves → `task_record_wave` per wave → `index` |
| 5 | Offer spec extraction → hand off to **`spec-queue`** worker if user wants |

## Hard gate

**No writes under `docs/srs/`** until `task_approve_plan`.

## Not this command

| You mean | Use instead |
|----------|-------------|
| "add login with Google" | resolve-task worker |
| Approve document | `/review` |
| Approve SPEC-003 | spec-queue after extract |

References: [skills/ai-spector-generate-srs/references/runbook.md](../skills/ai-spector-generate-srs/references/runbook.md), [skills/ai-spector/references/generate-workflow.md](../skills/ai-spector/references/generate-workflow.md)
