# /validate-graph

Gate generation using the graph CLI.

## Usage

- `/validate-graph`

## Required Behavior

```bash
ai-spector graph validate
```

- Exit 0 → report OK; suggest `/generate-srs` if domain nodes exist.
- Non-zero → print errors; stop until fixed.

Optional: if graph has only section shells (no `useCase`/`feature`), tell user to run `/analyze` and merge domain nodes.

**Do not** duplicate validation logic in the agent — use CLI output only.
