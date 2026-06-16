# Prototype agent constraints

- **Static HTML** (`techStack: html`): output only HTML/CSS/JS under `prototype/src/` — one `.html` per screen; filename must match `prototypeStem` from `prototype/manifest.json`.
- **SPA** (`buildMode: spa`): one entrypoint, framework components per screen; honor `prototypeBypassAuth` and `prototypePath` in `screen-map.json` (see `route-defaults.example.json` and `spa/vue/`).
- **Local asset refs must be relative** — use paths from the current HTML file (`./styles.css`, `./assets/app.js`), not root-absolute paths (`/assets/app.js`). Root-absolute URLs break when the prototype is served from a subdirectory on deploy.
- Use design tokens from `prototype/DESIGN.md` only — do not import external fonts/icons unless specified there.
- Do not edit `docs/**` while generating prototype files.
- Do not create files outside `prototype/`.
