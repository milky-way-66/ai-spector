# Legacy → Docops migration guide

This file is **committed to your repository** when you run **Writer → Project Settings → Docops → Set up repository** (or `docops init`). You do **not** need ai-spector installed to follow this guide — only git, Bitbucket access, and Kari Writer.

**Start here if:** the project already has documents, an old folder layout, or `.ai-spector/` files and you want the Writer `.docops/` contract.

**Related:** [README.md](README.md) (contract overview) · [modules/](modules/) (per-feature guides)

---

## For AI agents (Cursor, ai-spector, Writer automation)

Use this section when an agent migrates a repo **without** guessing paths.

### Goals

1. Commit `.docops/docops.config.json` and scaffold files **without overwriting** existing destination files.
2. Set **Writer project storage layout** (`legacy` or `docops`) to match what is on the branch.
3. Set **`docTypes.*.path`** to **repo-root-relative** folders that already hold markdown (e.g. `docs/srs`, not `srs`).

### Agent workflow (ordered)

```text
1. Detect layout (§1 table) on the target branch.
2. List existing docs folders under docs/ (or custom roots).
3. Copy legacy contract files (§2 table) — skip if destination exists.
4. Create or edit .docops/docops.config.json (§2.2, §3 Step 3).
5. Copy templates into docTypes.*.templatesPath if empty.
6. Commit + push.
7. In Writer: Project Settings → set storage layout (§2.1) to match migration state.
8. Run post-migration checklist (§5).
```

### ai-spector CLI (optional)

```bash
npx ai-spector docops migrate --dry-run    # preview legacy → contract
npx ai-spector docops migrate              # full legacy migrate (no overwrite of existing)
npx ai-spector docops migrate --repair     # fill gaps when config already exists
npx ai-spector docops init                 # greenfield scaffold
```

### Hard rules for agents

| Rule | Detail |
|------|--------|
| **Do not overwrite** | Never replace an existing file at a contract path. Migration **fills gaps** only. |
| **Single layout path** | Writer reads **one** path per feature from **project storage layout** — no try-legacy-then-docops fallback. |
| **Repo-root-relative `docTypes.path`** | Use full paths like `docs/srs`. Short names like `srs` are **not** expanded to `docs/srs`. |
| **Do not move `docs/`** | Point `docTypes.*.path` at existing folders; keep markdown in place. |
| **Match storage layout to git** | Until git is fully on `.docops/`, keep Writer `storage_layout: legacy`; switch to `docops` after migration commit is on the working branch. |

---

## 1. Detect your situation (no CLI required)

Open the repo in Bitbucket (or locally) and check which files exist on the **branch you will migrate**:

| Check | Path | Meaning |
|-------|------|---------|
| A | `.docops/docops.config.json` | Writer contract manifest exists |
| B | `.ai-spector/docflow.config.json` | Legacy ai-spector layout |
| C | `comments/` at repo root | Legacy comments location |
| D | `.ai-spector/.docflow/review-queue/` | Legacy review queue |
| E | `docs/` with markdown | Document content (keep as-is) |

