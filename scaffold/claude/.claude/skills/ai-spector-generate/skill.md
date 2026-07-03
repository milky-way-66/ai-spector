---
name: ai-spector-generate
description: >-
  All document generation: SRS, basic design, detail design, HTML prototype; incremental feature/section
  changes (resolve-task); and template pack import. Use for "generate SRS/basic design/detail design",
  "write chapter N", "add feature", "update section", "I want to add…", "HTML prototype",
  "set up template pack". Local adapter generates via MCP/CLI even when capabilities.generate is false (Writer cloud UI only).
---

# AI Spector — Generate

**Core:** [../ai-spector/skill.md](../ai-spector/skill.md) · **Workflow:** [../../WORKFLOW.md](../../WORKFLOW.md)

## Step 0 — Incremental vs full generate

| User intent | Route to |
|-------------|----------|
| Add / update / change one feature, section, API, screen; "I want to…" | [Resolve-Task section](references/runbook.md#resolve-task) |
| Set up / import a template pack | [Template-Import section](references/runbook.md#template-import) |
| Backfill SRS from basic/detail design; derive upstream | [SRS section](references/runbook.md#srs) with `sourceMode: derive-downstream` |
| Generate SRS / basic design / detail design / prototype from graph | Continue below |

## Step 1 — Check active packs

Read `docops.config.json`. `capabilities.generate: false` hides Writer cloud generate UI only — proceed via MCP/CLI when local adapter is set up. Check `packs.srs` and `packs.basicDesign`.

| Pack field | Value | Action |
|------------|-------|--------|
| `packs.srs` | `"builtin"` | Use SRS runbook |
| `packs.srs` | custom pack name | Use `ai-spector-generate-<packname>` skill (run `npx ai-spector template use <packname>` if missing) |
| `packs.basicDesign` | `"builtin"` | Use basic-design runbook |
| `packs.basicDesign` | custom pack name | Use `ai-spector-generate-<packname>` skill |

Detail design is builtin only today. Prototype routes directly to the prototype runbook.

## Route by layer (builtin only)

| Layer | Runbook section |
|-------|-----------------|
| SRS (requirements, use cases) | [references/runbook.md — SRS](references/runbook.md#srs) |
| Basic design (screens, APIs, DB) | [references/runbook.md — Basic-Design](references/runbook.md#basic-design) |
| Detail design (feature-level) | [references/runbook.md — Detail-Design](references/runbook.md#detail-design) |
| HTML prototype / mockups | [references/runbook.md — Prototype](references/runbook.md#prototype) |
| Incremental change | [references/runbook.md — Resolve-Task](references/runbook.md#resolve-task) |
| Template pack import | [references/runbook.md — Template-Import](references/runbook.md#template-import) |

## Checklist

```
- [ ] Matched runbook section read completely
- [ ] Work session bootstrapped (work_create / work_list with bootstrap)
- [ ] Gated: workspace check → clarify → briefing → plan → work_approve_plan → waves
- [ ] MCP first → CLI fallback — see ai-spector/skill.md#mcp-invocation-rule
- [ ] On failure: pause → report → fix per ai-spector/references/cli-failures.md
- [ ] No .docops/guide/ links
```

## Shared references

- [../ai-spector/references/generate-workflow.md](../ai-spector/references/generate-workflow.md) — gated flow, translation prompt, guardrails
- [../ai-spector/references/generate-graph.md](../ai-spector/references/generate-graph.md) — graph query, DAG hints
- [../ai-spector/references/plan-and-briefing.md](../ai-spector/references/plan-and-briefing.md)
- [../ai-spector/references/extract-specs.md](../ai-spector/references/extract-specs.md) — stage 6 spec queue
