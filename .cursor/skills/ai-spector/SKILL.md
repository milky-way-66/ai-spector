---
name: ai-spector
description: "Incremental documentation workflow for analyze -> SRS -> detail design -> doc index using Graphify MCP, dependency DAGs, and parallel subagents."
---

# AI Spector Skill

Use this skill when the user requests document generation from project data and templates.

## Workflow

1. Run `/analyze` to build and query Graphify knowledge for current scope.
2. Run `/generate-srs` to produce SRS documents in DAG order.
3. Run `/index-docs` (or `/index-docs srs`) after SRS changes to refresh file summaries.
4. Run `/generate-detail-design` to produce detail design docs from SRS + Graphify context.
5. Run `/index-docs basic-design` after basic design outputs exist.

When selecting which SRS or basic design files to load, read `.ai-spector/index/srs.md` or `.ai-spector/index/basic-design.md` first instead of opening every file.

## Core Rules

- Always work incrementally.
- Scan outputs before generating and classify `good`, `missing_content`, `missing_file`.
- Skip `good` by default.
- Patch incomplete files rather than replacing valid sections.
- Generate independent nodes in parallel using subagents.
- Merge and normalize content in main agent after each wave.
- Sync generated files back into Graphify after each write.

## Inputs and Outputs

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

- One index block per source file; fields: `location`, `metadata`, `summary`.
- SRS metadata must include DAG `dependsOn` / `referencedBy` from `dag.srs.json`.
- Summaries reflect actual file content; mark `status: missing` when the path has no file yet.
- Refresh incrementally via content hash in `state.json` → `index.entries`.
