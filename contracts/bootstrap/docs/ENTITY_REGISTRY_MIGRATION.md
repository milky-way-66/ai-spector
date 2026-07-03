# Entity registry migration guide

> **Greenfield projects:** `docops init` and `docops migrate --repair` scaffold **entityId** keying by default (`.docops/registry/`, review registry v4). Path-keyed layouts are **legacy only** and will be removed in a future release.
>
> **Note:** `.docops/registry/documents/` is created by `docops registry sync` (also run automatically on init/repair/index when design docs exist). An empty project has no entity files until the first sync.

> **Audience:** Teams on legacy path-keyed docops (comments, prototype screen-map, review queue v3) migrating to stable **entity IDs** in `.docops/registry/`.  
> **Prerequisite:** [MIGRATION.md](MIGRATION.md) — contract layout (`legacy` → `docops`) should be done first (or in parallel on the same branch).

**Related:** [README.md](README.md) · [modules/comments.md](modules/comments.md) · [modules/prototype.md](modules/prototype.md) · [examples/full-docops.config.json](../examples/full-docops.config.json)

---

## What changes

| Before (legacy) | After (entity registry) |
|-----------------|---------------------------|
| Comments at `comments/{logical_path}/` | `comments/documents/{entityId}/` or `comments/screens/{screenId}/` |
| `prototype/screen-map.json` | `registry/screens/{screenId}.json` + `registry/manifest.json` |
| Review queue keyed by `logicalPath` (v3) | Keys = `entityId` (v4) |
| APIs filter by `filePath` | Prefer `entityId` / `screenId` (`filePath` deprecated one release) |

**Source of truth:** git files under `.docops/registry/` — **not** a Postgres mirror. Kari Writer caches registry reads in **Redis** (invalidated on git push via repo generation bump). The existing `git_document_registry` table still lists design docs from `docs/` scans; it is separate from entity JSON files.

---

## 1. Detect readiness

On the branch you will migrate, confirm:

| Check | Path | Required |
|-------|------|----------|
| Docops contract | `.docops/docops.config.json` | Yes |
| Registry path configured | `"paths": { "registry": ".docops/registry", ... }` | Yes |
| Markdown in place | `docs/` per `docTypes.*.path` | Yes |
| Writer storage layout | Project Settings → `docops` when `.docops/` paths are live | Yes before Writer reads |

Legacy screen-map may still exist until step 2 runs — `registry sync` imports then removes it.

---

## 2. Migration commands (ordered)

