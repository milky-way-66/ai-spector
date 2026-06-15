# Work 13 — Generate Prototype

**Course:** [Index](README.md) · [Overview](00-overview.md) · [Previous](12-pick-prototype-theme.md)

**Goal:** Have the agent build a clickable UI prototype from your screen list and basic design documents.

**Before you start:** Work 11 (Generate Basic Design) — the screen list and per-screen wireframes must exist. Work 12 (Pick a Theme) is recommended; the agent will prompt you if no theme is saved.

---

## What the Prototype Is

A prototype simulates UI flows for stakeholder review. It is not a production app — it is a mockup you can click through in a browser.

AI Spector supports **two build modes**:

| Mode | Best for | Output | How you open it |
|------|----------|--------|-----------------|
| **Static HTML** (default) | Quick mockups, no build step | One `.html` file per screen under `prototype/src/` | Open a file directly or serve `prototype/` |
| **SPA** | React, Vue, or similar frameworks | Source under `prototype/src/` → framework **build** → static files in `prototype/dist/` | Serve `prototype/dist/` (e.g. `npx serve -s prototype/dist`) |

Both modes use the same screen list (`docs/basic-design/list-screens.md`) and theme tokens (`prototype/DESIGN.md`).

---

## Choose a mode

### Static HTML *(default)*

Say this in chat:

```
generate HTML prototype
```

Or simply:

```
generate prototype
```

The agent writes `prototype/src/<screen>.html` — one file per row in the Screen Index.

### SPA *(framework + static build)*

Tell the agent which stack you want, for example:

```
generate prototype with Vue
```

```
generate prototype with React
```

The agent:

1. Sets `buildMode: "spa"` in `.ai-spector/.docflow/config/prototype/config.json`
2. Generates framework components/views under `prototype/src/` (one per screen)
3. Expects you (or the agent) to run the framework build, then sync the output:

```bash
npm run build                    # in your prototype app folder
npx ai-spector prototype sync    # copies build output → prototype/dist/
```

SPA mode has a **single `index.html` entrypoint** and client-side routes (e.g. `/login`, `/checkout`) — not one HTML file per screen.

---

## Steps (both modes)

### 1. Open chat

### 2. Start generation

**Static HTML:**

```
generate HTML prototype
```

**SPA:**

```
generate prototype with Vue
```

### 3. Pick a theme (if not already set)

If you haven't set a theme yet (Work 12), the agent will:

1. Recommend 3 themes
2. Open browser previews for you to compare
3. Wait for you to choose

To skip the prompt:

```
generate prototype with stripe theme
```

Built-in themes include: `stripe`, `material`, `tailwind`, `minimal`, `dark`.

### 4. Wait for generation

Typical time: 1–3 minutes per screen for source files. SPA also needs a build step after generation.

### 5. Generate all screens

```
generate prototype for all screens
```

### 6. Open the prototype

**Static HTML:**

```bash
open prototype/src/<first-screen>.html
```

Or serve the folder:

```bash
npx serve prototype/
```

**SPA** (after build + sync):

```bash
npx serve -s prototype/dist/
```

Then open `http://localhost:3000` and navigate between routes.

Or ask the agent:

```
open the prototype in the browser
```

### 7. Iterate

Click through screens and give feedback in chat:

```
the checkout screen is missing the order summary panel
```

```
add a back button to the profile screen
```

---

## Check

**Static HTML:** `prototype/src/` contains one `.html` file per screen from the Screen Index. Click through at least one flow end-to-end.

**SPA:** `prototype/dist/` exists after build + `prototype sync`, and routes in `prototype/screen-map.json` open the correct screens.

```bash
npx ai-spector prototype validate --strict
```

---

## Troubleshooting

**Agent asks for a theme but the preview doesn't open**

Name the theme directly:

```
generate prototype with minimal theme
```

**Only one screen was generated**

```
generate prototype for all screens
```

**Static HTML looks broken in the browser**

CSS may need a local server instead of `file://`:

```bash
npx serve prototype/
```

**SPA routes return 404 when serving `dist/`**

Run manifest/sync so fallback `index.html` copies exist for deep links:

```bash
npx ai-spector prototype manifest
npx ai-spector prototype sync
```

**Build output is in the wrong folder**

Set paths in `.ai-spector/.docflow/config/prototype/config.json`:

```json
{
  "buildMode": "spa",
  "buildSrc": "frontend/dist",
  "buildDest": "prototype/dist"
}
```

Then `npx ai-spector prototype sync --from frontend/dist`.

---

## Next

Go to [Work 14 — Impact Analysis](14-impact-analysis.md).
