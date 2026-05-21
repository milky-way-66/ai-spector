# /generate-srs

Generate SRS files incrementally in dependency order using templates, Graphify knowledge, and parallel subagents.

## Usage

- `/generate-srs`
  - Continue mode by default: scan existing files and generate only missing/incomplete nodes.
- `/generate-srs <file>`
  - Generate/repair one target file while validating prerequisites.

## Prerequisites (stop if not met)

Load `workflow.dependencies.json` → step `generate-srs`. **Do not generate** until all pass:

| Check | What's missing |
|-------|----------------|
| `state.json` → `analysis.lastRunAt` is set | `/analyze` never ran |
| `.ai-spector/.docflow/analysis/knowledge.json` exists | No analysis artifacts |
| `knowledge.json` has content in at least one of: `actors`, `useCases`, `features`, `functionalRequirements`, `entities`, `interfaces` | Analysis produced no usable knowledge |

**If blocked, reply:**

```markdown
## Cannot run /generate-srs

**What's missing**
- {list failed checks}

**Do this first**
1. Add or update input files in `docs/data-source/`
2. Run `/analyze`

**Recommended next**
- `/index-docs srs` (required before `/generate-basic-design` or `/generate-detail-design`)
```

After successful generation (any new or updated SRS file), tell the user to run `/index-docs srs` so `.ai-spector/index/srs.md` stays current.

Optionally warn (do not block) if `docs/data-source/` changed after `analysis.lastRunAt` → suggest re-run `/analyze`.

## Required Behavior

1. Load:
   - `.ai-spector/.docflow/config/data-source.json` → `docs/data-source` (default input)
   - `.ai-spector/.docflow/analysis/knowledge.json` (from `/analyze` on data source)
   - `.ai-spector/.docflow/config/dag.srs.json`
   - `.ai-spector/.docflow/config/completeness-rules.srs.json`
   - `.ai-spector/_templates/srs/*`
2. Read supplemental facts from `docs/data-source/**` when knowledge.json is incomplete.
3. Scan existing outputs under `docs/srs/` and classify each target node:
   - `good`
   - `missing_content`
   - `missing_file`
4. Skip `good` nodes by default.
5. Build generation queue by DAG wave order:
   - process only `missing_file` and `missing_content`
   - run independent nodes in parallel subagents
6. Merge and review each wave:
   - normalize IDs and terminology
   - validate links and cross references
   - preserve manual content when patching existing files
7. After each written file, sync file content back into Graphify.
8. Update run logs and state:
   - `.ai-spector/.docflow/logs/run-<timestamp>.md`
   - `.ai-spector/.docflow/state.json`

## Guardrails

- Never overwrite `good` files unless force mode is requested.
- Prerequisites block takes precedence — never skip the analyze gate silently.
