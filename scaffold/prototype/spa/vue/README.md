# Vue SPA prototype starter

Copy these patterns when generating a Vue 3 + Vite + Vue Router prototype. The agent should adapt routes to your `prototype/screen-map.json`.

## Prototype mode (direct routes, no login redirect)

Reviewers open any screen via `previewUri` in `screen-map.json` without signing in first.

1. Set `prototypeBypassAuth: true` in `prototype/route-defaults.json` (or rely on the default from `npx ai-spector prototype manifest`).
2. In the router guard, skip auth when bypass is enabled:

```ts
import screenMap from "../../screen-map.json";

const bypassAuth = screenMap.prototypeBypassAuth !== false;

router.beforeEach((to) => {
  if (bypassAuth) return true;
  if (to.meta.requiresAuth && !isLoggedIn()) {
    return { name: "login", query: { redirect: to.fullPath } };
  }
  return true;
});
```

3. Mark protected routes with `meta: { requiresAuth: true }` to match `requiresAuth` on screen-map entries.

## Route params and preview URIs

For detail screens, copy `prototype/route-defaults.example.json` to `prototype/route-defaults.json` and set default param values. Then run:

```bash
npx ai-spector prototype manifest
```

Use the generated `previewUri` per screen (e.g. `/orders/demo-001?tab=summary`) for bookmarks and QA links.

## Build

```bash
# vite.config.ts must use base: './'
npm run build
npx ai-spector prototype sync
```
