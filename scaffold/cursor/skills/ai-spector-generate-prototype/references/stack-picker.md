# Stack picker — choose tech stack before generating

> **Hard rule: never auto-select a stack.** The agent may recommend based on project context, but the user must explicitly confirm before any file is generated or setup runs.

Run this flow **once**, before theme resolution and `prototype setup`, when `prototype/config.json` has no `techStack`.

Skip when:

- `techStack` is already set in `.ai-spector/.docflow/config/prototype/config.json`
- User named a stack in this request (e.g. "use Vue", "generate with React", `--stack vue`)

## Supported stacks

| Stack | `techStack` value | `buildMode` | File type generated |
|-------|------------------|-------------|---------------------|
| Plain HTML/CSS/JS | `html` | `static` | `.html` per screen |
| Vue 3 + Vite + Vue Router | `vue` | `spa` | `.vue` component per screen |
| React + Vite + React Router | `react` | `spa` | `.tsx` component per screen |
| Nuxt 3 | `nuxt` | `spa` | `pages/<slug>.vue` per screen |
| Next.js | `next` | `spa` | `app/<slug>/page.tsx` per screen |
| SvelteKit | `svelte` | `spa` | `routes/<slug>/+page.svelte` per screen |
| Angular | `angular` | `spa` | component per screen |

## Required: relative asset paths for all web builds

> When HTML references a local file (script, stylesheet, image), use a path **relative to the current HTML file** (`./assets/app.js`), not a root-absolute path (`/assets/app.js`). Root-absolute URLs break when the prototype is served from a subdirectory on deploy.

Example (correct):

```html
<script type="module" crossorigin src="./assets/index-uOr-eA2t.js"></script>
```

## Required: relative base path for Vite-based stacks (vue, react, svelte)

> Vite defaults to `base: '/'` which generates **absolute** asset URLs (`/assets/app.js`). When the built `dist/` is served from a subdirectory (e.g. `/project-id/1.4/dist/`), all asset requests hit the server root and return 403/404.

**Always set `base: './'` in `vite.config.ts` before the first build:**

```ts
// vite.config.ts
export default defineConfig({
  base: './',   // relative paths — works at any subdirectory depth
})
```

After adding this, rebuild and resync:

```bash
npm run build
npx ai-spector prototype sync --clean
```

When the agent sets up a Vite-based stack (vue / react / svelte), it **must** write or verify `base: './'` in `vite.config.ts` before generating any other files. Flag it explicitly to the user if the config is missing or set to `'/'`.

## SPA-only: direct routes and param defaults

Framework stacks use `buildMode: spa`. After stack selection, follow [spa-prototype.md](spa-prototype.md):

- Router must allow **direct navigation** to any screen without login redirect (`prototypeBypassAuth`).
- Detail screens with URL params need defaults in `prototype/route-defaults.json` → `previewUri` in `screen-map.json`.

## Step 1 — Check stored stack

Read `.ai-spector/.docflow/config/prototype/config.json`. If `techStack` is set, skip this entire flow.

## Step 2 — Gather project context

Scan quickly for signals:

| Source | What to look for |
|--------|-----------------|
| `package.json` at project root | `vue`, `react`, `next`, `nuxt`, `svelte`, `@angular/core` dependencies |
| Any `vite.config.*`, `next.config.*`, `nuxt.config.*`, `angular.json` | Framework config files |
| User message | Explicit mention ("build with Vue", "use React", "plain HTML") |

If a framework is already in use in the project, **recommend it first** — the most common case is the prototype mirrors the main app's stack.

## Step 3 — Present choices and wait

Post a short message. Adapt the recommendations to what you found in step 2.

**When a framework is detected in the project:**

```
Which tech stack should the prototype use?

  Detected in your project: **Vue 3**

  | # | Stack | Notes |
  |---|-------|-------|
  | 1 | **Vue 3** (vue) | Matches your existing stack — components, Vue Router |
  | 2 | **HTML** (html) | No build step, pure static files |
  | 3 | **React** (react) | Vite + React Router, .tsx components |

  Reply with 1, 2, 3, or another stack name (vue / react / nuxt / next / svelte / angular / html).

  I will run setup after you choose.
```

**When no framework is detected:**

```
Which tech stack should the prototype use?

  | # | Stack | Notes |
  |---|-------|-------|
  | 1 | **HTML** (html) | No build step — simplest, works everywhere |
  | 2 | **Vue 3** (vue) | Vite + Vue Router, .vue components |
  | 3 | **React** (react) | Vite + React Router, .tsx components |

  Other options: nuxt / next / svelte / angular

  Reply with a number or stack name. I will run setup after you choose.
```

**Stop here.** Do not run any CLI command or generate any file until the user replies.

## Step 4 — Persist and continue

When the user picks (number, name, or keyword like "use vue"):

```bash
npx ai-spector prototype stack <chosen-stack>
```

This writes `techStack` and derives `buildMode` in `prototype/config.json`. Then continue with [runbook.md](runbook.md) from step 0 (auth) onward.

## Changing the stack later

If the user asks to switch stacks after generation has started:

1. Run `npx ai-spector prototype stack <new-stack>` to update config.
2. Warn: existing generated files may not match the new stack — the user should delete `prototype/src/` and regenerate.
3. Re-run `prototype setup` and regenerate all screens.
