# Build prototype

**Section:** [Design & prototype](README.md) · **Course:** [Home](../README.md)  
**Time:** ~15 min · **Before:** Basic design with screen list

**Goal:** Confirm stack, auth, and theme — then generate a clickable UI mockup in-repo.

---

## Prerequisites

- `docs/basic-design/list-screens.md` + screen detail files exist.
- Recommended: `npx ai-spector graph validate` passes.

---

## 1. Pick tech stack

The agent asks once and saves your choice in `prototype/config.json`:

```
help me pick a prototype stack
```

or name it directly:

```
generate prototype with Vue
```

| Stack | Mode | Output |
|-------|------|--------|
| `html` | static | `prototype/src/<stem>.html` |
| `vue`, `react`, `nuxt`, … | spa | one component per screen + single `index.html` entrypoint |

CLI: `npx ai-spector prototype stack <name>`

---

## 2. Configure basic auth

Prototype hosting expects HTTP basic auth. The agent collects credentials once:

```
set up prototype auth
```

CLI: `npx ai-spector prototype auth` — writes `prototype/.htpasswd`.

---

## 3. Pick a theme

```
help me pick a theme
```

Agent opens browser previews (`stripe`, `material`, `minimal`, `dark`, …). Or skip:

```
generate prototype with stripe theme
```

CLI: `npx ai-spector prototype setup --theme <name>`

---

## 4. Generate

**Static HTML** *(default stack)*:

```
generate HTML prototype
```

Files land under `prototype/src/`. Open locally:

```bash
npx serve prototype/
```

**SPA** *(Vue, React, …)*:

```
generate prototype with Vue
```

After framework build:

```bash
npm run build
npx ai-spector prototype sync
npx serve -s prototype/dist/
```

Set `base: './'` in Vite (or equivalent) **before** build so assets work when deployed under a subdirectory.

---

## 5. Manifest & default screen

Regenerate manifest and set the landing screen:

```bash
npx ai-spector prototype manifest --default-screen login
npx ai-spector prototype validate --strict
```

`screen-map.json` gets `defaultScreenId`, `uri` per screen, and (for SPA) `previewUri` deep links.

---

## What you should see

- Stack, basic auth, and theme stored in `.ai-spector/.docflow/config/prototype/config.json`.
- One file per screen under `prototype/src/` (or `prototype/dist/` after SPA sync).
- `prototype validate --strict` passes.
- Navigation links match routes from `screen-map.json` — not invented paths.

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Agent asks stack/auth/theme every run | Run the pickers once; choices persist in config |
| No screens to prototype | Complete basic design screen list first |
| SPA blank or 403 on assets | Set `base: './'` before build, then `prototype sync` |
| Wrong landing page | `prototype manifest --default-screen <screenId>` |
| Validate fails | Read validator output; fix missing screen links or stems |

---

## Prototype already hosted elsewhere?

If the UI is built and deployed on another server (POC, legacy app), skip generation — use [External prototype map](03-external-prototype-map.md) to wire `reviewUrl` links for the web review UI.

---

## Next

[External prototype map](03-external-prototype-map.md) *(optional)* · [Review & changes](../06-review/README.md)
