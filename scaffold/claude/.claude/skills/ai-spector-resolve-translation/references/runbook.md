# Resolve translation queue

Sync **whole document files** across languages using the translation queue as source of truth. Jobs are created automatically on `npx ai-spector index` when file hashes change.

## Usage

| You say | Agent does |
|---------|------------|
| `/resolve-translation` | List pending jobs → process all (or ask which lang) |
| `/resolve-translation jp` | Pending jobs affecting JP only |
| `/resolve-translation srs/01-overview` | Jobs for that logical document |

## Prerequisites

- `.ai-spector/docflow.config.json` has **2+ languages**
- `npx ai-spector graph validate` passes (recommended before bulk sync)

## Phase 1 — Load queue

```bash
npx ai-spector lang queue pending --json
```

Optional filter:

```bash
npx ai-spector lang queue pending --lang jp --json
```

Fast listing without git diff / graph impact (large queues):

```bash
npx ai-spector lang queue pending --no-enrich --json
```

For each job note:

| Field | Use |
|-------|-----|
| `direction` | `outbound` = primary changed → translate to targets; `inbound` = secondary changed → backport to primary + other targets |
| `origin.path` | Default source file (latest by mtime when merged) |
| `origin.mergedLangs` | Multiple langs edited same logical file — read merge context |
| `targets[]` | Langs with `status: "pending"` still need writes |
| `enrichment` | **Primary diff + impact source** (git-anchored on read) |

### Enrichment fields

Each pending job includes `enrichment` (unless `--no-enrich`):

| Field | Use |
|-------|-----|
| `enrichment.diff` | Line-level change since last reconcile (`diffSource`: `git`, `legacy_content`, or `legacy_snapshot`) |
| `enrichment.linesAdded` / `linesRemoved` | Summary counts for queue tables |
| `enrichment.impact.intraDocTargets` | Pending target paths still needing writes |
| `enrichment.impact.regenerate` | Cross-doc nodes that may need regeneration |
| `enrichment.impact.syncUpstream` | Upstream SRS/docs to sync after this change |
| `enrichment.impact.review` | Downstream docs that may need re-review |
| `enrichment.layerDrift` | When set, paths modified since last `sync snapshot` — hand off to `ai-spector-sync-audit` or cross-layer resolve-task |

**Do not invent impact paths** — use `enrichment.impact` arrays only.

**Status-only table:** use `ai-spector-lang-status` — this runbook is for **writes**.

## Phase 2 — Merge context (when needed)

When `origin.mergedLangs` is set, or edits may overlap, read the per-document changes file for edit order:

```
.ai-spector/.docflow/translation-queue/changes/{docType}--{relativePath with / → --}.json
```

Use `changes[]`:

- **`sequence` + `mtimeMs`** — edit order across languages
- **`enrichment.diff`** on the job — primary line-level context (replaces legacy `changes[].diff` reads)

For multi-lang merge detail, prefer `enrichment.diff` from `lang queue pending --json`. The `changes/` file still records per-lang edit metadata (`sequence`, `mtimeMs`, `anchor`).

If diffs conflict (same lines changed differently), **stop** and ask the user how to merge, or:

```bash
npx ai-spector lang queue fail <jobId> --reason conflict --message "..."
```

## Phase 3 — Write target files

For **each pending target** on the job:

### Outbound (primary changed)

1. Read `origin.path` (finished primary-language file).
2. Translate **entire file** to target language.
3. Write to target `path` from `targets[]`.

### Inbound (secondary changed)

1. Read `origin.path` (the lang that changed).
2. Backport meaning to **primary** language file first (if primary is a pending target).
3. Propagate from primary (or agreed merge) to other pending targets.

### Translation rules (mandatory)

From [generate-workflow.md](../../ai-spector/references/generate-workflow.md):

1. Translate all prose (headings, body, table values, bullets, notes).
2. Keep IDs verbatim: `UC-01`, `F-03`, `POST /checkout`, paths, CLI commands, code blocks.
3. No mixed-language output in one file.
4. Translate structural labels (e.g. `## Overview` → `## 概要`).

**Whole file only** — do not partial-patch unless user explicitly asked for a section-only fix.

### Cross-layer impact

When `enrichment.layerDrift.modified` is non-empty:

1. Tell the user which design-layer paths drifted since baseline.
2. Offer `npx ai-spector sync audit --json` or `ai-spector-sync-audit` skill.
3. Do not auto-regenerate — suggest resolve-task if user wants fixes.

## Phase 4 — Reconcile

After all pending targets for processed jobs are written:

```bash
npx ai-spector index
```

Index compares target hashes to baselines → marks targets `synced` → moves completed jobs to `resolved.json` and removes their `changes/` file.

Verify:

```bash
npx ai-spector lang queue pending --json
npx ai-spector lang queue resolved --limit 5
```

## Failed jobs

```bash
npx ai-spector lang queue failed --json
```

Retry after fix:

```bash
npx ai-spector lang queue retry <jobId>
```

Then re-run this runbook from Phase 3.

## Guardrails

- Do not invent queue jobs — they come from index/scan only.
- Do not skip `npx ai-spector index` after writes — resolution is automatic there.
- Read `enrichment.diff` and `enrichment.impact` — not legacy inline `changes[].diff`.
- On CLI failure → [cli-failures.md](../../ai-spector/references/cli-failures.md).
- Multi-lang merge conflicts → fail job or ask user; do not silently overwrite.

## Finish

Report per job:

| Document | Direction | Updated langs | Status |
|----------|-----------|---------------|--------|
| `srs/01-overview.md` | outbound | jp, vi | resolved |

If jobs remain pending, list why (user deferred, conflict, missing target file).
