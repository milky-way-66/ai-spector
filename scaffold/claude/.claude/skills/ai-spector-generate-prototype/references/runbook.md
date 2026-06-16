# Generate prototype

Generate prototypes from basic-design screen specs — either **static HTML** (one file per screen) or **SPA-aware** (single entrypoint, route per screen for React/Vue/etc.). All setup and manifest tooling is built into **ai-spector** (no external scripts).

**User runs this command;** the agent runs CLI. On CLI failure: [cli-failures.md](../../ai-spector/references/cli-failures.md).

## Context hygiene

For runs of 5+ screens, follow [context-management.md](../../ai-spector/references/context-management.md):
- **Sub-agent per screen** — delegate graph queries + screen doc reads for each screen; receive a ≤400-word summary (fields, flows, roles, errors); main agent writes from the summary.
- **Compact every 5 screens** — after writing and validating a batch of 5, `/compact` with the plan summary (remaining screens, written paths) before continuing.
- After writing a screen HTML file, discard its content from context — record only the path.

## Philosophy

- **Screen design is source of truth** — `docs/basic-design/list-screens.md` + `docs/basic-design/screens/<slug>.md`
- **Tech stack must be confirmed first** — if `prototype/config.json` has no `techStack`, run the [stack picker](stack-picker.md): check for existing framework in the project, present ranked options, wait for user choice. Once chosen, never ask again.
- **Basic auth must be configured before generating** — if `prototype/config.json` has no `basicAuth`, run the [auth picker](auth-picker.md): ask for username/password, then `npx ai-spector prototype auth`. Once saved, do not ask again unless the user wants to rotate credentials.
- **Theme must be confirmed before generating** — if no theme is stored, run the [theme picker](theme-picker.md): recommend 3 fits from project context, open previews, wait for user choice. Once chosen (stored in `prototype/theme.json` or config), never ask again.
- **One file per screen** — file type determined by `techStack`; filename must match `prototypeStem` in `prototype/manifest.json`
- **Stack drives buildMode** — `html` → `static`; all framework stacks → `spa` (unless `buildMode` is explicitly overridden in config)
- **`screen-map.json` is minimal** — each screen has `screenId`, `displayName`, `screenDocPath`, optional `screenDocs`, `prototypePath`, and `route_exists`. Route patterns and param defaults live in `route-defaults.json`.

## Build modes

| Mode | `buildMode` in config | URI format | When to use |
|------|-----------------------|------------|-------------|
| **static** (default) | `"static"` or omitted | `/src/<stem>.html` | Plain HTML files served directly |
| **spa** | `"spa"` | `/<slug>` | Single-page app (React, Vue, etc.) with client-side routing |

**How to set SPA mode:** add `"buildMode": "spa"` to `.ai-spector/.docflow/config/prototype/config.json`.

**Config fields for the sync workflow:**

```json
{
  "buildMode": "spa",
  "buildSrc": "frontend/dist",
  "buildDest": "prototype/dist"
}
```

| Field | Description | Default |
|-------|-------------|---------|
| `buildSrc` | Repo-relative path to framework build output (e.g. `frontend/dist`) | — (must set or pass `--from`) |
| `buildDest` | Where to place the build inside the project (e.g. `prototype/dist`) | `prototype/dist` |

In SPA mode:
- The agent still generates one component/view file per screen (e.g. `prototype/src/<stem>.vue` or `prototype/src/<stem>.tsx`)
- Navigation links between screens must use `<slug>`-based routes (e.g. `<router-link to="/login">`)
- The `screen-map.json` `uri` values are route paths — the hosting layer (dev server or `serve -s dist`) handles routing
- The agent must **not** generate a separate `.html` per screen; there is one `index.html` entrypoint
- **Prototype routing:** follow [spa-prototype.md](spa-prototype.md) — bypass login redirects for direct review, and set default path/query params in `prototype/route-defaults.json` so `previewUri` deep links work for detail screens

## Usage — three ways to choose targets

| Case | User says | Agent behavior |
|------|-----------|----------------|
| **1 — All (default)** | `/generate-prototype` or `/generate-prototype --theme stripe` | Every row in Screen Index §4 |
| **2 — Explicit** | `/generate-prototype login dashboard --theme vercel` | Named screens only (match Screen Index / slug) |
| **3 — Described** | “prototype for checkout flow” | Proposed scope table → user confirms → generate |

## Prerequisites

- Basic design screens exist: `/generate-basic-design` (at least `list-screens.md` + detail files)
- Recommended: `npx ai-spector graph validate` passes

