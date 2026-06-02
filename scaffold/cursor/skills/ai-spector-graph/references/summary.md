# Task: summary

Build **searchable summaries** under `.ai-spector/index/`. This is a **secondary** aid — prefer **`graph_neighbors`** for generation context when the graph has domain nodes.

**Not** the same as **`/index`** (`ai-spector index`), which rebuilds graph, knowledge merge, Graphify, and can also refresh doc indexes via CLI.

## Usage

- `/summary` | `/summary srs` | `/summary basic-design` | `/summary <path>` | `--force`

## Role vs graph

| Mechanism | Use for |
|-----------|---------|
| **`graph_neighbors`** | **Primary** — relevant sections, UC/F, projection paths |
| **Summary** | Fallback when graph empty; quick human browse; optional metadata cache |

After summarizing, optionally add **`references`** edges from index entries to `document` nodes (advanced `/sync-graph`).

## Prerequisites

Warn if no files to index; do not block. See `workflow.dependencies.json` warn steps.

## Required Behavior

1. Load `index.docs.json`; discover files under `docs/srs/` or `docs/basic-design/`.
2. For each file, if graph has matching `document` node by `output` path — include `graphNodeId` in metadata line.
3. Write summaries to `.ai-spector/index/srs.md` / `basic-design.md` (format unchanged).
4. Update `state.json` index hashes.

## Guardrails

- Summaries do **not** replace graph for `/generate-*` when graph is populated.
- Never summarize templates under `.ai-spector/templates/` (reference only during generation).

## Success

- Index files updated; user informed that generate commands should still use graph first.
