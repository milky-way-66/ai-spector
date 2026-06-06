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

## Step 0 — Pack detection (always first)

Read `.ai-spector/docflow.config.json`. Check `packs.active`.

- **Builtin / not set** → follow the standard wave workflow below.
- **Custom pack** (any value other than `"builtin"`) → read these files before generating:
  - `.ai-spector/packs/<packs.active>/generate-hints.md` — wave structure and output paths
  - `.ai-spector/.docflow/config/dag.srs.json` — DAG nodes for this pack
  - `.ai-spector/.docflow/config/dag.srs.graph-seeds.json` — graph document ids

  For custom packs, use the graph seed ids from `dag.srs.graph-seeds.json` (not builtin
  `doc.srs.*` ids). If `graph query <id>` returns "Unknown node id", the error will list
  valid ids — use one of those.

  After primary documents (Wave 0), check `generate-hints.md` for breakout templates
  (Wave 1). Generate one breakout file per graph node of the matching `perDomainKey` type.

## Workflow

```
1. [Step 0] Detect active pack → load generate-hints.md if custom pack
2. Read graph context → understand SRS structure
3. Generate per DAG wave (wave order from dag.srs.json)
4. After each wave: npx ai-spector index
5. Final: npx ai-spector graph validate
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
