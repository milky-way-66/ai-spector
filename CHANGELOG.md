# Changelog

All notable changes to [ai-spector](https://github.com/milky-way-66/ai-spector) are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Fixed

- **Graphify index** — skip `graphify update` for empty doc sources (`docs/srs`, `docs/basic-design`) instead of failing with exit 1; `ai-spector index` continues.
- **Graphify output path** — `GRAPHIFY_OUT` is always an absolute path under the project root (cwd stays project root); removes stale `docs/data-source/.ai-spector/.../graphify-out` when Graphify wrote relative to the source path.

## [0.2.0] - 2026-05-21

### Added

- **`ai-spector index`** — full project refresh: registry/bootstrap, knowledge merge, **doc semantics** (UC/F and actor ids parsed from SRS and basic-design markdown bodies), Graphify multi-source update with content-hash skip (and `--force-graphify`), graph validate, and document indexes under `.ai-spector/index/`. Flags: `--graph-only`, `--docs-only`, `--skip-graphify`, `--skip-docs`, `--skip-merge`, `--skip-doc-semantics`, `--skip-validate`.
- **Post-generate graph wiring** — after generation, index/doc-extract adds per-domain **detail `document` nodes**, **section** nodes from headings (`###` / `<!-- section:... -->`), and **`definedIn`** edges from UC/F nodes to sections (not only file-level links).
- **Cursor `/index`** — agent workflow for `ai-spector index` (recommended after `/generate-srs`).
- **Cursor `/summary`** — optional searchable summaries in `.ai-spector/index/` only (does not replace a full graph refresh).
- **Cursor `/impact`** — context-driven regen scope from natural-language change description, git diff, editor selection, file path, or heading; seeds resolved without requiring a graph node id (`src/graph/resolve.ts`).
- **`ai-spector graph impact`** — `--git`, `--file`, `--heading` alongside optional node id; used by `/impact`.
- **Vitest** test suite — 75+ unit tests in `tests/` mirroring `src/`; `npm test` / `npm run test:watch`.
- **Docs** — [docs/testing.md](docs/testing.md) and `.cursor/rules/testing.mdc` for contributors and agents.

### Changed

- **README** — Cursor-first workflow, slash-command table, troubleshooting, CLI reference for `index` and `graph impact`, Graphify path under `.ai-spector/.docflow/graph/graphify-out/`.
- **Graphify integration** — update runs on changed paths across `docs/data-source`, `docs/srs`, and `docs/basic-design`; hash-based skip unless forced.
- **HTML visualize report** — detail documents, sections, and **`rendersTo`** edges to repo-relative file paths.
- **Example project** removed from the published package layout; use `npm run init:example` on a clone.

### Fixed

- **`rendersTo` edges** — `InMemoryGraph.from()` and graph mutations allow `to` as a **file path** without a target node; validation skips path targets for `rendersTo` only.
- **Graph load/validate** — consistent handling of path-target `rendersTo` across merge, query, and visualize.

### Breaking

Slash commands renamed after `init` (update scaffold in existing projects or re-run `npx ai-spector init` where safe):

| Old command | New command |
|-------------|-------------|
| `/index-docs` | **`/summary`** |
| `/index-refresh` | **`/index`** |
| `/graph-impact` | **`/impact`** |

Deprecated stubs may remain for `/graph-impact`; use **`/impact`** — it no longer requires a graph node id up front.
