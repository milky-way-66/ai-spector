# /visualize-graph

Open an HTML report of the traceability graph and `knowledge.json`.

## Usage

- `/visualize-graph`

## Required Behavior

```bash
ai-spector graph visualize --open
```

Agent runs from project root. Default: `.ai-spector/views/graph-knowledge.html`

## If blocked

Use [_cli-failures.md](./_cli-failures.md). Common fixes:

- Missing graph → run **`/analyze`** first (step 0 `ai-spector analyze`).
- `command not found` → `npm install ai-spector`; use `npx ai-spector graph visualize --open`.

Do not tell the user to inspect raw JSON instead of fixing the CLI — offer to fix cwd/install, then re-run **`/visualize-graph`**.
