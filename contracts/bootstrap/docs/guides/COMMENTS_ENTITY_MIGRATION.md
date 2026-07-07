# Comment storage — legacy path → entity ID migration

> **Audience:** Teams with comment threads under path-keyed folders who want stable **entityId** / **screenId** storage.  
> **Full registry migration:** [ENTITY_REGISTRY_MIGRATION.md](../ENTITY_REGISTRY_MIGRATION.md) (comments are step 2b in that runbook).

---

## Layout comparison

### Legacy (path-keyed)

Threads are stored by **logical document path** (no `docs/` prefix, `.md` stripped):

```text
.docops/comments/
├── srs/01-overview/
│   └── {thread_id}/
│       ├── meta_data.json
│       ├── events.jsonl
│       └── {comment_id}
└── prototype/
    └── src/login.html/
        └── {thread_id}/
            └── …
```

`meta_data.json` uses `filePath` as the primary key. Renaming or moving a doc in git breaks the folder path unless you manually move threads.

### Entity registry (recommended)

Threads are stored by **stable IDs** from `.docops/registry/`:

```text
.docops/comments/
├── documents/
│   └── {entityId}/          # UUID from registry/documents/{entityId}.json
│       └── {thread_id}/
│           └── …
└── screens/
    └── {screenId}/          # from registry/screens/{screenId}.json
        └── {thread_id}/
            └── …
```

After migration, `meta_data.json` includes:

| Field | Purpose |
|-------|---------|
| `targetId` | `entityId` (documents) or `screenId` (prototype) |
| `commentType` | `"document"` or `"prototype"` |
| `filePath` | Human-readable path label (anchor + display; not the storage key) |

Renaming `docs/srs/01-overview.md` only updates registry JSON — comment threads stay under the same `entityId`.

---

## Prerequisites

| Check | Command / path |
|-------|----------------|
| Docops contract | `.docops/docops.config.json` with `capabilities.comments: true` |
| Registry path | `"paths": { "registry": ".docops/registry", "comments": ".docops/comments" }` |
| Design docs indexed | `docs/` contains SRS/BD/DD markdown |
| Registry populated | `npx ai-spector docops registry sync` (creates `registry/documents/*.json`) |

If `registry/documents/` is empty, **comments migrate will skip every thread** with a warning.

---

## Migration steps

Run on **each git branch** that should use entity-keyed comment folders (e.g. `main`, active release branches).

### 1. Preview

```bash
npx ai-spector docops registry sync --dry-run
npx ai-spector docops comments migrate --dry-run
```

Review output:

- **registry sync** — which document entities will be created/updated
- **comments migrate** — lines like `move srs/01-overview/{threadId} → documents/{entityId}/{threadId}`

### 2. Apply registry sync first

```bash
npx ai-spector docops registry sync
```

This must run **before** comment migration so each legacy `filePath` resolves to an `entityId`.

### 3. Migrate comment folders

```bash
npx ai-spector docops comments migrate
```

For each legacy thread:

1. Resolves `entityId` (documents) or `screenId` (prototype) from registry + `meta_data.json`
2. Copies thread folder to `comments/documents/{entityId}/` or `comments/screens/{screenId}/`
3. Updates `meta_data.json` with `targetId` and `commentType`
4. Removes the legacy folder

Safe to re-run: already-migrated threads (under `documents/` or `screens/`) are skipped.

### 4. Verify

```bash
# List by entity (preferred)
npx ai-spector comments list --entity <entityId> --json

# Prototype
npx ai-spector comments list --screen-id <screenId> --type prototype --json

# Legacy path still works as a filter during deprecation window
npx ai-spector comments list --file srs/01-overview --json
```

Confirm in git:

```bash
ls .docops/comments/documents/
test ! -d .docops/comments/srs || echo "WARN: legacy srs/ comment tree still present"
```

### 5. Commit

```bash
git add .docops/registry .docops/comments
git commit -m "chore: migrate comment threads to entityId layout"
```

---

## One-shot script

From repo root (after `.docops/guide/scripts/` is scaffolded):

```bash
bash .docops/guide/scripts/migrate-entity-registry.sh --dry-run
bash .docops/guide/scripts/migrate-entity-registry.sh
```

Or skip non-comment steps:

```bash
bash .docops/guide/scripts/migrate-entity-registry.sh --skip-review
```

---

## CLI after migration

| Action | Legacy filter | Preferred filter |
|--------|---------------|------------------|
| List | `--file srs/01-overview` | `--entity <uuid>` |
| Show | `--file …` | `--entity …` |
| Create | `--file srs/01-overview` | `--entity <uuid>` |
| Reply | `--file …` | `--entity …` |
| Resolve | `--file …` | `--entity …` |

Create/reply resolve storage location via registry: when `entityId` is known, threads are written under `comments/documents/{entityId}/` automatically.

---

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| `comments migrate` skips all threads | Registry empty or path mismatch | Run `registry sync`; check `logicalPath` in `registry/documents/*.json` matches thread `filePath` |
| Warning: `No registry target for thread …` | Doc not in registry (wrong path, missing file) | Add/fix markdown under `docs/`; re-run `registry sync` |
| Destination exists, thread skipped | Duplicate thread id under target | Inspect both folders; merge manually or remove duplicate |
| Comments visible in CLI but not Writer | Writer `storage_layout` still `legacy` | Project Settings → Docops → `storage_layout: docops` |
| Prototype threads not moved | Screen not in registry | Run `registry sync` (imports screen-map) or add `registry/screens/*.json` |

---

## Rollback (before push)

```bash
git checkout -- .docops/comments .docops/registry
```

Keep a backup branch before migrating production release branches.

---

## Related

- [ENTITY_REGISTRY_MIGRATION.md](../ENTITY_REGISTRY_MIGRATION.md) — full registry + review queue migration
- [modules/comments.md](../modules/comments.md) — comment module overview and CLI create/reply
- [MIGRATION.md](../MIGRATION.md) — legacy repo-root → `.docops/` contract paths
