---
name: ai-spector-generate
description: >-
  Routes full document-generation requests to the correct skill based on active template packs.
  Use for "generate docs", "generate SRS", "write chapter N" (DAG waves from graph). If the user
  wants to add/update a single feature or section ("I want to add…"), route to ai-spector-resolve-task
  instead. Always checks packs.srs and packs.basicDesign before routing.
---

# AI Spector — Generate (router)

## Subagent note

Orchestrator may spawn **`spec-queue`** worker for SPEC-NNN approval — brief: [../../agents/spec-queue.md](../../agents/spec-queue.md). Full generate → `generate-srs` / `generate-basic-design` workers.

## Step 0 — Incremental vs full generate

| User intent | Route to |
|-------------|----------|
| add / update / change one feature, section, API, screen | `ai-spector-resolve-task` |
| generate SRS / basic design / full chapter from graph | continue below |

## Step 1 — Check active packs (always first)

Read `.ai-spector/docflow.config.json`. Check `packs.srs` and `packs.basicDesign` independently.

| Field | Value | Action |
|-------|-------|--------|
| `packs.srs` | `"builtin"` | Use `ai-spector-generate-srs` for SRS requests |
| `packs.srs` | custom pack name (e.g. `"kaopiz-srs"`) | Use `ai-spector-generate-<packname>` for SRS requests |
| `packs.basicDesign` | `"builtin"` | Use `ai-spector-generate-basic-design` for screens/APIs/DB requests |
| `packs.basicDesign` | custom pack name | Use `ai-spector-generate-<packname>` for basic-design requests |

For custom packs, the dedicated `ai-spector-generate-<packname>` skill was written when the pack was installed. It loads `generate-hints.md` + the pack DAG and follows `generate-workflow.md`. Use it instead of the builtin layer skills.

If the pack-specific skill does not exist yet (pack was installed before this version), run:
```bash
npx ai-spector template use <packname>
```
This regenerates the skill file.

## Route by layer (builtin only)

Ask one question or infer from context, then switch skill:

| Layer | Skill |
|-------|-------|
| Requirements / SRS | `ai-spector-generate-srs` |
| Screens, APIs, DB | `ai-spector-generate-basic-design` |
| HTML mockups | `ai-spector-generate-prototype` |
