# Prototype URL mapping — Web handover

> **Audience:** Web team building the prototype browser / screen picker on poc.dev.kaopiz.com.
> **Your job:** Read `prototype/screen-map.json`, build review URLs, link screens in the UI.
> **Not your job:** Regenerating the map, nginx deploy, or HTML/SPA generation.

---

## 1. URL formula

Every screen opens at:

```text
https://poc.dev.kaopiz.com/{projectId}/{version}/{prototypePath}
```

| Segment | Source | Example |
|---------|--------|---------|
| `projectId` | Deploy / release metadata | `acme-crm` |
| `version` | Release version slug | `1.4` |
| `prototypePath` | `screen-map.json` → `screens[].prototypePath` | `src/login.html` or `dist/login` |

**No trailing slash** on SPA routes. Static HTML includes the `.html` extension.

### Examples

| buildMode | prototypePath | Full URL |
|-----------|---------------|----------|
| `static` | `src/login.html` | `https://poc.dev.kaopiz.com/acme-crm/1.4/src/login.html` |
| `static` | `src/home.html` | `https://poc.dev.kaopiz.com/acme-crm/1.4/src/home.html` |
| `spa` | `dist/login` | `https://poc.dev.kaopiz.com/acme-crm/1.4/dist/login` |
| `spa` | `dist/orders/demo-001` | `https://poc.dev.kaopiz.com/acme-crm/1.4/dist/orders/demo-001` |

Default entry screen: use `defaultScreenId` to find the matching row, then that row's `prototypePath`.

```javascript
function reviewUrl(host, projectId, version, prototypePath) {
  const base = host.replace(/\/$/, "");
  const path = prototypePath.replace(/^\//, "");
  return `${base}/${projectId}/${version}/${path}`;
}
```

---

## 2. Mapping file

**Path in repo:** `prototype/screen-map.json`

**Path on server (after deploy):** `{project}/{version}/current/../prototype/screen-map.json` is **not** served publicly. Ship the JSON with your release bundle or read it from the repo at build time.

### Top-level fields

| Field | Type | Use |
|-------|------|-----|
| `schemaVersion` | `1` | Ignore unknown versions |
| `buildMode` | `"static"` \| `"spa"` | How to interpret `prototypePath` |
| `themeName` | string | Display only |
| `generatedAt` | ISO timestamp | Staleness hint |
| `defaultScreenId` | string? | Landing screen — match `screens[].screenId` |
| `buildDest` | string? | SPA only — usually `"dist"` |
| `prototypeBypassAuth` | boolean? | SPA only — informational for devs |

### Per-screen entry (`screens[]`)

| Field | Type | Use |
|-------|------|-----|
| `screenId` | string | Stable id (matches Screen Index) |
| `displayName` | string | UI label |
| `screenDocPath` | string | Design doc path (language-neutral) |
| `screenDocs` | object? | `{ "en": "docs/...", "vi": "docs/..." }` — link to spec |
| `prototypePath` | string | **Append to `{host}/{project}/{version}/`** |
| `route_exists` | boolean | `true` = build/HTML present; `false` = show "pending" in UI |

### Example — static HTML

```json
{
  "schemaVersion": 1,
  "buildMode": "static",
  "themeName": "stripe",
  "defaultScreenId": "login",
  "screens": [
    {
      "screenId": "login",
      "displayName": "Login",
      "screenDocPath": "basic-design/screens/login.md",
      "screenDocs": {
        "en": "docs/basic-design/en/screens/login.md",
        "vi": "docs/basic-design/vi/screens/login.md"
      },
      "prototypePath": "src/login.html",
      "route_exists": true
    }
  ]
}
```

Review URL: `https://poc.dev.kaopiz.com/{project}/{version}/src/login.html`

### Example — SPA (Vue/React)

```json
{
  "schemaVersion": 1,
  "buildMode": "spa",
  "buildDest": "dist",
  "defaultScreenId": "login",
  "prototypeBypassAuth": true,
  "screens": [
    {
      "screenId": "login",
      "displayName": "Login",
      "screenDocPath": "basic-design/screens/login.md",
      "prototypePath": "dist/login",
      "route_exists": true
    },
    {
      "screenId": "order-detail",
      "displayName": "Order Detail",
      "screenDocPath": "basic-design/screens/order-detail.md",
      "prototypePath": "dist/orders/demo-001",
      "route_exists": true
    }
  ]
}
```

Param routes like `dist/orders/demo-001` are pre-filled from `prototype/route-defaults.json` at manifest time — use `prototypePath` as-is; do not substitute params in the web UI.

---

## 3. Static vs SPA behavior

| | Static (`buildMode: static`) | SPA (`buildMode: spa`) |
|---|------------------------------|------------------------|
| **prototypePath** | File path: `src/{stem}.html` | Route under bundle: `dist/{route}` |
| **nginx** | Serves the HTML file directly | Serves `dist/index.html`; client router handles route |
| **Assets** | Relative to HTML: `./assets/logo.png` → URL `…/src/assets/logo.png` | Bundled under `…/dist/assets/*` |
| **Deep link** | Exact file URL | Route URL (no `.html`) |
| **Pending screen** | `route_exists: false` — HTML not generated yet | `route_exists: false` — `dist/index.html` missing (run build + sync) |

---

## 4. Deploy layout on disk

nginx reads from:

```text
/var/www/{projectId}/{version}/current/
├── src/                 ← static prototype (from prototype/src/)
│   ├── login.html
│   └── assets/
└── dist/                ← SPA build (from prototype/dist/)
    ├── index.html
    └── assets/
```

CI should copy:

- **Static:** `prototype/src/**` → `current/src/**`
- **SPA:** `prototype/dist/**` → `current/dist/**` (after `npx ai-spector prototype sync`)

---

## 5. UI checklist

- [ ] Load `screen-map.json` for the active `{projectId, version}`
- [ ] List `screens[]` with `displayName`; disable or badge when `route_exists` is false
- [ ] Build href with `{host}/{projectId}/{version}/{prototypePath}`
- [ ] Landing link: row where `screenId === defaultScreenId`
- [ ] Optional: link `screenDocs[locale]` to design doc viewer
- [ ] Basic auth: browser prompts automatically (nginx `auth_basic`)

---

## 6. nginx reference

Server config: [nginx-poc.conf](./nginx-poc.conf)

Key blocks:

- `dist|out/…` → SPA fallback to `index.html`
- `src/*.html` → static pages
- `src/…` → static assets (CSS, images next to HTML)

---

## 7. Regenerating the map (ops / dev — not web)

When screens change in basic design:

```bash
npx ai-spector prototype manifest
```

Web team only **consumes** the updated JSON on the next deploy.