| A | B/C/D | Situation | Start at |
|---|-------|-----------|----------|
| no | no | **Greenfield** — new Writer project | [Path A](#path-a--greenfield-writer-web-only) |
| no | yes | **Legacy** — needs migration | [Path B](#path-b--legacy-migration-without-ai-spector) |
| yes | * | **Docops** — contract exists | [Path C](#path-c--fill-gaps-or-verify) |
| yes | yes | **Mixed** — partial migration | [Path C](#path-c--fill-gaps-or-verify) |

Writer **Project Settings → Docops** may also show layout hints when git is linked.

---

## 2. Path reference (legacy → contract)

Use this table when copying files manually (git `mv` or copy + commit):

| Legacy path | Contract path | Action |
|-------------|---------------|--------|
| `.ai-spector/docflow.config.json` | `.docops/docops.config.json` | **Rewrite** — use [examples/full-docops.config.json](examples/full-docops.config.json); map languages and `docTypes` from docflow + your `docs/` tree |
| `.ai-spector/review.config.json` | `.docops/review.config.json` | Copy if missing |
| `.ai-spector/.docflow/review-queue/` | `.docops/review-queue/` | Copy folder if missing |
| `comments/` (repo root) | `.docops/comments/` | Copy folder if missing |
| `prototype/screen-map.json` | `.docops/prototype/screen-map.json` | Copy if missing |
| `.ai-spector/.docflow/config/prototype/config.json` | `.docops/prototype/config.json` | Copy if missing |
| `.ai-spector/packs/*/templates/` | `.docops/templates/{layer}/` | Copy `*.md` templates per layer |
| (none) | `.docops/guide/` | Added by Writer setup — this documentation folder |

**Rule:** never overwrite existing destination files. Migration only **fills gaps**.

### 2.1 Storage layout (Writer project setting)

Writer stores **which path family to read from git** on the **project** row (`storage_layout` in the database). This is **not** inferred by trying multiple paths.

| `storage_layout` | When to use | Comments root | Review queue | Prototype screen-map | Prototype config |
|------------------|-------------|---------------|--------------|----------------------|------------------|
| `legacy` | Repo still uses `.ai-spector/` paths (default for old projects) | `comments/` | `.ai-spector/.docflow/review-queue/` | `prototype/screen-map.json` | `.ai-spector/.docflow/config/prototype/config.json` |
| `docops` | Repo migrated to `.docops/` contract paths | `.docops/comments/` | `.docops/review-queue/` | `.docops/prototype/screen-map.json` | `.docops/prototype/config.json` |

**Set in Writer:** Project Settings → Docops (or project update API: `storageLayout: "legacy"` \| `"docops"`).

**After migration:** when `.docops/docops.config.json` and contract paths exist on the branch users work in, set **`storage_layout` to `docops`**.

**Git vs DB:** `.docops/docops.config.json` may include `"layout": "docops"`. Writer still uses the **project `storage_layout`** for reads. Keep DB and git in sync.

**Do not rely on:** `DOCOPS_LEGACY_PATHS` env dual-read (deprecated). One layout per project.

### 2.2 Document folders (`docTypes.*.path`)

Document markdown lives under **`docTypes.<layer>.path`** — a folder **relative to the repository root**.

| `docTypes` key | Label | Example `path` | Typical on-disk layout |
|----------------|-------|----------------|------------------------|
| `srs` | SRS | `docs/srs` | `docs/srs/en/01-overview.md` |
| `basicDesign` | Basic Design | `docs/basic-design` | `docs/basic-design/en/screen-list.md` |
| `detailDesign` | Detail Design | `docs/detail-design` | `docs/detail-design/en/feature-list.md` |

**Use full repo-root paths** in config:

```json
"docTypes": {
  "srs": {
    "enabled": true,
    "path": "docs/srs",
    "label": "SRS",
    "templatesPath": ".docops/templates/srs"
  },
  "basicDesign": {
    "enabled": true,
    "path": "docs/basic-design",
    "label": "Basic Design",
    "templatesPath": ".docops/templates/basic-design"
  }
}
```

**Path rules:**

- **`path` is literal** — `docs/srs` stays `docs/srs`. A short value like `srs` means a folder named `srs` at repo root, **not** `docs/srs`.
- **`docsRoot`** (`"docs"` by default) is **not** prepended to `docTypes.path`. Put the full folder in `path`.
- **Custom roots** are allowed (e.g. `"path": "detail-design"` at repo root) when that matches your tree.
- **Logical paths** in review/comments stay without the docs prefix: `srs/01-overview`, `basic-design/screen-list`. Writer/ai-spector map them using `docTypes.*.path`.
- **Do not overwrite** existing `docTypes.*.path` in config during repair — only fill missing `templatesPath` or scaffold files.

**Infer from tree:** if `docs/srs/` exists, set `srs.path` to `docs/srs`. If `detail-design/` exists at repo root, set `detailDesign.path` to `detail-design`.

---

## Path A — Greenfield (Writer web only)

No legacy layout. **No ai-spector.**

1. **Project Settings** → Bitbucket: repo URL + token → **Save**
2. **Docops** section → choose **target branch** (use a feature branch if `main` is protected)
3. Click **Set up repository** (or **Customize** first)
4. Wait for the worker job to finish (status banner turns green)
5. Complete [post-migration checklist](#5-post-migration-checklist)

**What setup commits:**

- `.docops/docops.config.json`, review scaffolding, templates
- `{docTypes.*.path}/{lang}/.gitkeep` placeholders (e.g. `docs/srs/en/.gitkeep`)
- `.docops/guide/` — this folder (README, MIGRATION, modules, schemas, examples)

---

## Path B — Legacy migration (without ai-spector)

For projects with legacy paths (table in §1) and **no** `.docops/docops.config.json` yet.

### Step 1 — Branch and backup

```bash
git checkout -b docops/migrate
git pull
```

- [ ] Confirm you can push to this branch from Writer (Bitbucket token saved)

### Step 2 — Copy legacy files

From **repo root**, copy only when the contract path does not exist:

```bash
# Comments (if you have root comments/)
test -d comments && test ! -d .docops/comments && cp -r comments .docops/comments

# Review queue
test -d .ai-spector/.docflow/review-queue && test ! -d .docops/review-queue \
  && cp -r .ai-spector/.docflow/review-queue .docops/review-queue

# Review config
test -f .ai-spector/review.config.json && test ! -f .docops/review.config.json \
  && cp .ai-spector/review.config.json .docops/review.config.json

# Prototype (if used)
mkdir -p .docops/prototype
test -f prototype/screen-map.json && test ! -f .docops/prototype/screen-map.json \
  && cp prototype/screen-map.json .docops/prototype/screen-map.json
test -f .ai-spector/.docflow/config/prototype/config.json \
  && test ! -f .docops/prototype/config.json \
  && cp .ai-spector/.docflow/config/prototype/config.json .docops/prototype/config.json
```

Adjust paths if your project uses different legacy locations.

### Step 3 — Create `docops.config.json`

1. Copy [examples/full-docops.config.json](examples/full-docops.config.json) to `.docops/docops.config.json`
2. Edit to match your project:

| Field | What to set |
|-------|-------------|
| `layout` | `"docops"` when this repo uses contract paths (see §2.1) |
| `languages[]` | Codes and folder names under each `docTypes.*.path` (e.g. `en`, `vi`) |
| `primaryLanguage` | Main authoring language |
| `docTypes` | Enabled layers (`srs`, `basicDesign`, `detailDesign`) — see §2.2 |
| `docTypes.*.path` | **Repo-root-relative** folder (e.g. `docs/srs`, `docs/basic-design`) — must match existing markdown tree |
| `docTypes.*.templatesPath` | `.docops/templates/srs`, `.docops/templates/basic-design`, etc. |
| `capabilities` | `true` / `false` per Writer feature you use |
| `paths` | Contract paths for comments, review, prototype (usually defaults under `.docops/`) |

Validate (optional):

```bash
npx ajv-cli validate \
  -s .docops/guide/schemas/docops.config.schema.json \
  -d .docops/docops.config.json
```

If you have `.ai-spector/docflow.config.json`, open it side-by-side and copy language codes, doc layer paths, and plugin flags into `capabilities`.

### Step 4 — Templates

If `.docops/templates/` is empty, copy markdown templates:

```bash
# Example: from ai-spector pack (adjust pack name to your project)
mkdir -p .docops/templates/srs .docops/templates/basic-design
cp -r .ai-spector/packs/kaopiz-srs/templates/* .docops/templates/srs/ 2>/dev/null || true
```

Or run **Writer Set up repository** on a branch that still has **no** `docops.config.json` to scaffold templates — then merge with your copied legacy files.

### Step 5 — Commit and push

```bash
git add .docops
git commit -m "docops: migrate legacy layout to .docops contract"
git push -u origin docops/migrate
```

### Step 6 — Add guide folder (if missing)

If `.docops/guide/` is not in the commit yet:

1. Merge or cherry-pick from a branch where Writer setup ran, **or**
2. **Project Settings → Docops → Set up repository** on a branch **without** `docops.config.json` (e.g. temporary branch), copy `.docops/guide/` from that commit, **or**
3. Run Writer setup on your migrate branch **before** adding `docops.config.json` (setup first, then add config + legacy copies in a second commit)

Recommended order for Writer-only teams:

```text
1. Create branch
2. Writer Set up repository  →  gets guide/, templates, default config
3. Edit docops.config.json for your languages/layers
4. Copy legacy comments/review-queue over (only if destinations empty)
5. Commit + push
```

### Step 7 — Verify

[Post-migration checklist](#5-post-migration-checklist)

---

## Path C — Fill gaps or verify

`.docops/docops.config.json` **already exists**.

### Missing files only (manual)

| Symptom | Fix |
|---------|-----|
| Review queue 500 / `Expected JSON object` on `pending.json` | Replace with `{"version": 2, "jobs": []}` — see [examples/review/minimal-pending.json](examples/review/minimal-pending.json). Do **not** use a bare array of logical paths. |
| No review registry | Copy [examples/review/minimal-registry.json](examples/review/minimal-registry.json) → `.docops/review-queue/registry.json` and edit |
| No review config | Copy [examples/review/minimal-review.config.json](examples/review/minimal-review.config.json) |
| No guide docs | Copy from another initialized branch or re-run setup on a branch without config, then copy `.docops/guide/` |
| Empty templates | Copy `*.md` into `docTypes.*.templatesPath` or run setup on greenfield branch and copy template folders |
| Prototype not working | See [modules/prototype.md](modules/prototype.md) — config, screen-map, `.htpasswd` |

Writer **Set up repository** returns **409** if `docops.config.json` already exists. To scaffold **missing** files without CLI, either:

- Add files manually from `guide/examples/`, or
- Use a temporary branch without config for setup, then copy missing paths into your working branch

### Optional automation (ai-spector installed)

If ai-spector is available locally:

```bash
npx ai-spector docops migrate --dry-run    # legacy → contract preview
npx ai-spector docops migrate              # full legacy migrate
npx ai-spector docops migrate --repair     # fill gaps when config exists
```

This is optional — [Path B](#path-b--legacy-migration-without-ai-spector) covers the same result with git + Writer.

---

## 4. Projects that never used ai-spector

Some teams only have `docs/` and custom tooling (no `.ai-spector/`).

1. Follow [Path A](#path-a--greenfield-writer-web-only) — Writer setup scaffolds the contract
2. Edit `.docops/docops.config.json` so `docTypes.*.path` matches your existing folders (§2.2), e.g. `docs/srs`
3. Do **not** move `docs/` — Writer reads markdown in place via configured `path`
4. Set Writer **`storage_layout` to `docops`** once contract files exist on the branch
5. Enable only `capabilities` you need; see [modules/](modules/) for each feature's files
6. External adapters: read [adapters/README.md](adapters/README.md) — integration is **git files only**, no Writer API

---

## 5. Post-migration checklist

After any path, verify on the migrated branch (allow ~30s for Writer git cache):

### Contract

- [ ] `.docops/docops.config.json` valid JSON; `languages` and `docTypes` match on-disk folders (§2.2)
- [ ] `docTypes.*.path` uses repo-root-relative paths (e.g. `docs/srs`, not bare `srs` unless that folder exists at root)
- [ ] Writer project **`storage_layout`** matches branch (`legacy` until `.docops/` paths are live, then `docops`)
- [ ] `.docops/guide/README.md` and `guide/MIGRATION.md` present (this file)
- [ ] Review: `.docops/review.config.json` + `.docops/review-queue/registry.json` (if `review: true`)
- [ ] Comments: threads under `.docops/comments/` (if `comments: true`)
- [ ] Templates: `*.md` in each `templatesPath` (if `generate: true`)
- [ ] Prototype: `screen-map.json`, auth — [modules/prototype.md](modules/prototype.md)

### Writer UI

- [ ] **Project Settings → Docops** — setup complete, no blocking errors
- [ ] **Documents** tree loads
- [ ] **Templates** lists files from `.docops/templates/`
- [ ] **Review / Comments / Prototype** work for enabled capabilities

### Git and team

- [ ] Migration commit on the branch users work in
- [ ] CI and bots updated to read `.docops/` paths (see [adapters/README.md](adapters/README.md))
- [ ] Team entry point: `.docops/guide/README.md`

---

## 6. Writer admin: storage layout per project

Each linked git project has **`storage_layout`** in the Writer database:

| Value | Git paths Writer reads |
|-------|-------------------------|
| `legacy` (default) | `comments/`, `.ai-spector/.docflow/review-queue/`, `prototype/screen-map.json`, legacy prototype config |
| `docops` | `.docops/comments/`, `.docops/review-queue/`, `.docops/prototype/screen-map.json`, `.docops/prototype/config.json` |

**Migration sequence:**

1. While git still has only legacy paths → keep `storage_layout: legacy`
2. After `.docops/` contract files are committed on the working branch → set `storage_layout: docops`
3. Verify Documents, Review, Comments, Prototype on that branch

Writer does **not** fall back from docops path to legacy path (or vice versa) when a file is missing.

Deprecated: `DOCOPS_LEGACY_PATHS` environment dual-read. Use per-project `storage_layout` instead.

---

## 7. Migration flow (summary)

```text
Check repo files (§1)
        │
        ├─ greenfield ──────► Writer Set up repository (Path A)
        │
        ├─ legacy, no config ► copy legacy files (§2 table)
        │                      create docops.config.json (§2.2, Step 3)
        │                      commit + push
        │                      set Writer storage_layout (§2.1)
        │                      → checklist (§5)
        │
        └─ config exists ───► fill gaps manually (Path C)
                               or optional: ai-spector migrate --repair
```

---

## 8. After migration

1. [README.md](README.md) — contract overview
2. [modules/](modules/) — per-module schema, Writer flow, examples
3. [schemas/](schemas/) — validate JSON locally
4. [examples/](examples/) — copy-paste starting points

---

## 9. Agent quick reference (copy for prompts)

```text
Migrate repo to .docops contract:
- Branch: docops/migrate (or user branch)
- Copy legacy → contract (§2 table); skip existing destinations
- docops.config.json: layout "docops", docTypes.*.path = repo-root-relative (docs/srs, docs/basic-design, …)
- capabilities + paths per project needs
- templates: .docops/templates/{layer}/*.md
- gitkeep: {docTypes.path}/{lang}/.gitkeep for each language
- Commit; then Writer storage_layout = docops
- Never overwrite existing files; never use short docTypes.path expecting docs/ prefix
```
