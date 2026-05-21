# /index-docs

Build or refresh searchable metadata and summaries for SRS and basic design documents. Use the index to select relevant files for downstream generation or Q&A.

## Usage

- `/index-docs`
  - Index all discovered files under both roots (incremental by default).
- `/index-docs srs`
  - Index only `docs/srs/**`.
- `/index-docs basic-design`
  - Index only `docs/basic-design/**`.
- `/index-docs <path>`
  - Index one file or directory under a supported root.
- `/index-docs --force`
  - Rebuild every entry even when source hash is unchanged.

## Required Behavior

1. Load `.ai-spector/.docflow/config/index.docs.json`.
2. Resolve scope from usage (both roots, single collection, or explicit path).
3. Discover targets:
   - SRS: glob `docs/srs/**/*.md` (skip templates).
   - Basic design: glob `docs/basic-design/**/*.md`.
   - For SRS, also load `.ai-spector/.docflow/config/dag.srs.json` to map `dagId`, `dependsOn`, and `referencedBy` (reverse of `dependsOn`).
4. For each target file, unless skipped by incremental rules:
   - Read file content (if missing on disk, still emit an entry with `status: missing`).
   - Extract **metadata**:
     - `location`: repo-relative path (e.g. `docs/srs/1-introduction.md`)
     - `status`: `present` | `missing`
     - `dagId` / `dependsOn` / `referencedBy` (SRS only, from DAG)
     - `linksTo`: internal markdown links to other repo paths
     - `topics`: top-level headings (`#`, `##`) as a short list
     - `relatedSrs` / `relatedFeatures` (basic design: SRS sections or feature IDs mentioned in content)
   - Write **summary**: 2–5 sentences describing what the document covers; use actual content when present, not template placeholders.
5. Write outputs (overwrite whole file per collection):
   - `.ai-spector/index/srs.md`
   - `.ai-spector/index/basic-design.md`
6. File layout — start each index with a title and `Last indexed:` ISO timestamp, then one block per source file:

```markdown
# SRS Document Index

Last indexed: 2026-05-21T12:00:00Z

## File: 1-introduction.md
- location: docs/srs/1-introduction.md
- metadata: dagId=srs.introduction; dependsOn=[]; referencedBy=[3-use-cases.md]; topics=[Introduction, Document Purpose, Project Scope]; linksTo=[]
- summary: Defines product purpose, audience, conventions, and project scope for the SRS.
```

Use the same field names for basic design (`metadata` is a single line of semicolon-separated key=value pairs for machine-friendly parsing).

7. Sort entries: SRS by DAG wave order then `features/` alphabetically; basic design by path.
8. Update `.ai-spector/.docflow/state.json` → `index.lastRunAt`, `index.entries` (map of path → content hash).
9. If a root has zero files, still write the index header and a short note that no documents were found.

## Incremental Rules

- Compare each file’s content hash to `state.json` → `index.entries[path]`.
- Skip re-summarizing unchanged files unless `--force`.
- Always rebuild the output markdown from the full entry set (merged cached + newly indexed).

## Parallelization

- Index independent files in parallel subagents (one file per subagent).
- Main agent merges entries, sorts, and writes the two index files.

## Guardrails

- Never index `.ai-spector/_templates/**` — only generated docs under `docs/srs` and `docs/basic-design`.
- Do not invent content for missing files; set `status: missing` and a one-line summary.
- Keep summaries factual; no placeholder text like `TODO` or `TBD` in summaries.

## Success Criteria

- Both index files exist and list every discovered path under each root.
- Each present file has location, metadata, and summary.
- SRS entries include DAG relationships where applicable.
