# Workflow prerequisites (shared)

All generation commands **must** run prerequisite checks **before** any generation work. Load `.ai-spector/.docflow/config/workflow.dependencies.json` for the active step.

## When checks fail

1. **Stop immediately** — do not read templates, spawn subagents, or write outputs.
2. Reply to the user with this structure:

```markdown
## Cannot run {command}

**What's missing**
- {bullet per failed check}

**Do this first**
1. {ordered steps from onBlock.doFirst or inferred pipeline}

**Recommended next** (after prerequisites are met)
- {optionalNext from config or pipeline}

**Why**
One sentence explaining the dependency chain.
```

3. Do not attempt partial generation unless the user explicitly asks to force or skip checks.

## Check types (how to evaluate)

| type | Pass when |
|------|-----------|
| `pathExists` | Path exists on disk |
| `hasFiles` | At least `min` files matching `glob` under `path` (respect `ignore`) |
| `stateNotNull` | `state.json` field is non-null |
| `jsonAnyNonEmpty` | JSON file exists and at least one listed key has a non-empty array/object |
| `allPathsExist` | Every path in `paths` exists |
| `indexPopulated` | Index file exists, has no placeholder markers (`not yet run`, `No entries yet`), and contains at least one `## File:` entry |
| `indexPopulatedIfSourceHasFiles` | If `sourcePath` has files matching `sourceGlob`, then `indexPath` must pass `indexPopulated`; otherwise pass |

Index paths (from config `indexes`): `.ai-spector/index/srs.md`, `.ai-spector/index/basic-design.md`.

## Using the index during generation

When prerequisites pass and the step lists `usesIndex`:

1. Read the index file(s) first.
2. Decide which `location` paths are relevant for the current task.
3. Open only those files under `docs/srs/` or `docs/basic-design/` — do not glob-read the whole output tree unless the index is missing (then block per prerequisites).

## Warnings vs blocks

- **fail** / missing required check → **block** (stop).
- **warn** / `warnIfBelow` → continue but include **What's missing** as warnings and still suggest **Do this first**.

## Stale analysis (optional warn)

If files under `docs/data-source/` were modified after `state.json` → `analysis.lastRunAt`, warn:

> Data source may be newer than last analysis — consider re-running `/analyze` before generation.

Do not block on stale alone unless the user requires strict freshness.

## Stale index (warn)

If SRS or basic design files changed after `state.json` → `index.lastRunAt` (or hash in `index.entries` differs), warn:

> Document index may be outdated — run `/index-docs srs` or `/index-docs basic-design` before generation.

Block if the index is still a placeholder while output files exist.
