# AI Spector

Cursor-driven documentation workflow for turning project inputs into structured **SRS**, **basic design**, and **detail design** documents. Uses Graphify for analysis, dependency DAGs for generation order, and searchable indexes under `.ai-spector/index/` to pick relevant files without reading every doc.

## Quick start

1. Add input materials to [`docs/data-source/`](docs/data-source/README.md) (specs, notes, API exports, diagrams, legacy docs).
2. In Cursor, run commands in order:

```text
/analyze
/generate-srs
/index-docs srs
/generate-basic-design
/index-docs basic-design
/generate-detail-design
```

3. Generated docs appear under `docs/srs/`, `docs/basic-design/`, and `docs/detail-design/`.

If a step’s prerequisites are not met, the agent **stops** and tells you what is missing and what to run next.

## Folder layout

```text
ai-spector/
├── README.md                 # This file
├── .cursor/
│   ├── commands/             # Cursor slash commands
│   └── skills/ai-spector/    # Agent skill (workflow rules)
├── .ai-spector/
│   ├── _templates/           # SRS, basic design, detail design templates
│   ├── index/                # Searchable summaries (srs.md, basic-design.md)
│   └── .docflow/
│       ├── analysis/         # knowledge.json, gaps.json, scope.json
│       ├── config/           # DAGs, prerequisites, Graphify settings
│       └── state.json        # Run state and index hashes
└── docs/
    ├── data-source/          # Default input (you add files here)
    ├── srs/                  # Generated SRS
    ├── basic-design/         # Generated basic design
    └── detail-design/        # Generated detail design
```

| Path | Purpose |
|------|---------|
| `docs/data-source/` | **Input** — materials analyzed before generation |
| `docs/srs/` | **Output** — Software Requirements Specification |
| `docs/basic-design/` | **Output** — API, DB, screen basic design |
| `docs/detail-design/` | **Output** — Feature-level detail design |
| `.ai-spector/_templates/` | Templates used by generate commands (do not edit outputs here) |
| `.ai-spector/index/` | Metadata + summaries for file selection ([details](.ai-spector/index/README.md)) |
| `.ai-spector/.docflow/` | Analysis artifacts, DAG config, runtime state |

## Commands

| Command | Description |
|---------|-------------|
| [`/analyze`](.cursor/commands/analyze.md) | Index `docs/data-source/` and build `knowledge.json` via Graphify |
| [`/generate-srs`](.cursor/commands/generate-srs.md) | Generate SRS under `docs/srs/` (DAG order, incremental) |
| [`/index-docs`](.cursor/commands/index-docs.md) | Build `.ai-spector/index/srs.md` and/or `basic-design.md` |
| [`/generate-basic-design`](.cursor/commands/generate-basic-design.md) | Generate basic design under `docs/basic-design/` |
| [`/generate-detail-design`](.cursor/commands/generate-detail-design.md) | Generate detail design under `docs/detail-design/` |

Examples:

```text
/index-docs srs
/index-docs basic-design
/generate-srs 1-introduction.md
```

## Pipeline and prerequisites

Commands enforce a dependency chain (see [`workflow.dependencies.json`](.ai-spector/.docflow/config/workflow.dependencies.json)):

```text
docs/data-source
    → /analyze
    → /generate-srs
    → /index-docs srs          ← required before basic/detail design
    → /generate-basic-design
    → /index-docs basic-design ← required before detail design (if basic design exists)
    → /generate-detail-design
```

| Step | Minimum required before run |
|------|----------------------------|
| `/analyze` | At least one file in `docs/data-source/` (not only README) |
| `/generate-srs` | Completed `/analyze` with populated `knowledge.json` |
| `/generate-basic-design` | Analyze + SRS (`1-introduction.md`, `4-system-features.md`) + populated `.ai-spector/index/srs.md` |
| `/generate-detail-design` | Analyze + minimum SRS + populated `srs.md`; `basic-design.md` if `docs/basic-design/` has files |

On failure, the agent responds with **What's missing**, **Do this first**, and **Recommended next** (see [`.cursor/commands/_prerequisites.md`](.cursor/commands/_prerequisites.md)).

## Document index (`.ai-spector/index/`)

Indexes are **required** for downstream generation—not optional shortcuts.

1. `/index-docs` writes summaries and metadata per file.
2. `/generate-basic-design` and `/generate-detail-design` read the index first and open only relevant `location` paths under `docs/srs/` or `docs/basic-design/`.

Refresh indexes after you change generated docs:

```text
/index-docs srs
/index-docs basic-design
```

## Configuration

| File | Role |
|------|------|
| [`data-source.json`](.ai-spector/.docflow/config/data-source.json) | Default input root (`docs/data-source`) |
| [`analyze.graphify.json`](.ai-spector/.docflow/config/analyze.graphify.json) | Graphify index scope and query profiles |
| [`dag.srs.json`](.ai-spector/.docflow/config/dag.srs.json) | SRS generation order and outputs |
| [`dag.basic-design.json`](.ai-spector/.docflow/config/dag.basic-design.json) | Basic design generation order |
| [`dag.detail-design.json`](.ai-spector/.docflow/config/dag.detail-design.json) | Detail design generation order |
| [`workflow.dependencies.json`](.ai-spector/.docflow/config/workflow.dependencies.json) | Prerequisite checks and index paths |
| [`index.docs.json`](.ai-spector/.docflow/config/index.docs.json) | Index output paths and format |

## Cursor setup

- **Skill:** `.cursor/skills/ai-spector/SKILL.md` — loaded when working on documentation in this repo.
- **Commands:** `.cursor/commands/*.md` — available as slash commands in Cursor.

Enable the **ai-spector** skill and Graphify MCP in your Cursor project settings as needed for `/analyze`.

## Design principles

- **Incremental** — classify outputs as `good` / `missing_content` / `missing_file`; skip or patch instead of full rewrite.
- **DAG-ordered** — independent sections generate in parallel; dependencies run in waves.
- **Fail fast** — missing prerequisites block work with clear next steps.
- **Index-first** — use `.ai-spector/index/` to select files, not bulk reads of `docs/srs/` or `docs/basic-design/`.

## Related READMEs

- [Data source inputs](docs/data-source/README.md)
- [Document indexes](.ai-spector/index/README.md)
