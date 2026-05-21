# /index-docs

Build **searchable summaries** under `.ai-spector/index/`. This is a **secondary** aid — prefer **`graph_neighbors`** for generation context when the graph has domain nodes.

## Usage

- `/index-docs` | `/index-docs srs` | `/index-docs basic-design` | `/index-docs <path>` | `--force`

## Role vs graph

| Mechanism | Use for |
|-----------|---------|
| **`graph_neighbors`** | **Primary** — relevant sections, UC/F, projection paths |
| **Index** | Fallback when graph empty; quick human browse; optional metadata cache |

After indexing, optionally add **`references`** edges from index entries to `document` nodes (advanced `/sync-graph`).

## Prerequisites

Warn if no files to index; do not block. See `workflow.dependencies.json` warn steps.

## Required Behavior

1. Load `index.docs.json`; discover files under `docs/srs/` or `docs/basic-design/`.
2. For each file, if graph has matching `document` node by `output` path — include `graphNodeId` in metadata line.
3. Write summaries to `.ai-spector/index/srs.md` / `basic-design.md` (format unchanged).
4. Update `state.json` index hashes.

## Guardrails

- Index does **not** replace graph for `/generate-*` when graph is populated.
- Never index templates or `node_modules/ai-spector/templates/`.

## Success

- Index files updated; user informed that generate commands should still use graph first.
