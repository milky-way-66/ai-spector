# Graph CLI (for agents)

**Users do not run these.** Slash commands invoke CLI. Workflow: [_workflow.md](./_workflow.md). **On failure:** [_cli-failures.md](./_cli-failures.md).

Run from project root: `npx ai-spector …` if needed.

## Every CLI invocation

1. Run the command; capture **exit code**, **stdout**, **stderr**.
2. If non-zero or `--json` is unparseable → **stop**; report per `_cli-failures.md`.
3. On success, use CLI output only — do not re-derive graph state in the agent.

## Commands

```bash
ai-spector analyze
ai-spector graphify update
ai-spector graph merge --from-knowledge
ai-spector graph validate
ai-spector graph visualize [--open]
ai-spector graph query <nodeId> --json
ai-spector graph impact <nodeId> --json
```

## `graph query`

```bash
ai-spector graph query <seedId> --direction both --depth 4 --json
ai-spector graph query <depDocId> --edges rendersTo,dependsOn,listedIn,satisfies --depth 2 --json
ai-spector graph impact <seedId> --change content_change --json
```

**Generate:** query **before** write; **`graph merge`** projection patch **after** each file (`rendersTo` + `dependsOn`). See `_generate-graph.md`.

Use `projectionPaths`, `nodes`, `edges` from JSON. **If command fails or JSON invalid:** stop — do not glob `docs/srs/**`.

**If success but empty domain nodes:** report to user; suggest `/analyze` — still no folder-wide SRS reads.

## `graph impact`

```bash
ai-spector graph impact <nodeId> --change content_change --json
```

If this fails, do not guess impact scope — show CLI output and fix.

## `graph merge`

Called from `/analyze`. On merge/validate failure, do not patch `traceability.graph.json` by hand at scale — fix `knowledge.json` or section ids and re-run merge.

## Narrow fallback (success only)

Only when **validate passed** and **query succeeded** but content is thin: read specific `docs/data-source/**` files. Never because CLI failed.
