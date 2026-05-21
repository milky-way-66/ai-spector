# /generate-detail-design

Generate detail design documents incrementally from SRS + Graphify context with dependency-aware parallelism.

## Usage

- `/generate-detail-design`
  - Continue mode: scan existing files and fill missing/incomplete outputs only.
- `/generate-detail-design <file>`
  - Target a single detail-design file.

## Prerequisites (stop if not met)

Load `workflow.dependencies.json` → step `generate-detail-design`.

| Check | What's missing |
|-------|----------------|
| `analysis.lastRunAt` + `knowledge.json` with `features` or `functionalRequirements` | `/analyze` incomplete |
| `docs/srs/1-introduction.md` and `docs/srs/4-system-features.md` exist | `/generate-srs` minimum not met |
| `.ai-spector/index/srs.md` populated | Run `/index-docs srs` |
| `.ai-spector/index/basic-design.md` populated if `docs/basic-design/**/*.md` exists | Run `/index-docs basic-design` |

**If blocked, reply:**

```markdown
## Cannot run /generate-detail-design

**What's missing**
- {list failed checks}

**Do this first**
1. Run `/analyze`
2. Run `/generate-srs` (introduction + system features at minimum)
3. Run `/index-docs srs`
4. If basic design exists: run `/index-docs basic-design`

**Recommended next**
- `/generate-basic-design` if API/DB/screen basic design is still needed
```

## Using `.ai-spector/index/`

After prerequisites pass:

1. Read `.ai-spector/index/srs.md` — select SRS `location` paths to load.
2. If `docs/basic-design/` has outputs, read `.ai-spector/index/basic-design.md` and load only listed basic design paths.
3. Do not bulk-read `docs/srs/` or `docs/basic-design/` without the index.

## Required Behavior

1. Load:
   - `.ai-spector/.docflow/analysis/knowledge.json`
   - `.ai-spector/index/srs.md` (**required**)
   - `.ai-spector/index/basic-design.md` when basic design outputs exist
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
- Prerequisites block before any template work — same message format as other generate commands.
