# /graph-impact

Scope regen after a change. **User runs this command;** agent runs `graph impact` ([_graph.md](./_graph.md), [_workflow.md](./_workflow.md)).

## Usage

- `/graph-impact <nodeId>`
- `/graph-impact <nodeId> --change content_change|delete|id_change|…`

## Prerequisites

- `ai-spector graph validate` passes

## Required Behavior

1. Run:

```bash
ai-spector graph impact <nodeId> --change <type> --json
```

Optional report file:

```bash
ai-spector graph impact <nodeId> --json -o .ai-spector/views/impact-<timestamp>.json
```

2. Parse JSON buckets: `regenerate`, `review`, `downstream`.
3. Present table to user with `projectionPath` per entry.
4. For each **regenerate** id, suggest `/generate-srs` or patch using:

```bash
ai-spector graph query <thatId> --json
```

**Do not** implement impact BFS in the agent.

## Guardrails

- No whole-repo regen outside CLI buckets.
