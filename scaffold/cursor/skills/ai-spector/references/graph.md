# Graph CLI (for agents)

**Users do not run these.** Slash commands invoke CLI. Workflow: [_workflow.md](./_workflow.md). **On failure:** [cli-failures.md](./cli-failures.md).

Run from project root: always `npx ai-spector …` (see [project-conventions.md](./project-conventions.md)).

## Every CLI invocation

1. Run the command; capture **exit code**, **stdout**, **stderr**.
2. If non-zero or `--json` is unparseable → **pause**; report and offer fix / workaround / pause per `cli-failures.md`.
3. On success, use CLI output only — do not re-derive graph state in the agent.

## Commands

```bash
npx ai-spector analyze
npx ai-spector graph merge --from-knowledge
npx ai-spector graph validate
npx ai-spector graph visualize [--open]
npx ai-spector graph query <nodeId> --json
npx ai-spector graph impact <nodeId> --json
npx ai-spector graph impact --file <path> [--heading <text>] --json
npx ai-spector graph impact --git --json
```

## `graph query`

```bash
npx ai-spector graph query <seedId> --direction both --depth 4 --json
npx ai-spector graph query <depDocId> --edges rendersTo,dependsOn,listedIn,satisfies --depth 2 --json
npx ai-spector graph impact <seedId> --change content_change --json
```

**Generate:** query **before** write; **`graph merge`** projection patch **after** each file (`rendersTo` + `dependsOn`). See `generate-graph.md`.

Use `projectionPaths`, `nodes`, `edges` from JSON. **If command fails or JSON invalid:** stop — do not glob `docs/srs/**`.

**If success but empty domain nodes:** report to user; suggest `/analyze` — still no folder-wide SRS reads.

## `graph impact`

Resolve the seed in the agent (see `/impact`), then:

```bash
npx ai-spector graph impact <nodeId> --change content_change --json
```

Optional resolver flags (verify path/heading → id):

```bash
npx ai-spector graph impact --file docs/srs/3-use-cases.md --heading "3.2 List Use Case" --json
```

Current working tree (staged + unstaged vs `HEAD`, or unstaged + `--cached` before first commit):

```bash
npx ai-spector graph impact --git --change content_change --json
```

If this fails, do not guess impact scope — show CLI output and fix.

## `graph merge`

Called from `/analyze`. On merge/validate failure, do not patch `traceability.graph.json` by hand at scale — fix `knowledge.json` or section ids and re-run merge.

## Narrow fallback (success only)

Only when **validate passed** and **query succeeded** but content is thin: read specific `docs/data-source/**` files. Never because CLI failed.
