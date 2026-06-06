# AI Spector — Claude Agent Rules

You are working in an **AI Spector** managed project. The agent workflow is: read skills, run `npx ai-spector` CLI, report results. You do not write doc content from scratch — CLI + skills do the work.

Enable all skills under `.claude/skills/` before starting.

## Mandatory Rules

### 1. Refresh index before any staleness check

Before checking translation status, pending queue, or "what's outdated":

```bash
npx ai-spector index
```

Then read the queue. **Never read `.ai-spector/.docflow/translation-queue/pending.json` without running index first** — the queue is only accurate after indexing.

### 2. Check impact before finishing any doc edit

After editing any file under `docs/srs/`, `docs/basic-design/`, or `docs/detail-design/`, run impact before closing the task:

```bash
npx ai-spector graph impact --git --change content_change --json
```

Then run index to refresh the translation queue:

```bash
npx ai-spector index
```

Skip only when the user explicitly says it was a typo-only fix with no traceability concern.

### 3. Use CLI and graph — not file search

When you need to find, query, or understand the project graph:

| Need | Use |
|------|-----|
| Find what needs regeneration | `npx ai-spector graph impact` |
| Find doc/section/node | `npx ai-spector graph query <id> --json` |
| Check graph health | `npx ai-spector graph validate` |
| See pending translations | `npx ai-spector lang queue pending --json` (after index) |
| Find a node by name | `npx ai-spector graph query <text> --json` |

**Only fall back to `grep` or `Read` when the CLI returns no results or you need raw file content for editing.**

## Skill → task mapping

| You want to… | Skill |
|-------------|-------|
| Analyze data source / build graph | `ai-spector-graph` |
| Check impact of changes | `ai-spector-graph` |
| Import / set up custom template pack | `ai-spector-template-import` |
| Write SRS | `ai-spector-generate-srs` |
| Write basic design | `ai-spector-generate-basic-design` |
| HTML prototype | `ai-spector-generate-prototype` |
| Translation status | `ai-spector-lang-status` |
| Resolve translations | `ai-spector-resolve-translation` |
| Resolve comments | `ai-spector-resolve-comments` |

## CLI quick reference

```bash
npx ai-spector analyze              # ingest data-source, build graph
npx ai-spector index                # refresh fingerprints + translation queue
npx ai-spector graph validate       # check graph integrity
npx ai-spector graph impact --git --json   # impact of current git diff
npx ai-spector lang queue pending --json   # pending translation jobs
npx ai-spector setup --check        # audit project setup
npx ai-spector template list        # list installed packs + active
npx ai-spector template scan <path> # scan a template folder → scan-result.json
npx ai-spector template install     # install pack from staging (AI writes manifest first)
npx ai-spector template use <name>  # switch active pack (use "builtin" to revert)
```

On CLI failure: show the output, offer fix / workaround / pause. Do not invent results.

## Pipeline order

```
analyze → validate graph → generate SRS → index
  → generate basic design → index
  → generate detail design
  → prototype setup → generate HTML screens
```
