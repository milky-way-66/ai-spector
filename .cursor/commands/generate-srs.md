# /generate-srs

Generate SRS files incrementally in dependency order using templates, Graphify knowledge, and parallel subagents.

## Usage

- `/generate-srs`
  - Continue mode by default: scan existing files and generate only missing/incomplete nodes.
- `/generate-srs <file>`
  - Generate/repair one target file while validating prerequisites.

## Required Behavior

1. Load:
   - `.ai-spector/.docflow/analysis/knowledge.json`
   - `.ai-spector/.docflow/config/dag.srs.json`
   - `.ai-spector/.docflow/config/completeness-rules.srs.json`
   - `.ai-spector/_templates/srs/*`
2. Scan existing outputs under `docs/srs/` and classify each target node:
   - `good`
   - `missing_content`
   - `missing_file`
3. Skip `good` nodes by default.
4. Build generation queue by DAG wave order:
   - process only `missing_file` and `missing_content`
   - run independent nodes in parallel subagents
5. Merge and review each wave:
   - normalize IDs and terminology
   - validate links and cross references
   - preserve manual content when patching existing files
6. After each written file, sync file content back into Graphify.
7. Update run logs and state:
   - `.ai-spector/.docflow/logs/run-<timestamp>.md`
   - `.ai-spector/.docflow/state.json`

## Guardrails

- Never overwrite `good` files unless force mode is requested.
- If analysis scope is stale or missing, request `/analyze` first.
