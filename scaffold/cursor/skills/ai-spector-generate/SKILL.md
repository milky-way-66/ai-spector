---
name: ai-spector-generate
description: >-
  Routes document-generation requests to the correct skill based on the active template pack.
  Use when the user says "generate docs", "generate requirements", "write SRS", or names a
  document type without specifying a layer. Always checks packs.active before routing.
---

# AI Spector — Generate (router)

## Step 0 — Check active pack (always first)

Read `.ai-spector/docflow.config.json`. Check `packs.active`.

| `packs.active` | Action |
|----------------|--------|
| Not set or `"builtin"` | Route by layer below |
| Any custom pack name (e.g. `"msrs"`, `"kaopiz-srs"`) | Switch to skill `ai-spector-generate-<packname>` |

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
