# AI Spector skill router

Agents use this when intent is ambiguous.

## Priority

1. **File context** — `paths` in skill frontmatter (e.g. `prototype/**` → prototype skill).
2. **Natural language** — match skill `description`; then read that skill’s `references/` runbook.
3. **Still unclear** — `ai-spector` core + one question (graph vs SRS vs basic design vs prototype vs comments).

## Task → skill → runbook

| User intent (examples) | Skill | Read first |
|------------------------|-------|------------|
| setup, init, bootstrap, get started | `ai-spector-setup` | `references/runbook.md` |
| analyze, ingest, data source, knowledge graph | `ai-spector-graph` | `references/analyze.md` |
| index, re-index, refresh graph | `ai-spector-graph` | `references/index.md` |
| validate graph | `ai-spector-graph` | `references/validate-graph.md` |
| impact, what to regenerate | `ai-spector-graph` | `references/impact.md` |
| visualize graph | `ai-spector-graph` | `references/visualize-graph.md` |
| link graph, semantic edges | `ai-spector-graph` | `references/link-graph.md` |
| sync graph | `ai-spector-graph` | `references/sync-graph.md` |
| doc summaries | `ai-spector-graph` | `references/summary.md` |
| SRS, use cases, features, requirements | `ai-spector-generate-srs` | `references/runbook.md` |
| screens, APIs, wireframes, basic design | `ai-spector-generate-basic-design` | `references/runbook.md` |
| HTML prototype | `ai-spector-generate-prototype` | `references/runbook.md` |
| review comments, C-001, inbox | `ai-spector-resolve-comments` | `references/runbook.md` |
| translation status, stale langs | `ai-spector-lang-status` | `SKILL.md` |
| resolve translations, sync JP/VI | `ai-spector-resolve-translation` | `references/runbook.md` |
| “generate docs” (no layer named) | `ai-spector-generate` | route to one skill above |

Shared: [ai-spector/references/cli-failures.md](./ai-spector/references/cli-failures.md), [generate-workflow.md](./ai-spector/references/generate-workflow.md), [generate-graph.md](./ai-spector/references/generate-graph.md).

## Pipeline

```text
analyze → validate graph → generate SRS → index
  → generate basic design → index
  → prototype setup → generate HTML screens
```

See [../WORKFLOW.md](../WORKFLOW.md).
