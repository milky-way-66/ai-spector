---
name: ai-spector-check
description: >-
  Validates workspace structure/config OR manages the clarification context store.
  Workspace: "check my workspace", "why did pre-commit block me". Clarifications:
  "open questions", "stale clarifications", "what did I answer about auth".
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

| Intent | Route |
|--------|-------|
| Structure, config, pre-commit hook | This skill → `workspace_check` |
| Open questions, stale Q-ids, past answers | This skill → `context_list` / `context_resolve` ([context-store.md](../ai-spector/references/context-store.md)) |
| Graph semantic health | `ai-spector-graph` (`graph_validate`) |
| Prototype manifest | `prototype validate` |

- Structure/config check also runs as stage 1 of every generate run.
