# Docops / Writer contract runbook

Bootstrap or migrate the **Kari Writer `.docops/` contract** using CLI only (no MCP tools).

**Related:** [kari-writer/contracts/MIGRATION.md](https://github.com/kaopiz/kari-writer/blob/main/contracts/MIGRATION.md) · [CONTRACT.md](https://github.com/kaopiz/kari-writer/blob/main/contracts/CONTRACT.md)

Run all commands from **project repo root**.

---

## Phase 0 — Assess

```bash
npx ai-spector docops status --json
```

Parse the JSON `DocopsAssessment`:

| Field | Meaning |
|-------|---------|
| `layout` | `none` · `legacy` · `docops` · `mixed` |
| `writerReady` | `true` when config, capability files, and template dirs are complete |
| `gaps[]` | Each gap: `id`, `severity` (`blocking` \| `warning`), `message`, `fix` |
| `recommendedAction` | `init` · `migrate` · `repair` · `ok` |

**Layout → action mapping:**

| `layout` | Typical `recommendedAction` |
|----------|----------------------------|
| `none` | `init` |
| `legacy` | `migrate` |
| `mixed` or `docops` + gaps | `repair` (maps to `migrate --repair`) |
| `writerReady: true` | `ok` |

If `writerReady: false` with blocking gaps, CLI exits `2` — treat as actionable, not fatal for the agent.

On CLI failure → [cli-failures.md](../../ai-spector/references/cli-failures.md).

---

## Phase 1 — Ask (if needed)

**Languages (for `init`):** If `recommendedAction` is `init` and languages are unknown, ask **one** question:

> Which languages? (e.g. `en` only, or `en,vi,jp` for multi-language docs)

Default: `en`.

**Mixed layout:** If `layout` is `mixed`, explain what will be repaired (missing config artifacts, empty template dirs, legacy data not yet copied) before proceeding.

**Dry run:** If the user is unsure, run the Phase 2 command with `--dry-run` first and show the planned actions.

---

## Phase 2 — Execute

Map `recommendedAction` to CLI:

| Action | Command |
|--------|---------|
| `init` | `npx ai-spector docops init --lang <codes>` |
| `migrate` | `npx ai-spector docops migrate` |
| `repair` | `npx ai-spector docops migrate --repair` |
| `ok` | Skip to **Phase 4** |

**Optional flags:**

```bash
# Preview planned actions
npx ai-spector docops init --lang en,vi --dry-run
npx ai-spector docops migrate --dry-run
npx ai-spector docops migrate --repair --dry-run

# Init: enable doc layers (default: infer from docs/ or srs,basicDesign)
npx ai-spector docops init --lang en --layers srs,basicDesign,detailDesign

# Init: fill missing files when config already exists
npx ai-spector docops init --force

# Templates still empty after migrate
npx ai-spector docops migrate --templates-only
```

**Never overwrite** existing destination files. If `init` fails because config exists, use `migrate --repair` or `init --force` (fills missing files only).

---

## Phase 3 — Git

After a successful init, migrate, or repair:

```bash
git add .docops
# Also add docs/ if init created language gitkeeps
git commit -m "docops: <init|migrate|repair> Writer contract"
```

Remind the user to **`git push`** so Kari Writer can read the updated contract (allow ~30 seconds for git read cache after push).

If there is **no git repo**, warn that Writer requires a git-backed project; suggest `git init` first.

---

## Phase 4 — Verify

```bash
npx ai-spector docops status --json
```

Expect `writerReady: true` and `recommendedAction: ok`.

**Kari Writer UI checklist** (after push):

| Check | Expected |
|-------|----------|
| **Docops status** | Capabilities from `.docops/docops.config.json`; no legacy-path warnings in Writer API logs |
| **Templates page** | SRS and Basic Design layers list `.md` files from `.docops/templates/...`; `templatesPath` banner matches config |
| **Review queue** | Pending/history load from `.docops/review-queue/`; sign-off config from `.docops/review.config.json` |
| **Comments** | Threads under `.docops/comments/` open and save |
| **Prototype** (if enabled) | Screen map and config read from `.docops/prototype/` |

If legacy paths (`.ai-spector/`, root `comments/`) still exist alongside `.docops/`, note **`DOCOPS_LEGACY_PATHS=1`** on Writer API during transition. After full migration org-wide, recommend disabling the flag.

---

## Hard cases (handle in chat)

| Case | Agent action |
|------|--------------|
| Custom pack templates in non-standard path | Inspect `.ai-spector/packs/`; manual copy with user confirmation |
| Multi-language docs tree mismatch | Adjust `--lang` on re-run `init --force` or edit `docops.config.json` |
| Conflicting review registry versions | Do not auto-migrate; explain and link `MIGRATION.md` |
| No git repo | Warn Writer requires git-backed project; suggest `git init` |
| `DOCOPS_LEGACY_PATHS` still on | Note dual-read window; recommend migrate then disable flag org-wide |

---

## Guardrails

- **CLI only** — no MCP tools for docops; shell out to `npx ai-spector docops …`.
- Do **not** route here for full ai-spector setup — use `ai-spector-setup`.
- Do **not** route here for doc content migration (`ai-spector-adopt`) — that skill moves docs into ai-spector folder structure; this skill manages the `.docops/` Writer contract.

---

## Finish

Report a short summary:

| Step | Status |
|------|--------|
| Assess (`layout`, `recommendedAction`) | … |
| Execute (init / migrate / repair / skipped) | … |
| Git commit | ok / skipped (no repo) |
| Verify (`writerReady`) | true / gaps remain |
| User: git push | **manual** |

If gaps remain after repair, list blocking `gaps[]` and suggest `--templates-only` or manual pack copy.
