# /analyze

Analyze project sources and produce normalized knowledge artifacts for downstream document generation.

## Usage

- `/analyze`
  - Analyze default data source: `docs/data-source` (see `.ai-spector/.docflow/config/data-source.json`).
- `/analyze <path1> <path2> ...`
  - Analyze only provided files/folders (overrides default).

## Prerequisites

Load `workflow.dependencies.json` → step `analyze`. This is the **first** pipeline step; no prior commands required.

| Check | If fail → stop and tell user |
|-------|------------------------------|
| `docs/data-source/` exists | Create folder (see `docs/data-source/README.md`) |
| At least one input file (not only README/.gitkeep) | Add specs, notes, or exports to `docs/data-source/` |

**On success, suggest next:** `/generate-srs`

## Required Behavior

1. Load `.ai-spector/.docflow/config/data-source.json` and `.ai-spector/.docflow/config/analyze.graphify.json`.
2. Resolve and normalize input paths.
   - If no path is provided, use `defaultRoot` (`docs/data-source`).
   - Skip invalid paths with warnings.
   - Record resolved paths in `scope.json` → `sources`.
3. Build/update Graphify index through MCP (scope = resolved data-source paths only).
4. Query graph to extract canonical sections:
   - actors
   - useCases
   - features
   - functionalRequirements
   - nfrs
   - entities
   - interfaces
   - constraints
   - openQuestions
5. Use MCP text/semantic fallback when graph results are incomplete.
6. Persist artifacts:
   - `.ai-spector/.docflow/analysis/knowledge.json`
   - `.ai-spector/.docflow/analysis/gaps.json`
   - `.ai-spector/.docflow/analysis/scope.json`
7. Update `.ai-spector/.docflow/state.json` with `analysis.lastRunAt`, `analysis.dataSource`, and scope hash.

## Success Criteria

- Graphify contains current source scope.
- `knowledge.json` has all canonical keys.
- Missing information is explicit in `gaps.json`.
