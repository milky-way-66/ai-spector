---
name: ai-spector-resolve-translation
description: "Processes pending translation queue jobs: read origin and per-document changes, merge multi-lang edits when needed, translate or backport whole files, then index to resolve jobs. Use when the user asks to resolve translations, sync stale languages, update JP/VI from EN, process the translation queue, or backport secondary language edits."
---

# AI Spector — Resolve Translations

## When to use

- "resolve translations", "sync JP translations"
- "process translation queue"
- "update stale VI", "backport JP changes to EN"

For status only → use `ai-spector-lang-status`.

## Workflow (phases in order)

### Phase 1 — Read config and queue

```bash
# Read languages
cat .ai-spector/docflow.config.json   # → languages[]

# Ensure index is fresh
npx ai-spector index

# Read pending jobs
npx ai-spector lang queue pending --json
# Optional: filter by language
npx ai-spector lang queue pending --lang jp --json
```

### Phase 2 — Read per-job context

For each pending job, read changes file if present:
`.ai-spector/.docflow/translation-queue/changes/{docType}--{path}.json`

Fields:
- `changes[].lang` — which language changed
- `changes[].diff` — line-level diff (`{line} -` removed, `{line} +` added)
- `changes[].sequence` + `mtimeMs` — edit order when multiple langs changed same file
- Latest file by mtime = default sync source

### Phase 3 — Write target file(s)

- Write **whole file** (not patches)
- Enforce translation rules from `.ai-spector/docflow.config.json`
- For merged jobs: combine non-overlapping edits from each lang's diff

### Phase 4 — Resolve

```bash
npx ai-spector index
```

This moves resolved jobs from `pending.json` to `resolved/`.

## Checklist

```
- [ ] Read docflow.config.json → languages[]
- [ ] Ran npx ai-spector index (before reading queue)
- [ ] Ran lang queue pending --json
- [ ] Read changes/{docType}--{path}.json for each job needing merge context
- [ ] Wrote whole target file(s) with translation rules applied
- [ ] Ran npx ai-spector index to resolve jobs
- [ ] Reported resolved jobs to user
```
