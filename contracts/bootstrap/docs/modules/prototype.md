# Prototype — Docops Module Guide

## Native config (Writer)

Enable with `capabilities.prototype: true` in `.docops/docops.config.json`.

| File | Purpose |
|------|---------|
| `.docops/prototype/screen-map.json` | Maps screens ↔ docs ↔ prototype URLs |
| `.docops/prototype/config.json` | Deploy/review settings (no HTML source) |

Prototype **HTML/SPA source** lives at repo root `prototype/` — optional and not part of the docops schema.

Schema: `kari-writer/contracts/schemas/prototype/`. Example: `contracts/examples/minimal-screen-map.json`.

Writer reads `screen-map.json` to link design docs to prototype previews. Missing screen-map hides prototype features without error.

## Custom adapter

A deploy pipeline may update `screen-map.json` when screens change:

1. Preserve `schemaVersion` and existing screen IDs where possible
2. Set `reviewUrl` after deploy completes
3. Commit to the same branch users review in Writer

Set `capabilities.prototype: false` when prototype mapping is not used.
