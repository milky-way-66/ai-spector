---
name: ai-spector
description: >-
  Core AI Spector skill: setup, upgrade, adopt, check, docops CLI, work sessions (resume/route/pause),
  and course link. Use for project init/setup, upgrade, adopting existing docs, workspace check,
  Writer contract bootstrap (docops init/migrate), resuming or managing active work sessions, or
  learning via the course. Do not use when the user clearly wants generation, graph ops, or contract
  review/comments — use the matching skill instead.
paths:
  - "package.json"
  - ".ai-spector/**"
  - ".cursor/**"
  - ".claude/**"
  - ".docops/**"
---

# AI Spector (core)

**Router:** [../_skill-router.md](../_skill-router.md) · **Workflow:** [../../WORKFLOW.md](../../WORKFLOW.md)

## Route by intent

| Intent | Runbook section |
|--------|-----------------|
| Setup / bootstrap project | [references/runbook.md — Setup](references/runbook.md#setup) |
| Upgrade ai-spector package | [references/runbook.md — Upgrade](references/runbook.md#upgrade) |
| Adopt / migrate existing docs | [references/runbook.md — Adopt](references/runbook.md#adopt) |
| Check workspace / clarifications | [references/runbook.md — Check](references/runbook.md#check) |
| Docops / Writer contract bootstrap | [references/runbook.md — Docops](references/runbook.md#docops) |
| Learn / open course | [references/runbook.md — Course](references/runbook.md#course) |
| Resume / pause / manage work sessions | [references/runbook.md — Work-Sessions](references/runbook.md#work-sessions) |

## Route to another skill

| Intent | Skill |
|--------|-------|
| Generate SRS, basic design, detail design, prototype, incremental change, template import | `ai-spector-generate` |
| Analyze, index, validate, impact, visualize, search, sync-audit | `ai-spector-graph` |
| Review queue, approve doc, comment threads, translations | `ai-spector-contract` |

## MCP invocation rule

When the `ai-spector` MCP server is configured, **call MCP tools** instead of `npx ai-spector`. MCP returns structured JSON and is the preferred channel.

| Operation | MCP tool | CLI fallback |
|-----------|----------|--------------|
| Route ambiguous intent | `workflow_route({ message })` | *(no CLI equivalent)* |
| Workspace check | `workspace_check({ fix?: boolean })` | `npx ai-spector check [--fix] [--json]` |
| Resume work session | `work_resume({ workId })` | `npx ai-spector work resume <id>` |
| List work sessions | `work_list({ status })` | `npx ai-spector work list --json` |
| Docops status | `docops_status({})` | `npx ai-spector docops status --json` |
| Translation queue status | `lang_queue({})` | `npx ai-spector lang queue pending --json` |

## CLI failure rule (non-negotiable)

When `npx ai-spector` exits non-zero or MCP returns an error:

1. **Pause** — no generation, no bulk reads, no silent workarounds.
2. **Report** per [references/cli-failures.md](references/cli-failures.md).
3. **Offer recovery** — fix and retry, bounded workaround, or pause.
4. **Continue** from the failed step after fix.

## Project anchors

| Item | Path |
|------|------|
| Contract config | `.docops/docops.config.json` |
| Engine config | `.ai-spector/engine.json` |
| Graph | `.ai-spector/graph/traceability.graph.json` |
| Work sessions | `.ai-spector/.docflow/tasks/` |
| Templates | `.ai-spector/templates/` |
| Doc output | `docs/srs/{lang}/` · `docs/basic-design/{lang}/` · `docs/detail-design/{lang}/` |

## After any batch of doc edits

```
index({ cocoindexSync: true })   # preferred: refreshes graph + embeddings
```

Or `index({})` if CocoIndex is not configured. Never skip embedding refresh when CocoIndex is set up.

## More

- [references/cli-failures.md](references/cli-failures.md)
- [references/cli-reference.md](references/cli-reference.md)
- [references/project-conventions.md](references/project-conventions.md)
- [references/workspace-check.md](references/workspace-check.md)
- [references/generate-workflow.md](references/generate-workflow.md)
- [references/graph.md](references/graph.md)
