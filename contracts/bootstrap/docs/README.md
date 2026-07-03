# Docops contract — project guide

Writer reads this repo via git. Edit files here, commit, and push — no CLI required.

## Folder map

| Path | Purpose |
|------|---------|
| `docops.config.json` | Languages, doc layers, paths, capabilities |
| `registry/` | **Entity registry** — stable UUIDs per design doc / screen (`registry sync`) |
| `review.config.json` | Review sign-off preset |
| `review-queue/` | Review sign-off state (v4 keys = `entityId`; legacy v3 = `logicalPath`) |
| `comments/` | Comment threads — `documents/{entityId}/` or `screens/{screenId}/` (legacy: path folders) |
| `prototype/` | Screen map (legacy) or registry screens after sync |
| `templates/` | Markdown templates per doc layer |
| `modules/` | Per-feature setup guides (this folder) |
| `adapters/` | External tool integration rules |

**Not the same as:** `.docops/review-queue/registry.json` (review sign-off) or `.ai-spector/registry/section-registry.json` (traceability section index for local graph).

## Document paths

`docs/{docTypes.<layer>.path}/{language.path}/*.md`

Example: `docs/srs/en/1-introduction.md`

## Capabilities

| Key | Writer feature |
|-----|----------------|
| `review` | Review queue + sign-off |
| `comments` | Inline comments |
| `prototype` | Prototype screen map |
| `graph` | Traceability graph in **Writer web UI** (local `npx ai-spector index` always builds `.ai-spector/graph/` regardless) |
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
