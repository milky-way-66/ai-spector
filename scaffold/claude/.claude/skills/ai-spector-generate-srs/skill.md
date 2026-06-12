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

## Step 0 — HARD GATE

Do **not** run `workspace_check` or write under `docs/srs/` until `task_create` or `task_resume` is done.
Empty `tasks/index.json` (`active: {}`) still requires `task_create`.
`workspace_check({ paths })` reports **TASK-003** (warning) without an approved generate task.
Use `task_list({ bootstrap: … })` for single-call task setup; `task_status` for active slots.

## Workflow (gated — stages 1–4 before any write)

```
0. TASK      task_list → task_create(generate-srs) or task_resume
1. CHECK     workspace_check({}) — fix errors before continuing (CLI: npx ai-spector check)
2. CLARIFY   readiness_config + readiness_assess → present FULL criteria table
             (ID, ISO ref, status) → snapshot.readinessReportShown → optional
             web search → FULL gap set → context_record every blocking gap.
             task_update: clarify in-progress → done (blocked until report shown).
3. BRIEFING  state per document: graph nodes pulled (and which are empty),
             data-source files used, applied Q-xxx answers, open assumptions,
             template, and notable context NOT used → user confirms
4. PLAN      plan table (output × DAG × criteria IDs × ISO refs × sources × key
             points, wave order from dag.srs.json) → wait for explicit "yes".
             Never write before it.
5. GENERATE  per DAG wave; after each wave: readiness_scan →
             readiness_output_checklist → agent output compliance table →
             index → task_record_wave (see output-compliance.md)
6. EXTRACT   pull key specs → offer spec_record → set snapshot.extractOffered
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
- [ ] readiness_config called; FULL readiness table shown (ID + ISO + status); snapshot.readinessReportShown
- [ ] All blocking gaps answered or accepted (context store)
- [ ] task_update: check, clarify, briefing, plan steps marked done
- [ ] Context briefing confirmed by user
- [ ] Plan table includes criteria IDs + ISO refs; approved with explicit "yes"
- [ ] graph validate passes before starting
- [ ] Generated sections per DAG wave order
- [ ] readiness_scan + readiness_output_checklist; output compliance table shown to user
- [ ] Ran npx ai-spector index after each wave
- [ ] Ran graph impact after finishing
- [ ] Offered extracted key specs (spec_record); snapshot.extractOffered set
- [ ] task_complete or task_pause offered at session end
- [ ] Ran npx ai-spector index to refresh translation queue
```