Run **on each git branch** that should use ID-keyed artifacts (e.g. `main`, release branches). Install [ai-spector](https://www.npmjs.com/package/ai-spector) locally or use `npx`.

```bash
# Preview (no writes)
npx ai-spector docops registry sync --dry-run
npx ai-spector docops comments migrate --dry-run
npx ai-spector docops review-registry migrate --dry-run

# Apply
npx ai-spector docops registry sync
npx ai-spector docops comments migrate
npx ai-spector docops review-registry migrate
```

Or use the bundled script (from repo root):

```bash
bash .docops/guide/scripts/migrate-entity-registry.sh --dry-run
bash .docops/guide/scripts/migrate-entity-registry.sh
```

### Step 2a — `registry sync`

- Scans `docs/` and creates/updates `registry/documents/{entityId}.json`
- Reuses existing `git_document_registry.registry_id` UUIDs when Writer DB is linked (optional; IDs are assigned in git if unknown)
- Imports `screen-map.json` → `registry/screens/*.json` + `registry/manifest.json`, then **deletes** legacy screen-map files
- Safe to re-run; does not overwrite unrelated files

### Step 2b — `comments migrate`

- Moves `comments/{path}/` → `comments/documents/{entityId}/` or `comments/screens/{screenId}/`
- Backfills `meta_data.json`: `targetId`, `commentType`; drops redundant `filePath` from storage shape
- **Requires** registry from step 2a so paths resolve to entity IDs

### Step 2c — `review-registry migrate`

- Rekeys `.docops/review-queue/registry.json` from v3 (path keys) to v4 (`entityId` keys)
- Strips path fields from entries; resolve paths from registry at read time

---

## 3. Writer configuration

1. **Storage layout:** Project Settings → Docops → set `storage_layout` to **`docops`** once `.docops/` contract paths exist on the working branch.
2. **Comments API:** List/create with `entityId` (documents) or `screenId` (prototype). `filePath` still works but returns `Deprecation` / `Sunset` headers until 2026-12-31.
3. **Cache:** After git push, Writer bumps Redis generation — registry JSON is re-read from git; no manual DB sync for entity files.

---

## 4. Legacy layout (`storage_layout: legacy`)

If the project still uses repo-root `comments/` or `prototype/screen-map.json` (not under `.docops/`):

1. Complete [MIGRATION.md §2](MIGRATION.md#2-path-reference-legacy--contract) path copy first
2. Set Writer `storage_layout: docops`
3. Run §2 commands above — comment folders follow the configured `paths.comments` root

---

## 5. Verify

### Git tree

```bash
ls .docops/registry/documents/    # one JSON per design doc
ls .docops/registry/screens/      # one JSON per prototype screen
test -f .docops/registry/manifest.json
# screen-map should be gone after sync (unless --skip-screen-map)
test ! -f .docops/prototype/screen-map.json || echo "WARN: legacy screen-map still present"
```

### Comments

```bash
npx ai-spector comments list --entity <uuid> --json
npx ai-spector comments list --screen-id <screenId> --type prototype --json
```

### Writer UI

- [ ] Documents tree loads
- [ ] Document comments visible after renaming a doc path (re-run `registry sync` on branch)
- [ ] Prototype gallery / per-screen comments work
- [ ] Review queue shows correct docs

### API deprecation

Requests using only `filePath` receive:

```http
Deprecation: true
Sunset: Sat, 31 Dec 2026 23:59:59 GMT
Link: </contracts/bootstrap/docs/MIGRATION.md#61-comment-storage-keys>; rel="deprecation"
```

Update clients to send `entityId` or `screenId`.

---

## 6. Rollback (emergency)

Entity migration touches git only. To roll back **before push**:

```bash
git checkout -- .docops/registry .docops/comments .docops/review-queue .docops/prototype
```

If already pushed, restore from a pre-migration tag/branch. Dual-read of legacy comment paths is **not** guaranteed after the migration window — keep a backup branch.

---

## 7. For AI agents

| Rule | Detail |
|------|--------|
| Order | `registry sync` → `comments migrate` → `review-registry migrate` |
| Branch scope | Run on every branch that needs ID-keyed artifacts |
| No DB entity mirror | Do not insert into Postgres from `registry/documents/*.json`; git + Redis cache only |
| screen-map | Do not recreate `screen-map.json` after sync; use `registry/screens/` |
| UUID stability | Never change `entityId` / `screenId` when paths move — only update path fields inside entity JSON |

---

## 8. Schema references

| File | Schema |
|------|--------|
| `registry/documents/{id}.json` | [schemas/registry/document.entity.schema.json](../schemas/registry/document.entity.schema.json) |
| `registry/screens/{id}.json` | [schemas/registry/screen.entity.schema.json](../schemas/registry/screen.entity.schema.json) |
| `registry/manifest.json` | [schemas/registry/manifest.schema.json](../schemas/registry/manifest.schema.json) |

Examples: [examples/registry/](../examples/registry/)

---

## 9. Troubleshooting

| Symptom | Fix |
|---------|-----|
| Comments missing after migrate | Re-run `registry sync`; confirm `entityId` in document JSON matches thread `targetId` |
| `comments migrate` skips threads | Path not in registry — fix `repoDocs` / `logicalPath`, sync again |
| Prototype screens empty | Run `registry sync` to import screen-map; or `npx ai-spector prototype manifest` |
| Writer still reads screen-map | Confirm `storage_layout: docops` and registry has `screens/` |
| Stale prototype list in UI | Wait ~30s for Redis cache or push a noop commit to bump generation |

---

*After migration, see [MIGRATION.md §8](MIGRATION.md#8-after-migration) for ongoing contract maintenance.*