## Required behavior (agent runs CLI)

### 0. Resolve tech stack

**If `prototype/config.json` → `techStack` is missing**, run the **[stack picker](stack-picker.md)** — do not run setup or generate files until the user confirms a stack.

When the user confirms:

```bash
npx ai-spector prototype stack <chosen-stack>
```

This persists `techStack` and sets `buildMode` (`html` → `static`, all others → `spa`) in config. Skip if `techStack` is already set.

### 0b. Resolve basic auth

**If `prototype/config.json` → `basicAuth` is missing** (no username/password), run the **[auth picker](auth-picker.md)** — do not generate HTML until credentials are saved and `prototype/.htpasswd` exists.

If credentials exist but `prototype/.htpasswd` is missing:

```bash
npx ai-spector prototype auth --from-config
```

### 1. Resolve theme and setup workspace

**Resolution order** (first match wins):

1. Theme named in this request (`--theme`, “use stripe theme”, etc.)
2. `prototype/theme.json` → `themeName`
3. `prototype/manifest.json` → `themeName` (non-empty)
4. `.ai-spector/.docflow/config/prototype/config.json` → `defaultTheme`

**If no stored theme is found** and the user did **not** name one in this request, run the **[theme picker](theme-picker.md)**.

> **Do not auto-select.** Using project context to guess a theme and proceeding without a user reply is wrong — even if the rationale seems obvious. The agent's job is to recommend, not decide.

Summary of the picker:

1. Read project context (SRS, list-screens §1, knowledge, data-source).
2. `npx ai-spector prototype themes --json` — pick **3 best-fit** themes with one-line rationale each.
3. `npx ai-spector prototype preview <name> --open` for all 3 — user compares in the browser.
4. Post a numbered table; **stop and wait for user reply** — a number, a name, or “use that one” — before running any further command.

Once the user confirms (or named a theme upfront), proceed with setup; the choice is persisted and will not be asked again.

Setup (creates `prototype/`, copies `DESIGN.md`, seeds manifest when `list-screens.md` exists):

```bash
npx ai-spector prototype setup --theme <resolved-name>
```

Omit `--theme` only when setup can infer the same name from stored files (the CLI reads `theme.json` / config automatically).

**Persist** when the user explicitly names a theme in this session: `prototype setup --theme <name>` updates `prototype/theme.json` and saves `defaultTheme` in `prototype/config.json` for later runs.

List all themes:

```bash
npx ai-spector prototype themes
```

Themes with a visual sample show `[preview]`. Open any theme sample:

```bash
npx ai-spector prototype preview <name> --open
```

### 2. Plan screens

```bash
npx ai-spector prototype manifest --dry-run
```

Read each target’s `docs/basic-design/screens/<slug>.md` — wireframe (§1.1), layout (§1.2), interactions. Read `prototype/DESIGN.md` for colors, type, spacing.

### 2b. Load graph context per screen

**Required before writing each screen’s HTML.** Run the queries in [prototype-graph-context.md](./prototype-graph-context.md) for the screen being generated.

This step pulls:
- The F-xx / UC-xx the screen satisfies → business rules, required fields, flow steps, error states
- The API endpoints the screen depends on → exact form fields, response columns, error codes
- Actor roles → role-based UI sections

Do not skip this step. Screen detail docs summarize the spec; the graph has the authoritative detail. Any form field, table column, button, or error state **must be traceable to graph data** before you write it into the HTML.

### 3. Generate prototype files

Read `techStack` (and `buildMode`) from `prototype/config.json`. File type and structure depend on the stack:

| `techStack` | File per screen | Route / nav pattern | Entrypoint |
|-------------|-----------------|---------------------|------------|
| `html` | `prototype/src/<stem>.html` | `href="/src/<stem>.html"` | each `.html` |
| `vue` | `prototype/src/<stem>.vue` | `<router-link to="/<slug>">` | `prototype/src/main.ts` + `router.ts` |
| `react` | `prototype/src/pages/<stem>.tsx` | `<Link to="/<slug>">` | `prototype/src/main.tsx` + router config |
| `nuxt` | `prototype/src/pages/<slug>.vue` | `<NuxtLink to="/<slug>">` | Nuxt file-system routing |
| `next` | `prototype/src/app/<slug>/page.tsx` | `<Link href="/<slug>">` | Next.js file-system routing |
| `svelte` | `prototype/src/routes/<slug>/+page.svelte` | `<a href="/<slug>">` | SvelteKit file-system routing |
| `angular` | `prototype/src/<stem>/<stem>.component.ts` | `routerLink="/<slug>"` | `app.routes.ts` |

