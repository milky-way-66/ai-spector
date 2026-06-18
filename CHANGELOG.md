# Changelog

All notable changes to [ai-spector](https://github.com/milky-way-66/ai-spector) are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **Adopt v2 (gated legacy alignment)** — adopt is a first-class task workflow (`kind: adopt`) with `task_approve_adopt_plan` and server gates on `adopt_apply` / `adopt_bootstrap`. Detail design (`docs/detail-design/`, legacy `docs/dd/`) included in scan/plan/apply. Custom pack still hard-forks to `ai-spector-template-import`.

### Changed

- **Skills-only Cursor bundle** — removed `.cursor/commands/`; runbooks live under each skill’s `references/`; shared docs under `ai-spector/references/`; pipeline in `.cursor/WORKFLOW.md`. Users describe tasks in natural language; agents route via skill descriptions.
- **Generate command docs** — shared orchestration in `ai-spector/references/generate-workflow.md`; per-layer `references/runbook.md` files keep DAG/intent/waves only.

- **Scaffold Cursor bundle** — slash commands and skills live in `scaffold/cursor/` (versioned); `ai-spector init` copies to project `.cursor/`.
- **Task skills split by layer** — separate skills for graph, SRS, basic design, detail design, prototype, and comments; `ai-spector-generate` is a router for ambiguous requests; `paths` frontmatter scopes file-context routing; see `.cursor/skills/README.md`.
- **Task skills for auto-routing** — `ai-spector-graph`, `ai-spector-generate-*`, `ai-spector-resolve-comments` plus core `ai-spector`; router at `scaffold/cursor/skills/_skill-router.md`.
- **Basic-design workflow** — screen list output is `docs/basic-design/list-screens.md` (not `screens/list-screens.md`); API and screen **detail** files expand from list-chapter tables (one file per endpoint / per screen), not one file per `F-xx` feature. Doc-extract and `/generate-basic-design` updated accordingly.

### Added

- **Upgrade workflow** — `npx ai-spector upgrade` (scan → apply → validate → status), `ai-spector-upgrade` skill, package `upgrade-checklist.json`, `scaffoldVersion` in `docflow.config.json`, MCP `upgrade_*` tools. Chat: **"upgrade ai-spector"**; checklist IDs in `### Upgrade` release notes (e.g. `UPG-001`, `UPG-010`).
- **Detail design parity** — `documents-detail-design.json`, `dag.graph-seeds.json`, doc-extract for `docs/detail-design/features/` (`doc.dd.f-*`), `.ai-spector/index/detail-design.md`, `readiness-criteria.json`, `dd-context/` agent guides, `summary-detail-design` workflow step, and skill parity with basic design.
- **Comment resolve flow (git-backed F-05)** — `ai-spector comments inbox|plan|list|show|resolve` for IDE workflows: numbered inbox in chat, graph impact via `comments plan`, propose/apply doc edits, then update `meta_data.json` locally; Cursor **`/resolve-comments`** orchestrates the full flow.
- **`init` copies templates** — `npx ai-spector init` installs `.ai-spector/templates/` (SRS, basic design, detail design) and sets `paths.templates` in `docflow.config.json`. Cursor skill and generate commands require agents to read templates from that path (not `node_modules`).
- **Basic-design doc extract** — `ai-spector index` parses `docs/basic-design/api/*.md` and `docs/basic-design/screens/*.md` into `doc.bd.*` documents, section trees, and optional `tracesTo` from related features cited in detail files.
- **Tri-layer hubs and agent semantic merge** — `bundle.source` / `bundle.business` / `sourceFile` nodes (index + `graph ensure-bundles`); `derivedFrom` prefers `source.file:*` when the source hub exists; **`relatesTo`** edges via `graph merge --semantic` and `/link-graph`; **`graph report`** for layer health and suggested CLI/agent commands.
- **Data-source provenance** — `ai-spector index` and `ai-spector graph link-sources` add **`derivedFrom`** edges from domain nodes (`UC-*`, `F-*`, requirements, actors) to `docs/data-source/**` paths and optional `graphify:<nodeId>` targets when Graphify `graph.json` matches; evidence from `knowledge.json` source fields, SRS detail `Source:` / path mentions, and Graphify file index. Visualize shows teal **source** / **graphify** nodes and colored `derivedFrom` edges; `graph query` traverses `derivedFrom` and includes data-source paths in `projectionPaths`.
- **Detail-file graph enrichment** — `ai-spector index` doc semantics now fill UC/F **`title`** / **`description`** from detail markdown (`**Use Case Name:**`, `**Brief Description:**`, feature purpose), add **`title`** / **`description`** on per-file **section** nodes from headings and first prose snippet, link list chapters to detail docs via **`contains`**, and add **`describedIn`** from domain nodes to detail docs/sections. Merge applies documents before sections so instance section nodes are not skipped.

### Fixed

- **MCP template-import descriptor parity** — `task_create` / `task_list` JSON schemas expose `kind: import` and `workflow: template-import`; CI asserts tool registration parity. SDK exports `runTaskApproveImportPlan`, `runTaskApprovePackDesign`, and `installTemplateFromStaging` (`runTemplateInstall` alias). CLI fallbacks: `task approve-import-plan`, `task approve-pack-design`, `task create -k import -w template-import`. Skills forbid `node -e` deep core imports; `cli-failures.md` documents MCP → CLI → SDK fallback table. Reload MCP after upgrade (`UPG-030`) so Cursor refreshes cached tool descriptors.

- **Node 22 / Node 20.20+ CLI crash** — `ai-spector-graph@0.4.1` imports `default-impact.json` with `with { type: "json" }` (`ERR_IMPORT_ATTRIBUTE_MISSING`). **Publish `ai-spector-graph@0.4.1` before `ai-spector@0.6.0`.**
- **Screen-map doc paths** — `screenDoc` is the full primary-language repo path; new `screenDocPath` is the language-neutral logical path (e.g. `basic-design/screens/login.md`); `screenDocs` has distinct full paths per language (`docs/basic-design/en/...`, `docs/basic-design/vi/...`).
- **`setup --check`** — reports missing `prototype/screen-map.json` when `manifest.json` exists.
- **Missing screen design docs** — `prototype manifest` warns when a screen doc file is missing and suggests the Screen Index "Spec file" column.

- **DOC-SECTION-COVERAGE for basic-design list chapters** — `documents-basic-design.json` registers list chapters at bootstrap/index; **doc-extract** now parses `.ai-spector/templates/basic_design/` and emits `contains` → `section` edges for `doc.bd.list-api`, `doc.bd.list-screen`, and `doc.bd.db-design` during `index` (fixes validate failure when an older global CLI omitted basic-design from the registry).
- **Basic-design doc extract** — emit list + template `document` nodes in the same patch before detail edges (one index pass); still skip edges only when an endpoint is genuinely missing (fallback).
- **DOC-SECTION-COVERAGE** — exempt `document` nodes with `outputPattern` (SRS/BD templates) and basic-design instance docs; sections live on generated instance files.
- **Provenance from knowledge** — `sourceRef` on staged knowledge rows (e.g. `requirement/…md`) is now honored when building **`derivedFrom`** edges during index.

- **Graphify index** — skip `graphify update` for empty or markdown-only doc sources (`docs/srs`, `docs/basic-design`) instead of failing with Graphify exit 1 (`No code files found`); `ai-spector index` continues. Code sources (`docs/data-source` with `.ts`/`.py`/etc.) still run as before.
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
