# Generate prototype

Generate **static HTML** prototypes from basic-design screen specs. All setup and manifest tooling is built into **ai-spector** (no external scripts).

**User runs this command;** the agent runs CLI. On CLI failure: [cli-failures.md](../../ai-spector/references/cli-failures.md).

## Context hygiene

For runs of 5+ screens, follow [context-management.md](../../ai-spector/references/context-management.md):
- **Sub-agent per screen** — delegate graph queries + screen doc reads for each screen; receive a ≤400-word summary (fields, flows, roles, errors); main agent writes from the summary.
- **Compact every 5 screens** — after writing and validating a batch of 5, `/compact` with the plan summary (remaining screens, written paths) before continuing.
- After writing a screen HTML file, discard its content from context — record only the path.

## Philosophy

- **Screen design is source of truth** — `docs/basic-design/list-screens.md` + `docs/basic-design/screens/<slug>.md`
- **Basic auth must be configured before generating** — if `prototype.config.json` has no `basicAuth`, run the [auth picker](auth-picker.md): ask for username/password, then `ai-spector prototype auth`. Once saved, do not ask again unless the user wants to rotate credentials.
- **Theme must be confirmed before generating** — if no theme is stored, run the [theme picker](theme-picker.md): recommend 3 fits from project context, open previews, wait for user choice. Once chosen (stored in `prototype/theme.json` or config), never ask again.
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

### 0. Resolve basic auth

**If `prototype.config.json` → `basicAuth` is missing** (no username/password), run the **[auth picker](auth-picker.md)** — do not generate HTML until credentials are saved and `prototype/htpasswd` exists.

If credentials exist but `prototype/htpasswd` is missing:

```bash
ai-spector prototype auth --from-config
```

### 1. Resolve theme and setup workspace

**Resolution order** (first match wins):

1. Theme named in this request (`--theme`, “use stripe theme”, etc.)
2. `prototype/theme.json` → `themeName`
3. `prototype/manifest.json` → `themeName` (non-empty)
4. `.ai-spector/.docflow/config/prototype.config.json` → `defaultTheme`

**If no stored theme is found** and the user did **not** name one in this request, run the **[theme picker](theme-picker.md)** — do **not** ask a bare “which theme?” without recommendations.

Summary of the picker:

1. Read project context (SRS, list-screens §1, knowledge, data-source).
2. `ai-spector prototype themes --json` — pick **3 best-fit** themes with one-line rationale each.
3. `ai-spector prototype preview <name> --open` for all 3 — user compares in the browser.
4. Post a numbered table; **wait for user to choose** before setup.

Once the user confirms (or named a theme upfront), proceed with setup; the choice is persisted and will not be asked again.

Setup (creates `prototype/`, copies `DESIGN.md`, seeds manifest when `list-screens.md` exists):

```bash
ai-spector prototype setup --theme <resolved-name>
```

Omit `--theme` only when setup can infer the same name from stored files (the CLI reads `theme.json` / config automatically).

**Persist** when the user explicitly names a theme in this session: `prototype setup --theme <name>` updates `prototype/theme.json` and saves `defaultTheme` in `prototype.config.json` for later runs.

List all themes:

```bash
ai-spector prototype themes
```

Themes with a visual sample show `[preview]`. Open any theme sample:

```bash
ai-spector prototype preview <name> --open
```

### 2. Plan screens

```bash
ai-spector prototype manifest --dry-run
```

Read each target’s `docs/basic-design/screens/<slug>.md` — wireframe (§1.1), layout (§1.2), interactions. Read `prototype/DESIGN.md` for colors, type, spacing.

### 2b. Load graph context per screen

**Required before writing each screen’s HTML.** Run the queries in [prototype-graph-context.md](./prototype-graph-context.md) for the screen being generated.

This step pulls:
- The F-xx / UC-xx the screen satisfies → business rules, required fields, flow steps, error states
- The API endpoints the screen depends on → exact form fields, response columns, error codes
- Actor roles → role-based UI sections

Do not skip this step. Screen detail docs summarize the spec; the graph has the authoritative detail. Any form field, table column, button, or error state **must be traceable to graph data** before you write it into the HTML.

### 3. Generate HTML

For each screen in scope:

- Write `prototype/src/<prototypeStem>.html` (self-contained or with sibling `.css`/`.js` in `prototype/src/`)
- All content derived from graph context (step 2b) + screen detail doc — no invented fields or labels
- Include error states and empty states for every exception flow found in the graph
- Render role-specific sections when multiple actors satisfy the screen
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
| “use stripe theme”, `--theme stripe` | `prototype setup --theme stripe` (persists preference); add `--force-design` if switching theme mid-branch |
| “what themes?” | `ai-spector prototype themes` |
| “preview stripe theme”, “show me vercel theme” | `ai-spector prototype preview <name> --open` |
| no theme in message, no stored theme | **[theme picker](theme-picker.md)**: recommend 3 → open previews → wait for choice |
| no theme in message, stored theme found | Use stored theme — do not ask |
| “help me pick a theme”, “which theme fits?” | Full [theme picker](theme-picker.md) even if not generating yet |

## Accuracy checklist

- [ ] If no stored basic auth: [auth picker](auth-picker.md) run — username/password collected, `prototype auth` executed, `prototype/htpasswd` present
- [ ] If no stored theme: [theme picker](theme-picker.md) run — 3 recommendations, previews opened, user confirmed
- [ ] `prototype setup` run with resolved theme
- [ ] Graph context queries run per screen ([prototype-graph-context.md](./prototype-graph-context.md)) before writing HTML
- [ ] Every form field traces to an API request field or F-xx/UC-xx field definition
- [ ] Every table column traces to an API response field or data entity
- [ ] Every button/action label matches the spec's verb (not generic copy)
- [ ] Error states and empty states included for all UC exception flows + API error codes
- [ ] Role-based sections rendered when multiple actors satisfy the screen
- [ ] Every generated file name matches `prototypeStem` in manifest
- [ ] Wireframe/layout from screen detail doc reflected in HTML
- [ ] Tokens from `prototype/DESIGN.md` only (no random CDN)
- [ ] `prototype validate --strict` passes

## On failure

Stop and report CLI output. Do not hand-edit `manifest.json` without re-running `prototype manifest`.
