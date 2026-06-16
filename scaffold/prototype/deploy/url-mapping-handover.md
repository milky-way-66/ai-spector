# Prototype URL mapping — Web handover

> **Audience:** Web team building the prototype browser / screen picker (e.g. on poc.dev.kaopiz.com).
> **Input:** One JSON file — `prototype/screen-map.json` (from the project repo or release bundle).
> **Output:** A list of screens; each row links to a prototype URL.

---

## Quick start

1. **Load** `screen-map.json` at build time or runtime (it is not served as a public static file — ship it with your app or fetch from your backend).
2. **Iterate** `screens[]`.
3. **Link** each row using `reviewUrl` when present (recommended). Otherwise build the URL from top-level fields (section 2).
4. **Label** with `displayName`.
5. **Disable or badge** rows where `route_exists === false` (“Prototype not ready”).
6. **Default / landing screen:** use top-level **`defaultScreen`** — open `defaultScreen.reviewUrl` (or resolve href from `defaultScreen` like any row). `defaultScreenId` is the same screen’s id for reference.

You do **not** need `path-map.json`, `manifest.json`, or nginx config to build the UI — only `screen-map.json`.

---

## 1. Resolve the link (implementation)

Use this logic for every screen row:

```typescript
interface ScreenMap {
  reviewHost?: string;
  projectId?: string;
  deployVersion?: string;
  directReviewUrl?: boolean;
  defaultScreenId?: string;
  /** Landing screen — use for primary CTA / “Open prototype” button. */
  defaultScreen?: Screen;
  buildMode: "static" | "spa";
  screens: Screen[];
}

interface Screen {
  screenId: string;
  displayName: string;
  prototypePath: string;
  route_exists: boolean;
  reviewUrl?: string;
  screenDocPath?: string;
  screenDocs?: Record<string, string>; // e.g. { en: "docs/...", vi: "..." }
}

function resolvePrototypeHref(map: ScreenMap, screen: Screen): string | null {
  // 1. Pre-built URL (always prefer this)
  if (screen.reviewUrl?.trim()) {
    return screen.reviewUrl.trim();
  }

  // 2. Direct mode — prototypePath is already a full URL
  if (map.directReviewUrl) {
    return screen.prototypePath.trim();
  }

  // 3. Construct from host + optional segments + path
  const host = map.reviewHost?.trim();
  if (!host) return null;

  const base = host.replace(/\/$/, "");
  const path = screen.prototypePath.replace(/^\//, "");
  const segments = [map.projectId, map.deployVersion]
    .filter((s): s is string => Boolean(s?.trim()))
    .map((s) => encodeURIComponent(s!.trim()));
  segments.push(path);
  return `${base}/${segments.join("/")}`;
}

/** Primary prototype entry — use on landing page and “Open prototype” CTA. */
function resolveDefaultPrototypeHref(map: ScreenMap): string | null {
  if (map.defaultScreen) {
    return resolvePrototypeHref(map, map.defaultScreen);
  }
  if (!map.defaultScreenId) return null;
  const screen = map.screens.find((s) => s.screenId === map.defaultScreenId);
  return screen ? resolvePrototypeHref(map, screen) : null;
}
```

```javascript
// Same logic in plain JS
function resolvePrototypeHref(map, screen) {
  if (screen.reviewUrl?.trim()) return screen.reviewUrl.trim();
  if (map.directReviewUrl) return screen.prototypePath.trim();
  const host = map.reviewHost?.trim();
  if (!host) return null;
  const base = host.replace(/\/$/, "");
  const path = screen.prototypePath.replace(/^\//, "");
  const segments = [map.projectId, map.deployVersion]
    .filter(Boolean)
    .map((s) => encodeURIComponent(String(s).trim()));
  segments.push(path);
  return `${base}/${segments.join("/")}`;
}
```

### Decision table

| Condition | href source |
|-----------|-------------|
| `screen.reviewUrl` is set | Use `reviewUrl` as-is |
| `directReviewUrl === true` | Use `screen.prototypePath` (must be `https://…`) |
| `reviewHost` is set | `{reviewHost}/{projectId?}/{deployVersion?}/{prototypePath}` |
| None of the above | No link — show “URL not configured” or hide row |

