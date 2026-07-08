# External Adapters — Docops Integration Guide

## Principles

Writer and local tools integrate through **files in git** — not direct API calls between them.

| Rule | Detail |
|------|--------|
| File bus | All state lives in `.docops/`, `docs/`, and optional `.ai-spector/` |
| Branch-scoped | Contract files on branch X apply when users view branch X |
| No Writer API | Adapters read/write the repo filesystem or git remote — not Writer REST |
| Lenient validation | Unknown JSON keys are ignored; missing optional files hide features |

## Concurrency

Comment threads and review registry use read-modify-write:

1. Read current file (and git SHA when available)
2. Apply change
3. Commit; retry on conflict

Do not silently overwrite concurrent edits.

## When to disable Writer UI

Set `capabilities.<module>: false` in `docops.config.json` when your adapter owns that workflow entirely. Writer hides the feature without error.

`capabilities.graph` and `capabilities.generate` affect **Writer cloud UI only**. The local ai-spector engine (MCP and CLI) always owns index, graph, and generate work sessions regardless of those flags.

## Schema reference

Full schemas and examples: bundled in the ai-spector package at `contracts/schemas/` and `contracts/examples/`, or `.docops/guide/schemas/` in this project after init.