**HTML (`techStack: html`, static mode):**

- Write `prototype/src/<prototypeStem>.html` (self-contained or with sibling `.css`/`.js`)
- Navigation links use `href` values from `uri` in `screen-map.json`
- **Script, stylesheet, and image refs to local files must use relative paths** from the current HTML file — e.g. `<script src="./assets/app.js">`, `<link href="./styles.css">`. Do **not** use root-absolute paths like `/assets/app.js`; they resolve from the server root and break when deployed under a subdirectory.

**Framework stacks (spa mode):**

- Write one component/view file per screen using the path pattern in the table above
- There is **one** `index.html` entrypoint — do **not** create per-screen HTML files
- Generate a route config file (`router.ts`, `app.routes.ts`, or equivalent) mapping each screen slug to its component
- Navigation between screens uses the framework's router component with `uri` from `screen-map.json` as the path
- **Direct access (no login redirect):** router guards must honor `prototypeBypassAuth` on `screen-map.json` — see [spa-prototype.md](spa-prototype.md)
- **Param routes:** copy `route-defaults.example.json` → `route-defaults.json`, set `routeParams` / `queryParams` per screen id, run `prototype manifest`, give users the generated `previewUri` links

**All stacks:**

- All content derived from graph context (step 2b) + screen detail doc — no invented fields or labels
- Include error states and empty states for every exception flow found in the graph
- Render role-specific sections when multiple actors satisfy the screen
- Do **not** edit `docs/**`

### 4. Refresh manifest and validate

```bash
npx ai-spector prototype manifest
npx ai-spector prototype validate --strict
```

`screen-map.json` gets `defaultScreenId` — the entry screen for hosting. The CLI picks the first screen that already has HTML (or the first row in the index if none do yet). When several screens have HTML and you need a specific landing page, set it explicitly:

```bash
npx ai-spector prototype manifest --default-screen login
```

That id must match a Screen Index row and (when any HTML exists) a screen that already has `prototype/src/<stem>.html`.

### 5. Suggest commit

```text
git add prototype/
git commit -m "chore(prototype): add HTML screens (<theme>)"
```

## Sync build output (SPA / external build)

Use this workflow when the prototype files are built in a separate folder (e.g. a Vue or React project at `frontend/`) and must be moved into `prototype/` before serving.

### One-time config

Add to `.ai-spector/.docflow/config/prototype/config.json`:

```json
{
  "buildMode": "spa",
  "buildSrc": "frontend/dist",
  "buildDest": "prototype/dist"
}
```

### Sync command

After running the framework build (`npm run build` in the SPA project):

```bash
npx ai-spector prototype sync
```

This will:
1. Copy everything from `buildSrc` → `buildDest`
2. Rewrite root-absolute asset paths in HTML to `./`-relative paths (e.g. `/assets/app.js` → `./assets/app.js`)
3. Regenerate `prototype/manifest.json` and `prototype/screen-map.json` with correct `uri` values

SPA deep links (`previewUri` paths) are served by nginx `try_files` — only the root `dist/index.html` is needed; do not copy `index.html` into per-route folders.

**Override source/dest without editing config:**

```bash
npx ai-spector prototype sync --from frontend/dist --to prototype/dist
```

**Clean sync** (wipe dest first — useful after a full rebuild):

```bash
npx ai-spector prototype sync --clean
```

**Only regenerate screen-map** (files already in place):

```bash
npx ai-spector prototype sync --skip-copy
```

**Inspect the URI mapping:**

```bash
npx ai-spector prototype sync --json
```

Output includes each screen's `screenDoc → uri` mapping.

### Relative asset paths — required for all web builds

When HTML references another local file (script, stylesheet, image, favicon), the URL must be **relative to the current HTML file**, starting with `./`:

```html
<script type="module" crossorigin src="./assets/index-uOr-eA2t.js"></script>
<link rel="stylesheet" href="./assets/index.css">
```

Root-absolute paths like `/assets/app.js` resolve from the server root. When `dist/` is deployed to a subdirectory (e.g. `/project-id/1.4/dist/`), those requests hit the wrong URL and return 403/404.

> **`prototype sync` rewrites paths in copied HTML only.** Bundled JS chunks still use whatever paths Vite emitted at build time. Always set `base: './'` (or the equivalent below) **before** `npm run build`.

