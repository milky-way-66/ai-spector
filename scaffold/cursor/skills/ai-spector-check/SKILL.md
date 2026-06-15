---
name: ai-spector-check
description: >-
  Validates the ai-spector workspace structure and config (required dirs, docflow.config.json,
  languages, templates, stale clarifications, graph parseability). Use for "check my workspace",
  "is the project set up correctly", "why did pre-commit block me", "stale clarifications".
  Do NOT use for graph semantic validation ("validate the graph" → ai-spector-graph).
---

# Workspace check
## Load at start
1. [../ai-spector/references/workspace-check.md](../ai-spector/references/workspace-check.md)

## Run

MCP `workspace_check({ fix?: boolean })` — fallback `npx ai-spector check [--fix] [--json]`.

1. Run without fix; show findings as a table (rule, severity, message, fix hint).
2. AutoFixable findings → offer to re-run with `fix: true`.
3. Remaining errors → guide the user through each `fix` hint; the pre-commit
   hook blocks commits while errors remain.
4. CTX-001 stale clarifications → offer to re-confirm them now
   ([../ai-spector/references/clarify.md](../ai-spector/references/clarify.md)).

## Boundaries

- Structure/config only. "validate the graph" → `ai-spector-graph`
  (`graph validate`); prototype checks → `prototype validate`.
- This check also runs automatically as stage 1 of every generate run.
