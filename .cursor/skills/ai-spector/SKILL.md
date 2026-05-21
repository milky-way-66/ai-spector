---
name: ai-spector
description: "Incremental documentation workflow for analyze -> SRS -> detail design -> doc index using Graphify MCP, dependency DAGs, and parallel subagents."
---

# AI Spector Skill

Use this skill when the user requests document generation from project data and templates.

## Workflow

1. Place input materials in `docs/data-source/` (default for analyze and generation).
2. Run `/analyze` to index and extract knowledge from the data source.
3. Run `/generate-srs` to produce SRS documents in DAG order.
4. Run `/index-docs` (or `/index-docs srs`) after SRS changes to refresh file summaries.
5. Run `/generate-basic-design` for API, DB, and screen basic design outputs.
6. Run `/generate-detail-design` to produce detail design docs from SRS + Graphify context.
7. Run `/index-docs basic-design` after basic design outputs exist.

## Document index (`.ai-spector/index/`)

| Index file | Built by | Consumed by |
|------------|----------|-------------|
| `srs.md` | `/index-docs srs` | `/generate-basic-design`, `/generate-detail-design` |
| `basic-design.md` | `/index-docs basic-design` | `/generate-detail-design` (when basic design exists) |

**Rules**

- Read the index **before** opening files under `docs/srs/` or `docs/basic-design/`.
- Load only `location` paths from index entries that describe present content (not placeholder / missing).
- If index is placeholder (`not yet run`, `No entries yet`) while output docs exist → **block** and tell user to run `/index-docs`.
- After `/generate-srs` or `/generate-basic-design` completes, run the matching `/index-docs` so downstream steps have a fresh index.

Config: `workflow.dependencies.json` → `indexes`, `indexUsage`.

## Prerequisites (mandatory)

Before any generate command, load `.ai-spector/.docflow/config/workflow.dependencies.json` and evaluate the matching step. **If a required check fails, stop immediately** and tell the user:

- **What's missing** — concrete failed checks
- **Do this first** — ordered commands (from config `onBlock.doFirst` or pipeline)
- **Recommended next** — after prerequisites pass
- **Why** — one-line dependency explanation

Never start template filling or subagents when prerequisites fail.

| Command | Requires (minimum) |
|---------|----------------------|
| `/analyze` | `docs/data-source/` with at least one input file |
| `/generate-srs` | `/analyze` completed with populated `knowledge.json` |
| `/index-docs srs` | (warn only) SRS files under `docs/srs/` |
| `/generate-basic-design` | `/analyze` + minimum SRS + **populated** `.ai-spector/index/srs.md` |
| `/index-docs basic-design` | (warn only) files under `docs/basic-design/` |
| `/generate-detail-design` | `/analyze` + minimum SRS + **populated** `srs.md`; `basic-design.md` if `docs/basic-design/` has files |

Pipeline order: `analyze` → `generate-srs` → `index-docs srs` → `generate-basic-design` → `index-docs basic-design` → `generate-detail-design`

Message format reference: `.cursor/commands/_prerequisites.md`

## Core Rules

- Always work incrementally.
- Scan outputs before generating and classify `good`, `missing_content`, `missing_file`.
- Skip `good` by default.
- Patch incomplete files rather than replacing valid sections.
- Generate independent nodes in parallel using subagents.
- Merge and normalize content in main agent after each wave.
- Sync generated files back into Graphify after each write.
- Run prerequisite checks before every command; on failure, only output guidance (no partial work).

## Data Source

- Default input root: `docs/data-source/` (config: `.ai-spector/.docflow/config/data-source.json`).
- `/analyze` without paths indexes only the data source (not the whole repo).
- `/generate-srs` and `/generate-basic-design` consume `knowledge.json` from that analysis; fall back to reading files under `docs/data-source/` when needed.

## Inputs and Outputs

- Data source: `docs/data-source/*`
- Templates: `.ai-spector/_templates/*`
- Analysis artifacts: `.ai-spector/.docflow/analysis/*`
- Runtime state: `.ai-spector/.docflow/state.json`
- Document indexes (from `/index-docs`):
  - `.ai-spector/index/srs.md`
  - `.ai-spector/index/basic-design.md`
- Outputs:
  - `docs/srs/*`
  - `docs/basic-design/*`
  - `docs/detail-design/*`

## Index Docs Rules

- Outputs live only under `.ai-spector/index/` (`srs.md`, `basic-design.md`).
- One index block per source file; fields: `location`, `metadata`, `summary`.
- SRS metadata must include DAG `dependsOn` / `referencedBy` from `dag.srs.json`.
- Summaries reflect actual file content; mark `status: missing` when the path has no file yet.
- Refresh incrementally via content hash in `state.json` → `index.entries`.
