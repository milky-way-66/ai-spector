# /analyze

Analyze project sources and produce normalized knowledge artifacts for downstream document generation.

## Usage

- `/analyze`
  - Analyze current workspace folder.
- `/analyze <path1> <path2> ...`
  - Analyze only provided files/folders.

## Required Behavior

1. Resolve and normalize input paths.
   - If no path is provided, use workspace root as source.
   - Skip invalid paths with warnings.
2. Build/update Graphify index through MCP.
3. Query graph to extract canonical sections:
   - actors
   - useCases
   - features
   - functionalRequirements
   - nfrs
   - entities
   - interfaces
   - constraints
   - openQuestions
4. Use MCP text/semantic fallback when graph results are incomplete.
5. Persist artifacts:
   - `.ai-spector/.docflow/analysis/knowledge.json`
   - `.ai-spector/.docflow/analysis/gaps.json`
   - `.ai-spector/.docflow/analysis/scope.json`
6. Update `.ai-spector/.docflow/state.json` with analysis timestamp and scope hash.

## Success Criteria

- Graphify contains current source scope.
- `knowledge.json` has all canonical keys.
- Missing information is explicit in `gaps.json`.
