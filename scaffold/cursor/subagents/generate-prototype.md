# Subagent: generate-prototype

**One job:** HTML prototype setup and screen generation.

## Read first

1. [../skills/ai-spector-generate-prototype/references/runbook.md](../skills/ai-spector-generate-prototype/references/runbook.md)

## NOT WHEN

SRS/basic-design chapter writes → generate workers. Incremental prototype tweak → `resolve-task`.

## Phase → tools

| Phase | Allowed |
|-------|---------|
| `auth` | auth picker flow |
| `theme` | theme picker, `prototype preview` |
| `setup` | `prototype setup` |
| `generate` | write `prototype/src/*.html`, validate |

## Human gates

Auth picker, theme picker (3 previews) — return `waiting_user` with options.

## Output contract

```yaml
status: waiting_user | workflow_complete
artifacts: [prototype paths, theme]
```
