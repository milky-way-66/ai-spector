# Generate — Docops Module Guide

## Native config (Writer)

Enable with `capabilities.generate: true` and a non-empty `templatesPath` per enabled doc layer.

| Config | Purpose |
|--------|---------|
| `docTypes.<layer>.templatesPath` | Folder of `*.md` template files (e.g. `.docops/templates/srs`) |
| `docTypes.<layer>.enabled` | Layer must be `true` for generation |
| `capabilities.generate` | Master switch for cloud generation UI |

Generated **output** lives under `docs/{layer}/{lang}/` — separate from templates.

Writer lists templates from git; cloud generation runs when templates exist and capability is on.

## Custom adapter

ai-spector or a custom script may own generation:

1. Copy or author templates into `templatesPath`
2. Write generated markdown to `docs/{layer}/{lang}/`
3. Commit both template and output to git

To use only your pipeline (hide Writer cloud generation), set `capabilities.generate: false`. Templates may still exist for local tooling.
