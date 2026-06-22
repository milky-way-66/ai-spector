# Docops contract — project guide

Writer reads this repo via git. Edit files here, commit, and push — no CLI required.

## Folder map

| Path | Purpose |
|------|---------|
| `docops.config.json` | Languages, doc layers, paths, capabilities |
| `review.config.json` | Review sign-off preset |
| `review-queue/` | Review registry + pending queue |
| `comments/` | Comment threads (git-backed) |
| `prototype/` | Screen map + deploy config |
| `templates/` | Markdown templates per doc layer |
| `modules/` | Per-feature setup guides (this folder) |
| `adapters/` | External tool integration rules |

## Document paths

`docs/{docTypes.<layer>.path}/{language.path}/*.md`

Example: `docs/srs/en/1-introduction.md`

## Capabilities

| Key | Writer feature |
|-----|----------------|
| `review` | Review queue + sign-off |
| `comments` | Inline comments |
| `prototype` | Prototype screen map |
| `graph` | Traceability graph |
| `generate` | Cloud generation from templates |
| `translate` | Translation workflow UI |

Set a capability to `false` to hide that feature (no error).

## Module guides

- [Review](modules/review.md)
- [Comments](modules/comments.md)
- [Prototype](modules/prototype.md)
- [Generate](modules/generate.md)
- [Translate](modules/translate.md)
- [Graph](modules/graph.md)
- [External adapters](adapters/README.md)
