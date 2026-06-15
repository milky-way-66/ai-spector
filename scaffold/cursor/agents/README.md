# AI Spector agents

**Orchestrator-only routing** — parent reads [../rules/ai-spector-routing.mdc](../rules/ai-spector-routing.mdc) and spawns workers from `.cursor/agents/`. Workers must **not** read `_skill-router.md` or call `workflow_route`.

Each file here is a **Cursor project subagent** (YAML `name`, `description` frontmatter) and the **orchestrator workflow brief** (`readBrief`, phase gates, `askUser` contract).

## Catalog

| workflowId | Brief | Skill | Command |
|------------|-------|-------|---------|
| `doc-review` | [doc-review.md](./doc-review.md) | `ai-spector-review` | `/review` |
| `resolve-comments` | [resolve-comments.md](./resolve-comments.md) | `ai-spector-resolve-comments` | `/resolve-comments` |
| `generate-srs` | [generate-srs.md](./generate-srs.md) | `ai-spector-generate-srs` | `/generate-srs` |
| `generate-basic-design` | [generate-basic-design.md](./generate-basic-design.md) | `ai-spector-generate-basic-design` | `/generate-basic-design` |
| `generate-prototype` | [generate-prototype.md](./generate-prototype.md) | `ai-spector-generate-prototype` | `/generate-prototype` |
| `resolve-task` | [resolve-task.md](./resolve-task.md) | `ai-spector-resolve-task` | — |
| `task-router` | [task-router.md](./task-router.md) | `ai-spector-task` | — |
| `spec-queue` | [spec-queue.md](./spec-queue.md) | extract-specs ref | — |
| `graph-ops` | [graph-ops.md](./graph-ops.md) | `ai-spector-graph` | — |
| `search` | [search.md](./search.md) | `ai-spector-search` | — |
| `setup-check` | [setup-check.md](./setup-check.md) | `ai-spector-setup` / `ai-spector-check` | — |

## Spawn prompt (parent → worker)

Copy from `workflow_route` response `handoff`, or build manually:

```yaml
workflowId: doc-review
phase: queue                    # from ReviewSession or runbook
userGoal: "<original user request>"
userAnswer: "<if answering worker gate>"
resumeFromState: true           # when continuing after waiting_user
readBrief: .cursor/agents/doc-review.md
runInBackground: false          # required when HITL gates exist
```

Prefer **`Task({ subagent_type: "doc-review", resume: priorAgentId })`** when the worker just returned `waiting_user`. Or invoke explicitly: `/doc-review`.

## Worker output (worker → parent)

```yaml
status: waiting_user | phase_complete | workflow_complete | blocked
summary: "<user-facing>"
askUser:                        # when status === waiting_user
  question: "..."
  options: [{ id, label }]
suggestedNext:
  workflowId: task-router       # optional handoff
```

Parent shows `askUser` in main chat. User reply → resume same `workflowId` (do not re-route unless topic switch).

**Observability:** `workflow_status({})` → `statusLine` (see [ACTIVE-WORKER.md](../ACTIVE-WORKER.md)).

Design: [../../../docs/plan/subagent-routing-design.md](../../../docs/plan/subagent-routing-design.md)