**Important:** `projectId` and `deployVersion` are **optional**. Many deploys use flat URLs like `https://poc.dev.kaopiz.com/login` with no project or version segment.

### URL examples

| Mode | Top-level config | `prototypePath` | Result |
|------|------------------|-----------------|--------|
| Full POC path | `reviewHost` + `projectId` + `deployVersion` | `dist/login` | `https://poc.dev.kaopiz.com/acme-crm/1.4/dist/login` |
| Project, no version | `reviewHost` + `projectId` | `dist/login` | `https://poc.dev.kaopiz.com/acme-crm/dist/login` |
| Host only | `reviewHost` only | `login` | `https://poc.dev.kaopiz.com/login` |
| Static HTML | `reviewHost` + segments | `src/login.html` | `…/src/login.html` |
| External host | `directReviewUrl: true` | `https://legacy.example.com/app/login` | same as `prototypePath` |

---

## 2. Build the screen picker UI

### Minimum UI

| UI element | JSON source | Notes |
|------------|-------------|-------|
| Screen name | `displayName` | Primary label |
| Open prototype | `resolvePrototypeHref(…)` | `<a href="…" target="_blank" rel="noopener">` |
| Pending state | `route_exists === false` | Disable link; show badge “Pending” |
| Default / home | `defaultScreen` | **Primary CTA** — use `defaultScreen.reviewUrl` or `resolvePrototypeHref(map, defaultScreen)` |
| Default id (reference) | `defaultScreenId` | Same as `defaultScreen.screenId` |

### Optional UI

| UI element | JSON source | Notes |
|------------|-------------|-------|
| Design doc link | `screenDocs[locale]` or `screenDocPath` | Link to spec viewer if you have one |
| Build type hint | `buildMode` | `"static"` = one HTML file; `"spa"` = client router |
| Staleness | `generatedAt` | Show “map updated …” if helpful |

### `route_exists`

| Value | Meaning for web UI |
|-------|-------------------|
| `true` | Prototype is expected to load at the href |
| `false` | Not deployed yet — do not treat as broken URL; show as pending |

Do **not** infer readiness from missing `reviewUrl` alone — use `route_exists`.

### `buildMode` (opening the link)

| `buildMode` | What happens when user clicks |
|-------------|-------------------------------|
| `static` | Browser loads one HTML file (path ends in `.html`) |
| `spa` | Browser loads SPA shell; client router shows the route (no `.html` in URL) |

Open in a **new tab** (`target="_blank"`). Basic auth is handled by the browser when nginx requires it — no extra headers from your app.

### Param routes

Some SPA screens use demo IDs in the path, e.g. `dist/orders/demo-001`. Use `reviewUrl` / `prototypePath` **exactly as given**. Do not substitute or parse route params in the web UI.

---

## 3. JSON reference

**File:** `prototype/screen-map.json`

### Top-level fields

| Field | Type | Web team uses? | Description |
|-------|------|----------------|-------------|
| `schemaVersion` | `1` | Ignore if unknown | Schema version |
| `buildMode` | `"static"` \| `"spa"` | Optional | How prototype opens |
| `themeName` | string | Display only | Theme name |
| `generatedAt` | string (ISO) | Optional | When map was generated |
| `defaultScreenId` | string? | Reference | Id of landing screen; equals `defaultScreen.screenId` |
| **`defaultScreen`** | object? | **Yes** | **Landing screen** — full row with `reviewUrl`, `displayName`, etc. |
| `buildDest` | string? | Rarely | SPA output dir, usually `"dist"` |
| `prototypeBypassAuth` | boolean? | No | Dev/router hint only |
| `reviewHost` | string? | Fallback URLs | e.g. `https://poc.dev.kaopiz.com` |
| `projectId` | string? | Fallback URLs | Optional project slug |
| `deployVersion` | string? | Fallback URLs | Optional version slug |
| `directReviewUrl` | boolean? | **Yes** | When true, paths are full URLs |
| `screens` | array | **Yes** | Screen list |

