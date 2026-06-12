# Workspace check (stage 1 of every generate run)

Structural valid-check of the workspace. Same engine everywhere: the pre-commit
hook, CI, and the agent all call `runCheck`.

## How to run

| Surface | Call |
|---------|------|
| MCP (preferred) | `workspace_check({ fix?: boolean })` |
| CLI fallback | `npx ai-spector check [--fix] [--json]` |

`fix: true` repairs only `autoFixable` findings (creates missing directories);
everything else is reported with a remediation hint.

## Rules

| Rule | Severity | Checks |
|------|----------|--------|
| STRUCT-001 | error | Required dirs exist: `docs/data-source/`, `.ai-spector/.docflow/config/` |
| STRUCT-002 | error | `.ai-spector/docflow.config.json` present and parseable |
| STRUCT-003 | warning | Each configured language has its output folder (`docs/srs/{lang}/`) |
| CFG-001 | error | `languages[]` non-empty in the raw config |
| TMPL-001 | warning | `.ai-spector/templates/` exists |
| CTX-001 | warning | Context store dir exists; **stale clarifications** are surfaced (Q-ids listed) |
| GRAPH-001 | warning | `graph.json` parses (deep validation stays with `graph validate`) |

Severities are configurable per project in
`.ai-spector/.docflow/config/workspace.rules.json`.

## Agent behavior

1. Run the check at the start of every generate run (and on "check my workspace").
2. `ok: false` (unfixed errors) → **stop**. Show findings, offer `--fix` for
   autoFixable ones, guide the user through the rest. Do not proceed to clarify.
3. Warnings → show them, then continue. CTX-001 stale clarifications feed
   directly into the clarify stage: re-ask exactly those Q-ids
   ([clarify.md](./clarify.md)).
4. `check` validates structure/config only — chain `graph validate` when graph
   semantics matter.

The pre-commit hook runs the same check and blocks commits on error-severity
findings, so a workspace that generates cleanly also commits cleanly.
