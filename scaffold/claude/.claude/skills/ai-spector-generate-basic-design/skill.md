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

## Workflow (gated — stages 1–4 before any write)

```
1. CHECK     workspace_check({}) — fix errors first (CLI: npx ai-spector check)
2. CLARIFY   full gap set for docType "basic-design" (completeness rules +
             empty graph seeds + context_list open/stale entries) → ask user,
             store every answer via context_record / context_resolve.
             Every gap answered or explicitly accepted before generating.
3. BRIEFING  per document: graph nodes used, data-source files, applied Q-xxx
             answers, open assumptions, template, context NOT used → confirm
4. PLAN      plan table (output × DAG node × sources × key points, wave order
             from dag.basic-design.json) → explicit "yes" before any write
5. GENERATE  per wave; after each wave: npx ai-spector index
6. EXTRACT   key specs → spec_record({ docType: "basic-design", specs }) →
             review via spec_list / spec_approve / spec_reject.
             NEVER write extracted specs to docs/data-source/.
```

## After generation

```bash
npx ai-spector graph impact --git --change content_change --json
npx ai-spector index
```

## Checklist

```
- [ ] workspace_check passed (no errors)
- [ ] All clarification gaps answered or accepted (stored in context store)
- [ ] Context briefing confirmed + plan approved with explicit "yes"
- [ ] graph validate passes
- [ ] Generated per DAG wave order
- [ ] Ran index after each wave
- [ ] Ran graph impact + index after finishing
- [ ] Offered extracted key specs for review (spec_record)
```
