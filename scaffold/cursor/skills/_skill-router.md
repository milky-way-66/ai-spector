# AI Spector skill router

Agents use this when intent is ambiguous.

## Priority

1. **Incremental change (plan-first)** — verbs *add*, *update*, *change*, *modify*, *extend*, or phrases *"I want to"*, *"we need to"*, *create task* → **`ai-spector-resolve-task`** before any generate-* skill. Example: "add login with Google" → resolve-task, **not** generate-srs.
2. **Full generation** — *generate*, *write chapter*, *DAG wave*, *from graph* → `ai-spector-generate` or layer skill.
3. **File context** — `paths` in skill frontmatter (e.g. `prototype/**` → prototype skill) when intent is still ambiguous.
4. **Natural language** — match skill `description`; then read that skill’s `references/` runbook.
5. **Still unclear** — `ai-spector` core + one question (incremental change vs full generate vs graph vs comments).

## DISAMBIGUATION: "review" means two different things

| "review" context | Correct skill |
|---|---|
| Document **approval** — approve, status, queue, "which docs reviewed", "has this been approved", "pending client review" | `ai-spector-review` |
| Comment **threads** — C-001, inbox, resolve, open threads, feedback on content | `ai-spector-resolve-comments` |

When in doubt: if the user names a document and asks about approval/status → `ai-spector-review`. If the user mentions threads, comments, or C-00N → `ai-spector-resolve-comments`.

## Task → skill → runbook

| User intent (examples) | Skill | Read first |
|------------------------|-------|------------|
| setup, init, bootstrap, get started | `ai-spector-setup` | `references/runbook.md` |
| analyze, ingest, data source, knowledge graph | `ai-spector-graph` | `references/analyze.md` |
| index, re-index, refresh graph | `ai-spector-graph` | `references/index.md` |
| validate graph | `ai-spector-graph` | `references/validate-graph.md` |
| impact, what to regenerate | `ai-spector-graph` | `references/impact.md` |
| semantic search, find docs about a concept | `ai-spector-search` | `SKILL.md` |
| fuzzy graph lookup, find node by name | `ai-spector-search` | `SKILL.md` |
| CocoIndex, embeddings, docs_search, graph_query_fuzzy | `ai-spector-search` | `SKILL.md` |
| visualize graph | `ai-spector-graph` | `references/visualize-graph.md` |
| link graph, semantic edges | `ai-spector-graph` | `references/link-graph.md` |
| sync graph | `ai-spector-graph` | `references/sync-graph.md` |
| doc summaries | `ai-spector-graph` | `references/summary.md` |
| generate docs, write SRS (full chapter/DAG), generate use cases from graph | `ai-spector-generate` | `SKILL.md` (checks `packs.srs`, then routes) |
| add feature, add requirement, update section, "I want to add…", "we need…" | `ai-spector-resolve-task` | `references/runbook.md` |
| screens, APIs, wireframes, basic design | `ai-spector-generate` | `SKILL.md` (checks `packs.basicDesign`, then routes) |
| HTML prototype | `ai-spector-generate-prototype` | `references/runbook.md` |
| set up template pack, import template, custom template, install template | `ai-spector-template-import` | `references/runbook.md` |
| create task, new task, resolve task, change prototype | `ai-spector-resolve-task` | `references/runbook.md` |
| comment threads, C-001, inbox, resolve comments, open threads | `ai-spector-resolve-comments` | `references/runbook.md` |
| document approval, approve doc, review status, review queue, "which docs reviewed", "has X been approved", "pending review", "what changed since approval", "does all document has reviewed" | `ai-spector-review` | `references/runbook.md` |
| translation status, stale langs | `ai-spector-lang-status` | `SKILL.md` |
| resolve translations, sync JP/VI | `ai-spector-resolve-translation` | `references/runbook.md` |
| “generate docs” (no layer named) | `ai-spector-generate` | `SKILL.md` |

Shared: [ai-spector/references/cli-failures.md](./ai-spector/references/cli-failures.md), [generate-workflow.md](./ai-spector/references/generate-workflow.md), [generate-graph.md](./ai-spector/references/generate-graph.md).

## Pipeline

```text
analyze → validate graph → generate SRS → index
  → generate basic design → index
  → prototype setup → generate HTML screens
```

See [../WORKFLOW.md](../WORKFLOW.md).
