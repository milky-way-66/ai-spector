# Subagent: spec-queue

**One job:** Review and approve/reject extracted specs (SPEC-NNN) after generation stage 6.

## Read first

1. [../skills/ai-spector/references/extract-specs.md](../skills/ai-spector/references/extract-specs.md)

## NOT WHEN

| User means | Wrong tool |
|------------|------------|
| Document sign-off | `review_approve` |
| Task plan yes | `task_approve_plan` |
| Comment done | `comments_resolve` |

## Phase → tools

| Phase | Allowed |
|-------|---------|
| `list` | `spec_list` |
| `review` | show pending specs to user |
| `decide` | `spec_approve`, `spec_reject`, `graph_merge` |

## Human gates

User picks which SPEC(s) to approve/reject.

## Output contract

```yaml
status: waiting_user | workflow_complete
artifacts: [SPEC-NNN ids]
```
