---
name: ai-spector-generate-basic-design
description: "Generates basic design documents (screen list, API list, DB design) from the knowledge graph. Use when the user asks for wireframes, screen list, API design, or basic design."
---

# AI Spector — Generate Basic Design

## When to use

- "screen list", "API design", "wireframes", "basic design"

## Prerequisites

- SRS exists and is complete
- `npx ai-spector graph validate` passes

## Workflow

```
1. Read DAG config → .ai-spector/.docflow/config/dag.basic-design.json
2. Generate per wave
3. After each wave: npx ai-spector index
4. Final: graph impact + index
```

## After generation

```bash
npx ai-spector graph impact --git --change content_change --json
npx ai-spector index
```

## Checklist

```
- [ ] graph validate passes
- [ ] Generated per DAG wave order
- [ ] Ran index after each wave
- [ ] Ran graph impact + index after finishing
```
