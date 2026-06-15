# Build prototype

**Section:** [Design & prototype](README.md) · **Course:** [Home](../README.md)  
**Time:** ~10 min · **Before:** Basic design with screen list

**Goal:** Pick a theme and generate a clickable UI mockup.

---

## Pick a theme

```
help me pick a theme
```

Agent opens browser previews (`stripe`, `material`, `minimal`, `dark`, …). Or skip:

```
generate prototype with stripe theme
```

---

## Generate

**Static HTML** *(default)*:

```
generate HTML prototype
```

Open: `npx serve prototype/` or ask the agent to open in browser.

**SPA** *(Vue, React, …)*:

```
generate prototype with Vue
npm run build && npx ai-spector prototype sync
npx serve -s prototype/dist/
```

---

## What you should see

- Theme picker with 3 recommendations or direct theme name.
- HTML files under `prototype/` (or `prototype/dist/` for SPA).
- `prototype validate --strict` passes.

---

## Check

```bash
npx ai-spector prototype validate --strict
```

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| No screens to prototype | Complete basic design screen list first |
| SPA blank after build | Run `prototype sync` after framework build |
| Validate fails | Read validator output; fix missing screen links |

---

## Next section

[Review & changes](../06-review/README.md)
