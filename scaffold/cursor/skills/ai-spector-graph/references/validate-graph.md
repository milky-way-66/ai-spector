# Task: validate-graph

Gate before generation. **User runs this command;** agent runs the CLI.

## Usage

- `/validate-graph`

## Required Behavior

**MCP (preferred when ai-spector server is configured):**

```
graph_validate({})
```

**CLI fallback:**

```bash
npx ai-spector graph validate
```

- **Success / exit 0** → tell the user OK; if domain nodes exist, suggest `/generate-srs`; if only section shells, explain they need `/analyze` first.
- **Failure / non-zero** → **stop**. Use [cli-failures.md](../../ai-spector/references/cli-failures.md): paste every `[ERROR]` line, explain each, give fix steps (usually re-run `/analyze` or fix one node then re-validate).

**Do not:** guess validation in the agent, hand-fix the whole graph without showing the user, or proceed to `/generate-srs`.

## If blocked

Follow [cli-failures.md](../../ai-spector/references/cli-failures.md). Typical fixes:

- `DOMAIN-ANCHORED` → domain node missing `listedIn` / `describedIn` → re-run `/analyze` or fix one node and `graph merge` again.
- `SECTION-TREE` → structure edge wrong → re-run `npx ai-spector analyze` (agent), not manual graph surgery at scale.
- `REGISTRY-COMPLETE` → re-run `/analyze` step 0 (`npx ai-spector analyze`).

After fix, user re-runs **`/validate-graph`**.
