# Docops manual fallback — for agents

Use this guide when **`npx ai-spector docops init`**, **`docops migrate`**, or **`docops migrate --repair`** fails (or is unavailable) and the user approves a **bounded workaround** (cli-failures option **2 Workaround** — pause, report, manual gap-fill, verify).

**Goal:** finish the same work the CLI would do — patch `.docops/docops.config.json`, fill missing scaffold files, copy templates — **without overwriting** anything that already exists.

**Related:** [MIGRATION.md](../MIGRATION.md) (full migration) · [examples/full-docops.config.json](../../examples/full-docops.config.json)

---

## When to use

| Situation | Action |
|-----------|--------|
| `command not found` / npm install blocked | Manual steps below after user approves workaround |
| `docops bootstrap bundle not found` | Point `DOCOPS_BOOTSTRAP_ROOT` at `kari-writer/contracts/bootstrap` or copy from monorepo |
| `migrate --repair` exits non-zero mid-run | Fix reported path, then **resume manual steps** for remaining gaps only |
| Writer **Set up repository** returns 409 (config exists) | Manual gap-fill (this guide), not full init |

## Hard rules (same as MIGRATION)

| Rule | Detail |
|------|--------|
| **Do not overwrite** | Skip any destination file that already exists |
| **Repo-root-relative `path`** | `docs/srs`, `docs/basic-design`, `docs/detail-design`, `docs/other` — not bare `srs` |
| **Optional layers default off** | `detailDesign` and `otherDocument` must appear in config with `"enabled": false` unless the project already enables them |
| **DD templates always scaffold** | Copy `.docops/templates/detail-design/*.md` even when `detailDesign.enabled` is `false` |

---

## 1. Locate the bootstrap bundle

Try paths in order (first directory that contains `docs/README.md` and `templates/srs/`):

```text
kari-writer/contracts/bootstrap/          # monorepo (docs-ops)
<repo>/node_modules/ai-spector/../../kari-writer/contracts/bootstrap
$DOCOPS_BOOTSTRAP_ROOT/bootstrap
$DOCOPS_CONTRACTS_ROOT/bootstrap
```

Set env for a one-off shell session if needed:

```bash
export DOCOPS_BOOTSTRAP_ROOT=/path/to/kari-writer/contracts
```

---

## 2. Patch `.docops/docops.config.json`

Read the existing file. **Merge** missing keys only — do not change `enabled` or `path` on layers the project already configured.

### Required optional doc types (if missing)

Add both blocks when absent:

```json
"detailDesign": {
  "enabled": false,
  "path": "docs/detail-design",
  "label": "Detail Design",
  "templatesPath": ".docops/templates/detail-design"
},
"otherDocument": {
  "enabled": false,
  "path": "docs/other",
  "label": "Other Document"
}
```

`otherDocument` has **no** `templatesPath` (no cloud generation).

### Path sanity

| Key | Default `path` |
|-----|----------------|
| `srs` | `docs/srs` |
| `basicDesign` | `docs/basic-design` |
| `detailDesign` | `docs/detail-design` |
| `otherDocument` | `docs/other` |

If `docs/other/` or `docs/detail-design/` already exists on disk, keep `enabled: false` in config unless the user explicitly asks to enable the layer.

---

## 3. Copy scaffold files (gap-fill only)

Let `BUNDLE` = bootstrap root from §1. For each row: **copy only if destination does not exist**.

| Source (`BUNDLE/…`) | Destination |
|---------------------|-------------|
| `docs/**` | `.docops/guide/**` (prefix: replace `docs/` with `.docops/guide/`) |
| `../schemas/**` | `.docops/guide/schemas/**` |
| `../examples/**` | `.docops/guide/examples/**` |
| `../modules/*.md` | `.docops/guide/modules/` |
| `config/review.config.json` | `.docops/review.config.json` |
| `config/review-queue-registry.json` | `.docops/review-queue/registry.json` |
| `config/review-queue-pending.json` | `.docops/review-queue/pending.json` (`{"version":2,"jobs":[]}`) |
| `config/prototype.config.json` | `.docops/prototype/config.json` |
| `config/prototype-screen-map.json` | `.docops/prototype/screen-map.json` |

Create empty dirs when needed: `.docops/comments/`, `.docops/registry/`, `.docops/prototype/`.

---

## 4. Copy templates

| Source | Destination | When |
|--------|-------------|------|
| `templates/srs/**` | `.docops/templates/srs/` | Layer enabled **and** dest has no `*.md` |
| `templates/basic-design/**` | `.docops/templates/basic-design/` | Layer enabled **and** dest has no `*.md` |
| `templates/detail-design/**` | `.docops/templates/detail-design/` | **Always** if dest has no `*.md` (even when `detailDesign.enabled` is `false`) |

Example (from repo root):

```bash
BUNDLE=kari-writer/contracts/bootstrap
DEST=.docops/templates/detail-design
test -d "$DEST" && [ "$(find "$DEST" -name '*.md' | wc -l)" -eq 0 ] \
  && mkdir -p "$DEST" && cp -R "$BUNDLE/templates/detail-design/." "$DEST/"
```

Do **not** copy templates for `otherDocument`.

---

## 5. Language placeholders (optional)

For each **enabled** `docTypes` layer and each `languages[].path`:

```text
{docTypes.<key>.path}/{lang}/.gitkeep
```

Example: `docs/srs/en/.gitkeep`. Skip disabled layers (`detailDesign`, `otherDocument` when `enabled: false`).

---

## 6. Verify and report

1. JSON-parse `.docops/docops.config.json`
2. Confirm `detailDesign` + `otherDocument` keys exist
3. Confirm `.docops/templates/detail-design/` has at least one `*.md`
4. Re-run CLI when available: `npx ai-spector docops status --json` → `writerReady: true`, no blocking gaps
5. Or walk [MIGRATION.md §5 checklist](../MIGRATION.md#5-post-migration-checklist)

Tell the user which files were **written** vs **skipped (already existed)**.

---

## 7. Writer project settings (remind user)

After git commit + push:

- Set **storage layout** to `docops` when `.docops/` paths are live on the working branch
- Enable **Detail Design** / **Other Documents** tabs in Project Settings only when the team wants those layers (separate from `docTypes.enabled`)

---

## Agent quick checklist

```text
[ ] Read existing .docops/docops.config.json
[ ] Merge detailDesign + otherDocument (enabled: false) if missing
[ ] Copy BUNDLE → .docops/guide/, review/prototype stubs (skip existing)
[ ] Copy detail-design templates if .docops/templates/detail-design/ empty
[ ] Copy srs/basic-design templates only if layer enabled and dest empty
[ ] gitkeep for enabled layers × languages
[ ] Verify JSON + template counts; report written/skipped paths
[ ] Retry npx ai-spector docops status when CLI works again
```
