# Generate prototype

Generate **static HTML** prototypes from basic-design screen specs. All setup and manifest tooling is built into **ai-spector** (no external scripts).

**User runs this command;** the agent runs CLI. On CLI failure: [cli-failures.md](../../ai-spector/references/cli-failures.md).

## Philosophy

- **Screen design is source of truth** — `docs/basic-design/list-screens.md` + `docs/basic-design/screens/<slug>.md`
- **Theme is chosen up front** — design tokens live in `prototype/DESIGN.md` (copied from bundled `assets/themes/<name>/`)
- **One HTML per screen** — `prototype/src/<prototypeStem>.html` must match `prototype/manifest.json`
- **Static only** — HTML/CSS/JS under `prototype/`; no frameworks, no CDN unless the theme DESIGN allows it

## Usage — three ways to choose targets

| Case | User says | Agent behavior |
|------|-----------|----------------|
| **1 — All (default)** | `/generate-prototype` or `/generate-prototype --theme stripe` | Every row in Screen Index §4 |
| **2 — Explicit** | `/generate-prototype login dashboard --theme vercel` | Named screens only (match Screen Index / slug) |
| **3 — Described** | “prototype for checkout flow” | Proposed scope table → user confirms → generate |

## Prerequisites

- Basic design screens exist: `/generate-basic-design` (at least `list-screens.md` + detail files)
- Recommended: `ai-spector graph validate` passes

## Required behavior (agent runs CLI)

### 1. Choose theme and setup workspace

List themes if the user did not specify one:

```bash
ai-spector prototype themes
```

Setup (creates `prototype/`, copies `DESIGN.md`, seeds manifest when `list-screens.md` exists):

```bash
ai-spector prototype setup --theme <name>
```

Default theme: `vercel` (override with `--theme` or user preference).

### 2. Plan screens

```bash
ai-spector prototype manifest --dry-run
```

Read each target’s `docs/basic-design/screens/<slug>.md` — wireframe (§1.1), layout (§1.2), interactions. Read `prototype/DESIGN.md` for colors, type, spacing.

### 3. Generate HTML

For each screen in scope:

- Write `prototype/src/<prototypeStem>.html` (self-contained or with sibling `.css`/`.js` in `prototype/src/`)
- Link navigation using relative paths between screens when `list-screens.md` §2 defines flow
- Do **not** edit `docs/**`

### 4. Refresh manifest and validate

```bash
ai-spector prototype manifest
ai-spector prototype validate --strict
```

### 5. Suggest commit

```text
git add prototype/
git commit -m "chore(prototype): add HTML screens (<theme>)"
```

## Theme selection

| User says | Action |
|-----------|--------|
| “use stripe theme”, `--theme stripe` | `prototype setup --theme stripe --force-design` if switching theme mid-branch |
| “what themes?” | `ai-spector prototype themes` |
| no preference | `vercel` or project default from `prototype.config.json` |

## Accuracy checklist

- [ ] `prototype setup` run with agreed theme
- [ ] Every generated file name matches `prototypeStem` in manifest
- [ ] Wireframe/layout from screen detail doc reflected in HTML
- [ ] Tokens from `prototype/DESIGN.md` only (no random CDN)
- [ ] `prototype validate --strict` passes

## On failure

Stop and report CLI output. Do not hand-edit `manifest.json` without re-running `prototype manifest`.
