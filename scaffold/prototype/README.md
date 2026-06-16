# Prototype workspace

Static HTML prototypes for screens defined in basic design.

## Basic auth (once per project)

Before generating HTML, configure HTTP basic auth (credentials in config, hash in `.htpasswd`):

```bash
npx ai-spector prototype auth --username <user> --password '<secret>'
```

Stored in `.ai-spector/.docflow/config/prototype/config.json` (`basicAuth`) and `prototype/.htpasswd`.

Regenerate `.htpasswd` after cloning if the file is missing:

```bash
npx ai-spector prototype auth --from-config
```

## Setup (once per project or when changing theme)

The agent resolves the theme automatically (`theme.json`, manifest, or `prototype/config.json` → `defaultTheme`).

**First time (no theme saved):** the agent reads your project docs, recommends **3 best-fit themes**, opens preview samples in your browser, and waits for you to pick before setup.

You can also name a theme directly (e.g. “prototype with stripe theme”) to skip recommendations.

```bash
npx ai-spector prototype themes                 # full list ([preview] = visual sample)
npx ai-spector prototype preview stripe --open  # open one theme sample
npx ai-spector prototype setup --theme vercel   # after you choose — persists defaultTheme
```

## Generate screens

In Cursor, run **`/generate-prototype`** (or ask to generate the HTML prototype). The agent reads:

- `docs/basic-design/list-screens.md` (design system + screen map)
- `docs/basic-design/screens/<slug>.md` (wireframe per screen)
- `prototype/DESIGN.md` (theme tokens)

Output: `prototype/src/<prototypeStem>.html` (one file per Screen Index row).

## After generation

```bash
npx ai-spector prototype manifest
npx ai-spector prototype validate --strict
git add prototype/
```

## Screen → file mapping

See `prototype/manifest.json` and `prototype/screen-map.json` (rebuilt by `npx ai-spector prototype manifest`).

## SPA prototypes (Vue, React, …)

When `buildMode` is `spa`:

1. **Direct routes** — `screen-map.json` sets `prototypeBypassAuth: true` so the app router must not force login before showing a deep-linked screen.
2. **Detail / param URLs** — copy `route-defaults.example.json` to `route-defaults.json`, set default `routeParams` (e.g. `id: "demo-001"`), then run `npx ai-spector prototype manifest`. Each screen's `prototypePath` is the deploy path (e.g. `dist/orders/demo-001`).
3. **Deep links** — nginx serves SPA routes with `try_files`; only root `dist/index.html` is required.

Each `screen-map.json` screen entry:

```json
{
  "screenId": "login",
  "displayName": "Login",
  "screenDocPath": "basic-design/screens/login.md",
  "screenDocs": {
    "en": "docs/basic-design/en/screens/login.md",
    "vi": "docs/basic-design/vi/screens/login.md"
  },
  "prototypePath": "dist/login",
  "route_exists": true
}
```

Static HTML uses a deploy-relative file path (e.g. `src/login.html`). Route patterns and param defaults live in `route-defaults.json`.

**Web team:** see `prototype/deploy/url-mapping-handover.md` and `prototype/deploy/nginx-poc.conf`.
