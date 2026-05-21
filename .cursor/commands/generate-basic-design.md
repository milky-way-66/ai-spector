# /generate-basic-design

Generate basic design documents from the default data source, Graphify knowledge, SRS outputs, and templates.

## Usage

- `/generate-basic-design`
  - Continue mode: scan `docs/basic-design/` and generate only missing/incomplete outputs.
- `/generate-basic-design <file>`
  - Generate or repair one target file.

## Prerequisites (stop if not met)

Load `workflow.dependencies.json` → step `generate-basic-design`.

| Check | What's missing |
|-------|----------------|
| `analysis.lastRunAt` set + populated `knowledge.json` | `/analyze` not done or empty |
| `docs/srs/1-introduction.md` exists | SRS introduction not generated |
| `docs/srs/4-system-features.md` exists | SRS feature list not generated |
| `.ai-spector/index/srs.md` populated (`## File:` entries, not placeholder) | Run `/index-docs srs` first |

**If blocked, reply:**

```markdown
## Cannot run /generate-basic-design

**What's missing**
- {list failed checks}

**Do this first**
1. Run `/analyze` (if not done)
2. Run `/generate-srs` until minimum SRS files exist
3. Run `/index-docs srs`

**Recommended next**
- `/index-docs basic-design` after basic design outputs exist
```

## Using `.ai-spector/index/srs.md`

After prerequisites pass:

1. Read `.ai-spector/index/srs.md` in full.
2. Pick relevant SRS `location` paths from index summaries/metadata (features, APIs, data, interfaces).
3. Open **only** those files under `docs/srs/` — do not list-read the entire `docs/srs/` tree.

## Required Behavior

1. Load:
   - `.ai-spector/.docflow/config/data-source.json` → default root `docs/data-source`
   - `.ai-spector/.docflow/analysis/knowledge.json` (from `/analyze` on data source)
   - `.ai-spector/index/srs.md` (**required** — file selection source)
   - `.ai-spector/.docflow/config/dag.basic-design.json`
   - `.ai-spector/.docflow/config/completeness-rules.basic-design.json`
   - `.ai-spector/_templates/basic_design/*`
2. Read supplemental context from `docs/data-source/**` when knowledge.json is incomplete.
3. Scan outputs under `docs/basic-design/` and classify each target:
   - `good`
   - `missing_content`
   - `missing_file`
4. Process DAG in waves; run independent nodes in parallel subagents.
5. Merge each wave; preserve manual edits when patching.
6. Sync each written file into Graphify.
7. Update `.ai-spector/.docflow/state.json` and run log.

## Guardrails

- Never overwrite `good` files unless force mode is requested.
- Stop with prerequisite message instead of generating from templates alone.
- Prefer SRS + data-source facts over template placeholders.
- Never skip the SRS index when selecting which SRS files to read.