| Stack | How to get relative paths at build time |
|-------|----------------------------------------|
| Plain HTML | Write `./`-prefixed paths directly in each `.html` file |
| **Vite** (vue / react / svelte) | **`base: './'` in `vite.config.ts`** — required before `npm run build` |
| Nuxt 3 | `app: { baseURL: './' }` in `nuxt.config.ts` |
| Next.js | `basePath` + `assetPrefix: './'` in `next.config.js` (when deploying under a subpath) |
| After any framework build | `prototype sync` rewrites absolute refs in copied **HTML only** — still configure the build tool above |

### Vite base path — required before first build

Vite defaults to `base: '/'`, generating absolute asset URLs (`/assets/app.js`). When `dist/` is deployed to a subdirectory, all asset requests resolve from the server root and return 403/404.

**Set `base: './'` in `vite.config.ts` before building:**

```ts
export default defineConfig({
  base: './',   // relative paths — works at any subdirectory depth
})
```

### Full SPA workflow

```bash
# 0. Ensure vite.config.ts has base: './'  ← required or assets will 403

# 1. Build the SPA
cd frontend && npm run build && cd ..

# 2. Sync build output + refresh screen-map
npx ai-spector prototype sync

# 3. Validate
npx ai-spector prototype validate --strict
```

If the agent is asked to "sync prototype", "copy build output", or "update screen map after build", run `prototype sync` (with any flags the user specified) and report the URI mapping table.

## External / already-hosted prototype (mapping only)

Use when the prototype **already runs on the server** (another repo or legacy deploy) and the user only needs **`screen-map.json`** for the web UI.

**Not** `prototype manifest` or `prototype sync` — no files required in this repo.

### Workflow

1. Read Screen Index from `list-screens.md` (screen ids + display names).
2. Ask the user for **URL layout**: `reviewHost` (required), optional `projectId` / `deployVersion`, or `directReviewUrl: true` for full URLs on another host.
3. Ask for **deploy path per screen** — e.g. `dist/login`, `login` (flat POC), `src/home.html`, or `https://legacy.example.com/…`.
4. Draft `prototype/path-map.json` with `"hosted": true` (see `path-map.example.json` or `path-map.example-flat.json`).
5. Show confirmation table (screenId → prototypePath → **reviewUrl**). **Wait for explicit yes.**
6. Write path-map if needed, then:

```bash
npx ai-spector prototype map --strict
```

7. User can edit `path-map.json` and re-run `prototype map` to refresh `screen-map.json`.

Full runbook: [docs/prototype/external-prototype-map.md](../../../../docs/prototype/external-prototype-map.md).

## Theme selection

| User says | Action |
|-----------|--------|
| “use stripe theme”, `--theme stripe` | `prototype setup --theme stripe` (persists preference); add `--force-design` if switching theme mid-branch |
| “what themes?” | `npx ai-spector prototype themes` |
| “preview stripe theme”, “show me vercel theme” | `npx ai-spector prototype preview <name> --open` |
| no theme in message, no stored theme | **[theme picker](theme-picker.md)**: recommend 3 → open previews → wait for choice |
| no theme in message, stored theme found | Use stored theme — do not ask |
| “help me pick a theme”, “which theme fits?” | Full [theme picker](theme-picker.md) even if not generating yet |

## Accuracy checklist

- [ ] If no stored tech stack: [stack picker](stack-picker.md) run — existing framework detected, options presented, user confirmed; `prototype stack <name>` executed
- [ ] If no stored basic auth: [auth picker](auth-picker.md) run — username/password collected, `prototype auth` executed, `prototype/.htpasswd` present
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
- [ ] Local asset refs use `./`-relative paths (not `/assets/...`) — static HTML in source; SPA via `base: './'` or `prototype sync`
- [ ] Tokens from `prototype/DESIGN.md` only (no random CDN)
- [ ] `prototype validate --strict` passes
- [ ] `screen-map.json` entries have correct `uri` values:
  - static mode → `/src/<stem>.html`
  - spa mode → `/<slug>`
- [ ] SPA mode only: single `index.html` entrypoint exists; route config generated; navigation uses route paths (not file paths)
- [ ] SPA mode only: `prototypeBypassAuth` honored in router — reviewers can open any `previewUri` without login
- [ ] SPA mode only: param/detail screens have `route-defaults.json` entries and non-empty `previewUri` in `screen-map.json`
- [ ] External build workflow: `prototype sync` run after framework build; `buildDest` contains the copied files

## On failure

Stop and report CLI output. Do not hand-edit `manifest.json` without re-running `prototype manifest`.
