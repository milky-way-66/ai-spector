# Project layout — configure paths (self-service)

This guide helps you **point Writer at your existing docs** without automated file moves.

**Related:** [MIGRATION.md](../MIGRATION.md) (contract migration) · run `npx ai-spector docops layout --prompt`

---

## Principles

1. **Do not move markdown unless you choose to** — set `docTypes.*.path` in `.docops/docops.config.json` to folders that already contain your files.
2. **Repo-root-relative paths** — use `docs/srs`, not `srs`.
3. **Languages** — recommended layout is per-language subfolders: `docs/srs/en/…`, `docs/srs/vi/…`. Flat layouts (`docs/srs/1-intro.md`) work if you set `primaryLanguage` and accept single-language generation.
4. **Templates** — customize files under `.docops/templates/{srs,basic-design,detail-design}/`; repair copies builtins only when folders are empty.

---

## Recommended folder map

| Layer | Config key | Typical path | Notes |
|-------|------------|--------------|-------|
| SRS | `docTypes.srs` | `docs/srs` | Per-lang: `docs/srs/{en,vi,jp}/` |
| Basic design | `docTypes.basicDesign` | `docs/basic-design` | Same pattern |
| Detail design | `docTypes.detailDesign` | `docs/detail-design` | Often `enabled: false` until needed |
| Other | `docTypes.otherDocument` | `docs/other` | Optional catch-all, usually disabled |
| Data source | (convention) | `docs/data-source/` | Context for agents, not a docType |

**Legacy aliases** (point config here if your repo uses them):

- `docs/dd/`, `docs/detail_design/` → set `detailDesign.path` accordingly
- `docs/bd/` → set `basicDesign.path` to `docs/bd`

---

## Workflow

```bash
# 1. See disk vs config (read-only)
npx ai-spector docops layout --prompt

# 2. Edit .docops/docops.config.json (paths, languages, templatesPath)

# 3. Fill contract gaps
npx ai-spector docops migrate --repair

# 4. Index + registry
npx ai-spector index
npx ai-spector docops registry sync

# 5. Verify
npx ai-spector docops check --prompt
```

---

## Common patterns

### Already on `docs/srs/en/` (canonical)

Set paths to defaults; run `docops migrate --repair` for optional layers (`detailDesign`, `otherDocument`).

### Flat SRS (`docs/srs/*.md`)

Either:

- **A (preferred):** Keep files in place, set `primaryLanguage: "en"` (or your lang), flat is OK for single-language projects.
- **B:** Manually move to `docs/srs/en/` when you want multi-language folders.

### Docs live outside `docs/`

Set `docTypes.srs.path` (and others) to the real folder, e.g. `specs/srs` or `documentation/requirements`.

### Custom template packs

Copy/edit templates under `.docops/templates/…` before generate. For wholly custom packs, use **template-import** workflow first.

---

## Writer UI

After git push, set **Project Settings → storage layout** to `docops` when `.docops/docops.config.json` is on your branch. See MIGRATION.md §2.1.
