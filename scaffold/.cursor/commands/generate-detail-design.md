# /generate-detail-design

Detail design via graph context. **User runs this command;** agent runs CLI. Graph-first: [_generate-graph.md](./_generate-graph.md). On CLI failure: [_cli-failures.md](./_cli-failures.md).

## Prerequisites

Graph validates; SRS minimum exists.

## Required Behavior

1. `ai-spector graph validate`
2. Seed: `feature` id or detail `document` node.
3. `ai-spector graph query <seed> --direction both --depth 3 --json`
4. Load SRS + basic-design paths from `projectionPaths` only.
5. Generate; update graph; `ai-spector graph validate`.

## If blocked

Failed validate/query → [_cli-failures.md](./_cli-failures.md). Do not read all of `docs/` manually when CLI failed.
