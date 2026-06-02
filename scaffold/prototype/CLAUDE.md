# Prototype agent constraints

- Output only **static HTML** (and optional co-located `.css` / `.js`) under `prototype/src/`.
- One primary `.html` per screen; filename must match `prototypeStem` from `prototype/manifest.json`.
- Use design tokens from `prototype/DESIGN.md` only — do not import external fonts/icons unless specified there.
- Do not edit `docs/**` while generating prototype files.
- Do not create files outside `prototype/`.
