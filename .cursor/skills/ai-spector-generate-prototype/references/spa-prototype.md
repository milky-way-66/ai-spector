# SPA prototype — direct routes and param defaults

Load this reference when `buildMode` is `spa` (vue, react, nuxt, next, svelte, angular).

## Why prototype mode differs from production

In production, unauthenticated users are redirected to login before seeing app screens. **Prototypes are for visual review** — stakeholders must open any screen directly (including post-login dashboards and detail pages) without walking through auth every time.

The agent **must** implement prototype-friendly routing and keep `prototypePath` entries current in `screen-map.json`.

## 1. Bypass auth redirects (required for SPA)

Set `prototypeBypassAuth: true` on `prototype/screen-map.json` (default when running `npx ai-spector prototype manifest` in SPA mode).

In the SPA router:

- When `prototypeBypassAuth` is true (or unset — treat as true for prototypes), **do not** redirect to login in `beforeEach` / middleware.
- Still define `meta.requiresAuth` on routes that would be protected in production (matches `requiresAuth` in `route-defaults.json`).
- Optional: read bypass from `import.meta.env.VITE_PROTOTYPE_BYPASS_AUTH === 'true'` if the app is built outside `prototype/` — keep in sync with screen-map.

Starter pattern: [scaffold/prototype/spa/vue/src/prototype-guard.ts](../../../../prototype/spa/vue/src/prototype-guard.ts).

Tell the user: *"Open any screen via the `prototypePath` column in screen-map.json — login redirect is disabled in prototype mode."*

## 2. Default URL params in the mapping file (required for param routes)

Detail screens use path or query params (`:id`, `?tab=`). Reviewers need a **ready-made URL** without guessing IDs.

### `prototype/route-defaults.json`

Copy from `prototype/route-defaults.example.json` and edit per screen id (Screen Index id, e.g. `order-detail`):

```json
{
  "schemaVersion": 1,
  "prototypeBypassAuth": true,
  "screens": {
    "order-detail": {
      "routePattern": "/orders/:id",
      "routeParams": { "id": "demo-001" },
      "queryParams": { "tab": "summary" },
      "requiresAuth": true
    }
  }
}
```

Then regenerate the map:

```bash
npx ai-spector prototype manifest
```

### Fields on each `screen-map.json` entry

| Field | Purpose |
|-------|---------|
| `screenDocPath` | Language-neutral design doc path |
| `screenDocs` | Per-language design doc paths (multi-lang projects) |
| `prototypePath` | **Open this path** — deploy route dir for SPA (e.g. `dist/login/`, `dist/orders/demo-001/`) |
| `route_exists` | Whether the SPA build or static HTML file is present |

Route patterns, param defaults, and auth flags live in `route-defaults.json` only — not duplicated in `screen-map.json`.

### Router implementation

- Register routes using `routePattern` from `route-defaults.json` (e.g. `/orders/:id`).
- Seed component state from `route.params` / `useRoute()`; when params are missing in dev, fall back to defaults from `route-defaults.json` or hard-coded prototype fixtures matching `routeParams`.
- Link between screens with the framework router; use `prototypePath` in docs/comments for QA bookmarks.

## 3. Agent checklist (SPA)

- [ ] `prototype/route-defaults.json` created for any screen with `:param` or required query args
- [ ] Router guard skips login redirect when `prototypeBypassAuth` is true
- [ ] Routes registered from `route-defaults.json` patterns
- [ ] `npx ai-spector prototype manifest` run — every param route has a concrete `prototypePath`
- [ ] User told they can open `prototypePath` values directly (list them in the completion message)

Deep links are served by nginx `try_files` — ship only the framework build output (`dist/index.html` + assets); do not duplicate `index.html` under each route folder.

## 4. Static HTML note

Static prototypes (`techStack: html`) already use one file per screen — no router bypass. `prototypePath` is the repo-relative HTML file (e.g. `prototype/src/login.html`). Param-heavy flows may use query strings in the filename link (e.g. `order-detail.html?id=demo-001`) or a dedicated static page per variant; prefer SPA when many param routes exist.