### Per-screen fields (`screens[]`)

| Field | Type | Web team uses? | Description |
|-------|------|----------------|-------------|
| `screenId` | string | **Yes** | Stable id; match `defaultScreenId` |
| `displayName` | string | **Yes** | Label in UI |
| `prototypePath` | string | Fallback URLs | Deploy path or full URL (direct mode) |
| `route_exists` | boolean | **Yes** | `false` = pending |
| `reviewUrl` | string? | **Yes** | **Preferred** full href |
| `screenDocPath` | string | Optional | Neutral design doc path |
| `screenDocs` | object? | Optional | Per-locale doc paths |

Fields not listed above may appear in future schema versions — ignore unknown keys.

---

## 4. Full JSON examples

### A — SPA with project + version (typical POC)

```json
{
  "schemaVersion": 1,
  "buildMode": "spa",
  "buildDest": "dist",
  "reviewHost": "https://poc.dev.kaopiz.com",
  "projectId": "acme-crm",
  "deployVersion": "1.4",
  "defaultScreenId": "login",
  "defaultScreen": {
    "screenId": "login",
    "displayName": "Login",
    "screenDocPath": "basic-design/screens/login.md",
    "prototypePath": "dist/login",
    "route_exists": true,
    "reviewUrl": "https://poc.dev.kaopiz.com/acme-crm/1.4/dist/login"
  },
  "generatedAt": "2026-06-16T00:00:00.000Z",
  "screens": [
    {
      "screenId": "login",
      "displayName": "Login",
      "screenDocPath": "basic-design/screens/login.md",
      "prototypePath": "dist/login",
      "route_exists": true,
      "reviewUrl": "https://poc.dev.kaopiz.com/acme-crm/1.4/dist/login"
    },
    {
      "screenId": "order-detail",
      "displayName": "Order Detail",
      "screenDocPath": "basic-design/screens/order-detail.md",
      "prototypePath": "dist/orders/demo-001",
      "route_exists": true,
      "reviewUrl": "https://poc.dev.kaopiz.com/acme-crm/1.4/dist/orders/demo-001"
    }
  ]
}
```

### B — Host only (no project / version)

```json
{
  "schemaVersion": 1,
  "buildMode": "spa",
  "reviewHost": "https://poc.dev.kaopiz.com",
  "defaultScreenId": "login",
  "defaultScreen": {
    "screenId": "login",
    "displayName": "Login",
    "screenDocPath": "basic-design/screens/login.md",
    "prototypePath": "login",
    "route_exists": true,
    "reviewUrl": "https://poc.dev.kaopiz.com/login"
  },
  "screens": [
    {
      "screenId": "login",
      "displayName": "Login",
      "screenDocPath": "basic-design/screens/login.md",
      "prototypePath": "login",
      "route_exists": true,
      "reviewUrl": "https://poc.dev.kaopiz.com/login"
    }
  ]
}
```

### C — Static HTML

```json
{
  "schemaVersion": 1,
  "buildMode": "static",
  "reviewHost": "https://poc.dev.kaopiz.com",
  "projectId": "acme-crm",
  "deployVersion": "1.4",
  "defaultScreenId": "login",
  "defaultScreen": {
    "screenId": "login",
    "displayName": "Login",
    "screenDocPath": "basic-design/screens/login.md",
    "screenDocs": {
      "en": "docs/basic-design/en/screens/login.md",
      "vi": "docs/basic-design/vi/screens/login.md"
    },
    "prototypePath": "src/login.html",
    "route_exists": true,
    "reviewUrl": "https://poc.dev.kaopiz.com/acme-crm/1.4/src/login.html"
  },
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
      "route_exists": true,
      "reviewUrl": "https://poc.dev.kaopiz.com/acme-crm/1.4/src/login.html"
    }
  ]
}
```

### D — External host (`directReviewUrl`)

