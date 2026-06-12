---
name: ai-spector-generate-srs
description: "Generates SRS documents from the knowledge graph using DAG waves. Use when the user asks to write SRS, generate use cases, or produce requirements docs."
---

# AI Spector — Generate SRS

## When to use

- "generate SRS", "write use cases", "requirements doc"

## Prerequisites

- `npx ai-spector graph validate` passes
- Data source analyzed (`npx ai-spector index`)

> **Scope:** This skill is for the **builtin SRS template** only. If a custom pack is active,
> use `ai-spector-generate-<packname>` instead (installed when the pack was activated).
> Check `CLAUDE.md` skill table if unsure which skill to use.

## Workflow (gated — stages 1–4 before any write)

```
1. CHECK     workspace_check({}) — fix errors before continuing (CLI: npx ai-spector check)
2. CLARIFY   compute the FULL gap set (completeness rules + empty graph seeds +
             context_list({ docType: "srs", status: "open" }) and "stale")
             → ask the user about every gap, store each answer immediately via
             context_record / context_resolve. No question cap; generation is
             blocked until every gap is answered or explicitly accepted as an
             assumption. Stale Q-ids: show old answer, re-confirm.
3. BRIEFING  state per document: graph nodes pulled (and which are empty),
             data-source files used, applied Q-xxx answers, open assumptions,
             template, and notable context NOT used → user confirms
4. PLAN      plan table (output × DAG node × sources × key points, wave order
             from dag.srs.json) → wait for explicit "yes". Never write before it.
5. GENERATE  per DAG wave; after each wave: npx ai-spector index
6. EXTRACT   pull key specs (decisions, constraints, NFR thresholds) from the
             generated docs → offer to queue: spec_record({ docType: "srs", specs })
             → user reviews with spec_list / spec_approve / spec_reject.
             Approved specs merge to the graph; NEVER write to docs/data-source/.
```

Always set `sourceRefs` on recorded answers — `index` flips entries to stale
when those files change, and the next run re-asks only the stale questions.

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
- [ ] workspace_check passed (no errors)
- [ ] All clarification gaps answered or accepted (stored in context store)
- [ ] Context briefing confirmed by user
- [ ] Plan table approved with explicit "yes" before first write
- [ ] graph validate passes before starting
- [ ] Generated sections per DAG wave order
- [ ] Ran npx ai-spector index after each wave
- [ ] Ran graph impact after finishing
- [ ] Offered extracted key specs for review (spec_record)
- [ ] Ran npx ai-spector index to refresh translation queue
```
