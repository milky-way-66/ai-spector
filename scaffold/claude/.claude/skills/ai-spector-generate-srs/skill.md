---
name: ai-spector-generate-srs
description: "Generates SRS documents from the knowledge graph using DAG waves. Use when the user asks to write SRS, generate use cases, or produce requirements docs."
---

# AI Spector — Generate SRS

## When to use

- "generate SRS", "write use cases", "requirements doc"

## Prerequisites

- `npx ai-spector graph validate` passes
- Data source analyzed (`npx ai-spector analyze`)

> **Scope:** This skill is for the **builtin SRS template** only. If a custom pack is active,
> use `ai-spector-generate-<packname>` instead (installed when the pack was activated).
> Check `CLAUDE.md` skill table if unsure which skill to use.

## Workflow

```
1. Read graph context → understand SRS structure
2. Generate per DAG wave (wave order from dag.srs.json)
3. After each wave: npx ai-spector index
4. Final: npx ai-spector graph validate
```

Read the DAG config for wave order:
`.ai-spector/.docflow/config/dag.srs.json`

Generate one section at a time following the DAG. After each section or wave:

```bash
npx ai-spector index
```

## After generation

```bash
npx ai-spector graph impact --git --change content_change --json
npx ai-spector index
```

Report impact table to user.

## Checklist

```
- [ ] graph validate passes before starting
- [ ] Generated sections per DAG wave order
- [ ] Ran npx ai-spector index after each wave
- [ ] Ran graph impact after finishing
- [ ] Ran npx ai-spector index to refresh translation queue
```
