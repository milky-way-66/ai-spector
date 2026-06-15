---
name: generate-basic-design
description: Basic design document generation (screens, APIs, DB). Use for full basic-design generation workflows.
model: inherit
---

# Subagent: generate-basic-design

**One job:** Basic design docs (screens, APIs, DB) in gated waves. Same task-state pattern as SRS.

## Read first

1. [../skills/ai-spector-generate-basic-design/references/runbook.md](../skills/ai-spector-generate-basic-design/references/runbook.md) (if present) or skill `SKILL.md`
2. [../skills/ai-spector/references/generate-workflow.md](../skills/ai-spector/references/generate-workflow.md)

## NOT WHEN

Incremental section update → `resolve-task`. Document sign-off → `doc-review`.

## Phase → tools

Same gates as `generate-srs` but `docType: basic-design`, paths under `docs/basic-design/`.

| Phase | Forbidden until `task_approve_plan` |
|-------|-------------------------------------|
| pre-plan | writes under `docs/basic-design/`, `index`, `graph_merge` |

## Human gates

Clarify → plan → user yes → `task_approve_plan` → waves.

## Output contract

Same as `generate-srs.md`.
