# /generate-detail-design

Detail design via **`ai-spector graph query`**. See [_graph.md](./_graph.md).

## Prerequisites

Graph validates; SRS minimum exists.

## Required Behavior

1. `ai-spector graph validate`
2. Seed: `feature` id or detail `document` node.
3. `ai-spector graph query <seed> --direction both --depth 3 --json`
4. Load SRS + basic-design paths from `projectionPaths` only.
5. Generate; update graph; `ai-spector graph validate`.
