---
name: ai-spector-lang-status
description: >-
  Shows pending, failed, and resolved translation sync jobs from the translation queue.
  Use when the user asks about translation status, which docs need updating after a change, or
  "what's stale in JP/VI". Do not use for generating or editing documents.
paths:
  - "docs/srs/**"
  - "docs/basic-design/**"
  - ".ai-spector/docflow.config.json"
  - ".ai-spector/.docflow/translation-queue/**"
---

# Language Status Check

## Steps

1. Read `.ai-spector/docflow.config.json`. Extract `languages[]`.
   - If only one language, reply: "Only one language configured — nothing to compare."

2. **Refresh the index first** — the queue is only accurate after indexing:

```bash
npx ai-spector index
```

This scans all doc files, updates fingerprints, and reconciles pending/resolved jobs in the translation queue. Skip only if the user explicitly says they just ran it.

3. Run the translation queue CLI (primary source of truth):

```bash
npx ai-spector lang queue pending --json
npx ai-spector lang queue failed --json
```

3. Render a table from `pending` jobs:

```
ID       Document              Dir       Origin  Outdated targets
a1b2     srs/02-actors.md      outbound  en      jp, vi
c3d4     srs/03-glossary.md    inbound   jp      en, vi
```

4. When `origin.mergedLangs` is set (or any pending job needs merge context), read the **per-document changes file**:

```
.ai-spector/.docflow/translation-queue/changes/srs--01-overview.md.json
```

Filename pattern: `{docType}--{relativePath with / → --}.json`

```json
{
  "version": 1,
  "docType": "srs",
  "relativePath": "01-overview.md",
  "jobId": "a1b2c3d4-...",
  "updatedAt": "2026-06-05T10:00:00.000Z",
  "changes": [
    {
      "lang": "en",
      "path": "docs/srs/en/01-overview.md",
      "previousVersion": 2,
      "version": 3,
      "sequence": 1,
      "mtimeMs": 1710000000000,
      "changedAt": "2026-06-05T10:00:00.000Z",
      "diff": "5 - English overview text.\n5 + Updated English overview.",
      "linesRemoved": 1,
      "linesAdded": 1
    },
    {
      "lang": "jp",
      "path": "docs/srs/jp/01-overview.md",
      "previousVersion": 1,
      "version": 2,
      "sequence": 2,
      "mtimeMs": 1710000001000,
      "changedAt": "2026-06-05T10:00:00.000Z",
      "diff": "5 - 日本語の概要です。\n5 + 更新された JP 概要。"
    }
  ]
}
```

- **`changes/`** — one file per logical document; canonical merge context (not inlined in `pending.json`).
- **`sequence` + `mtimeMs`** — edit order when multiple langs changed the same file.
- **`diff`** — line-level context for merge (`{line} -` removed, `{line} +` added).
- **Latest file** (`origin.lang`, by mtime) is the default sync source.
- Use each lang's `diff` to see what changed where; combine non-overlapping edits manually.
- Full append-only audit: `change-history.json`. Resolved jobs remove their `changes/` file.

6. List **failed** jobs (dismissed, errors):

```
ID       Document            Reason     Message
e5f6     srs/04-scope.md     conflict   en and jp both changed section before sync
```

5. For **how to fix** pending jobs (writes, merge, translate), use **`ai-spector-resolve-translation`** — this skill is status/report only.

## Fallback (queue empty or missing)

If `.ai-spector/.docflow/translation-queue/` does not exist or pending is empty after `npx ai-spector lang queue scan`, fall back to git mtime comparison across language folders (legacy behavior).

## Output format

Print pending jobs grouped by `direction`, then failed jobs.
List actionable items per job:
- **outbound:** "Translate section in `docs/srs/jp/02-actors.md` from primary `docs/srs/en/02-actors.md`"
- **inbound:** "Backport section from `docs/srs/jp/03-glossary.md` to primary and other langs"
- **merged:** sync from `origin.lang` (latest) to all `pending` targets; other langs in `mergedLangs` also need the latest content

## After any file edit (outside of generate skills)

When the user edits any language file directly, run `npx ai-spector index` (or `lang queue scan`). The queue enqueues section-level sync jobs automatically — no manual stale notes needed.

If the user defers translation, the job stays in `pending.json` until processed.

## Resolve (writes)

When the user wants to **sync** or **update** translations (not just status), switch to **`ai-spector-resolve-translation`**.
