---
name: ai-spector-lang-status
description: "Shows pending, failed, and resolved translation sync jobs from the translation queue. Use when the user asks about translation status, which docs need updating after a change, or 'what's stale in JP/VI'. Do not use for generating or editing documents."
---

# AI Spector — Language Status

## When to use

- "what's stale in JP / VI"
- "pending translations"
- "what needs updating after my change"
- "translation status"

## Workflow (follow in order)

### 1. Check language config

Read `.ai-spector/docflow.config.json` → `languages[]`.
If only one language: reply "Only one language configured — nothing to compare."

### 2. Refresh the index first (MANDATORY)

```
index({})                    # MCP preferred
npx ai-spector index         # CLI fallback
```

The queue is only accurate after indexing. **Never skip this step** — reading `pending.json` without indexing shows stale data.

### 3. Read the queue

**MCP (preferred):**
```
lang_queue({})                      # pending + summary
lang_queue({ status: "failed" })    # failed jobs
lang_queue({ lang: "jp" })          # filter by language
```

**CLI fallback:**
```bash
npx ai-spector lang queue pending --json
npx ai-spector lang queue failed --json
```

### 4. Render results

Pending table:

```
ID       Document              Dir       Origin  Outdated targets
a1b2     srs/02-actors.md      outbound  en      jp, vi
c3d4     srs/03-glossary.md    inbound   jp      en, vi
```

For merged jobs or fine-grained merge context, read:
`.ai-spector/.docflow/translation-queue/changes/{docType}--{relativePath with / → --}.json`

Failed table:

```
ID       Document            Reason     Message
e5f6     srs/04-scope.md     conflict   en and jp both changed section before sync
```

### 5. Actionable output per job

- **outbound:** "Translate `docs/srs/jp/02-actors.md` from primary `docs/srs/en/02-actors.md`"
- **inbound:** "Backport from `docs/srs/jp/03-glossary.md` to primary and other langs"
- **merged:** sync from origin.lang (latest) to all pending targets

To fix/write translations → switch to **`ai-spector-resolve-translation`** skill.

## Fallback

If queue is empty or missing after index, fall back to git mtime comparison across language folders.

## Checklist

```
- [ ] Read docflow.config.json → languages[]
- [ ] Ran index({}) MCP (or npx ai-spector index) — mandatory before queue read
- [ ] Ran lang_queue({}) MCP (or lang queue pending --json)
- [ ] Ran lang_queue({ status: "failed" }) MCP (or lang queue failed --json)
- [ ] Rendered pending + failed tables
- [ ] Offered resolve-translation if pending jobs exist
```
