# /generate-detail-design

Generate detail design documents incrementally from SRS + Graphify context with dependency-aware parallelism.

## Usage

- `/generate-detail-design`
  - Continue mode: scan existing files and fill missing/incomplete outputs only.
- `/generate-detail-design <file>`
  - Target a single detail-design file.

## Required Behavior

1. Load:
   - `.ai-spector/.docflow/analysis/knowledge.json`
   - `.ai-spector/index/srs.md` to select relevant SRS files (then read only those paths under `docs/srs/`)
   - `.ai-spector/.docflow/config/dag.detail-design.json`
   - `.ai-spector/.docflow/config/completeness-rules.detail-design.json`
   - `.ai-spector/_templates/detail_design/*`
2. Scan existing outputs under `docs/detail-design/` and classify:
   - `good`
   - `missing_content`
   - `missing_file`
3. Process DAG in waves:
   - generate or patch only `missing_content` and `missing_file`
   - run independent nodes in parallel subagents
4. Merge each wave:
   - verify consistency with SRS references
   - normalize architecture/security/performance references
5. Sync each generated/updated file into Graphify immediately.
6. Persist updated state and run log.

## Guardrails

- Do not overwrite `good` files unless force mode is requested.
- If required SRS dependencies are absent, stop and request `/generate-srs` first.
