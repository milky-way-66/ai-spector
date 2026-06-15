# Generate SRS

Full **SRS generation** from the traceability graph (gated waves). Not incremental single-feature adds.

## Start here

1. Activate skill **`ai-spector-generate-srs`**
2. Read `.cursor/skills/ai-spector-generate-srs/references/runbook.md`

## Agent steps (MCP preferred)

| Phase | Action |
|-------|--------|
| 0 | `task_list` with bootstrap `generate-srs` — create or resume task |
| 1 | `workspace_check` + `context_list` |
| 2 | Clarify gaps → context store |
| 3 | Briefing + plan table → **wait for user yes** → `task_approve_plan` |
| 4 | DAG waves → `task_record_wave` per wave → `index` |
| 5 | Offer spec extraction → `spec_list` / `spec_approve` if user wants |

## Hard gate

No writes under `docs/` until **`task_approve_plan`**.

## Not this command

| You mean | Use instead |
|----------|-------------|
| Add one feature ("add login with Google") | `ai-spector-resolve-task` |
| Approve SPEC-003 only | "approve SPEC-003" |

Routing: [skills/_skill-router.md](../skills/_skill-router.md)
