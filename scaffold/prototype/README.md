# Prototype workspace

Static HTML prototypes for screens defined in basic design.

## Setup (once per project or when changing theme)

The agent resolves the theme automatically (`theme.json`, manifest, or `prototype.config.json` → `defaultTheme`). You only need to name a theme when you want to switch (e.g. “prototype with stripe theme”).

```bash
ai-spector prototype setup --theme vercel   # persists defaultTheme when --theme is set
ai-spector prototype themes                 # optional: list bundled themes
```

## Generate screens

In Cursor, run **`/generate-prototype`** (or ask to generate the HTML prototype). The agent reads:

- `docs/basic-design/list-screens.md` (design system + screen map)
- `docs/basic-design/screens/<slug>.md` (wireframe per screen)
- `prototype/DESIGN.md` (theme tokens)

Output: `prototype/src/<prototypeStem>.html` (one file per Screen Index row).

## After generation

```bash
ai-spector prototype manifest
ai-spector prototype validate --strict
git add prototype/
```

## Screen → file mapping

See `prototype/manifest.json` and `prototype/screen-map.json` (rebuilt by `ai-spector prototype manifest`).
