# Documentation templates

This folder is copied into your project at **`.ai-spector/templates/`** when you run `npx ai-spector init`.

## For Cursor agents

**Always read templates from the project copy**, not from `node_modules`:

| Kind | Path (after init) |
|------|-------------------|
| SRS | `.ai-spector/templates/srs/` |
| Basic design | `.ai-spector/templates/basic_design/` |
| Detail design | `.ai-spector/templates/detail_design/` |

DAG config (`dag.*.json`) lists template filenames relative to this root (e.g. `srs/1-introduction.md`, `basic_design/list-api-template.md`).

When generating markdown under `docs/`, **preserve each template’s headings and section order**; replace placeholders with graph- and data-source-backed content.

## For developers

- Re-run `npx ai-spector init --force` to refresh scaffold files and template copies from the installed package.
- Editing files here is safe for project-specific wording; re-init overwrites them unless you back up changes first.
