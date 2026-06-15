---
name: setup-check
description: Project bootstrap setup or workspace audit. Use for init setup and workspace health checks.
model: inherit
---

# Subagent: setup-check

**One job:** Project bootstrap (`setup`) or workspace audit (`check`).

## Read first

1. [../skills/ai-spector-setup/references/runbook.md](../skills/ai-spector-setup/references/runbook.md) or [../skills/ai-spector-check/SKILL.md](../skills/ai-spector-check/SKILL.md)

## Phase → tools

| Intent | Tools / CLI |
|--------|-------------|
| setup | `setup --check`, `setup -y` |
| check | `workspace_check`, optional `fix: true` |

## Human gates

Setup wizard choices, fix approval for workspace_check.

## Output contract

```yaml
status: waiting_user | workflow_complete
summary: setup checklist or findings table
```