```json
{
  "schemaVersion": 1,
  "buildMode": "spa",
  "directReviewUrl": true,
  "defaultScreenId": "login",
  "defaultScreen": {
    "screenId": "login",
    "displayName": "Login",
    "screenDocPath": "basic-design/screens/login.md",
    "prototypePath": "https://legacy.example.com/prototypes/login",
    "route_exists": true,
    "reviewUrl": "https://legacy.example.com/prototypes/login"
  },
  "screens": [
    {
      "screenId": "login",
      "displayName": "Login",
      "screenDocPath": "basic-design/screens/login.md",
      "prototypePath": "https://legacy.example.com/prototypes/login",
      "route_exists": true,
      "reviewUrl": "https://legacy.example.com/prototypes/login"
    }
  ]
}
```

### E — Pending screen

```json
{
  "screenId": "checkout",
  "displayName": "Checkout",
  "screenDocPath": "basic-design/screens/checkout.md",
  "prototypePath": "dist/checkout",
  "route_exists": false
}
```

Show in the list but disable the link until ops regenerates the map with `route_exists: true`.

---

## 5. Implementation checklist

- [ ] Load `screen-map.json` for the active project release
- [ ] Implement `resolvePrototypeHref()` (section 1)
- [ ] Render `screens[]` sorted by `displayName` (or your product order)
- [ ] Use `reviewUrl` when present; fallback only when missing
- [ ] Respect `route_exists === false` (pending badge, no link)
- [ ] Landing / “Open prototype” CTA from **`defaultScreen`** (or `resolveDefaultPrototypeHref()`)
- [ ] Open prototype links in new tab; rely on browser basic auth
- [ ] Optional: link `screenDocs[userLocale]` to design docs
- [ ] Do not rewrite SPA paths or strip `.html` on static paths

---

## 6. FAQ

**How do I get the landing / default prototype URL?**  
Use **`defaultScreen.reviewUrl`** when present, or `resolveDefaultPrototypeHref(map)` (section 1). `defaultScreen` is the same row as in `screens[]` — you do not need to search by id unless `defaultScreen` is missing (legacy file).

**Is there a `link` field?**  
No. Use `reviewUrl`, or build from `reviewHost` + optional segments + `prototypePath`.

**Must every URL include `{project}/{version}`?**  
No. Omit `projectId` and/or `deployVersion` when the deploy uses flat URLs.

**What if `reviewUrl` is missing but `reviewHost` is set?**  
Build the URL with the fallback function in section 1.

**What if both are missing?**  
Show the screen as not linkable; check with ops that `prototype manifest` or `prototype map` was run with host config.

**Trailing slashes on SPA routes?**  
Do not add them. Use paths exactly as in JSON (`dist/login`, not `dist/login/`).

**Multiple projects on one web app?**  
Load one `screen-map.json` per project release. Top-level `projectId` / `deployVersion` describe that file’s URLs only.

**Where does the file come from?**  
Dev/ops generates it (`npx ai-spector prototype manifest` or `prototype map`). You receive it via git, CI artifact, or API — not from a public POC URL.

---

## 7. Static vs SPA (reference)

| | Static | SPA |
|---|--------|-----|
| `prototypePath` | File: `src/login.html` | Route: `dist/login` |
| URL shape | Ends with `.html` | No `.html`; path is a route |
| Server | Serves the HTML file | Serves `index.html`; app router handles route |

---

## 8. Deploy context (ops / infra — not required for UI code)

nginx serves files under `/var/www/{projectId}/{deployVersion}/current/` when using the versioned layout. Public URL:

```text
https://poc.dev.kaopiz.com/{projectId}/{deployVersion}/{prototypePath}
```

Flat deploys (no project/version) are valid — the JSON `reviewUrl` values are the source of truth for your links.

- nginx config: [nginx-poc.conf](./nginx-poc.conf)
- Hosted / external mapping workflow: [external-prototype-map.md](./external-prototype-map.md)

### Regenerating the map (ops only)

```bash
npx ai-spector prototype manifest      # in-repo prototype
npx ai-spector prototype map --strict  # hosted / path-map workflow
```

Web team consumes the updated JSON on the next deploy.
