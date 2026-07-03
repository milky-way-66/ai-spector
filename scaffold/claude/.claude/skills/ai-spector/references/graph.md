# Graph CLI (for agents)

**Users do not run these.** Slash commands invoke CLI. **On failure:** [cli-failures.md](./cli-failures.md).
**Full command reference (all commands + options + examples):** [cli-reference.md](./cli-reference.md).

Run from project root: always `npx ai-spector …` (see [project-conventions.md](./project-conventions.md)).

## Every CLI invocation

1. Run the command; capture **exit code**, **stdout**, **stderr**.
2. If non-zero or `--json` is unparseable → **pause**; report and offer fix / workaround / pause per `cli-failures.md`.
3. On success, use CLI output only — do not re-derive graph state in the agent.

## Commands (quick)

```bash
npx ai-spector index
npx ai-spector graph merge --from-knowledge
npx ai-spector graph validate
npx ai-spector graph visualize [--open]
npx ai-spector graph query <nodeId> --json
npx ai-spector graph impact <nodeId> --json
npx ai-spector graph impact --file <path> [--heading <text>] --json
npx ai-spector graph impact --git --json
npx ai-spector index
npx ai-spector lang add <code>     # add a language (e.g. jp, vi)
```

## `graph query`

```bash
npx ai-spector graph query <seedId> --direction both --depth 4 --json
npx ai-spector graph query <depDocId> --edges rendersTo,dependsOn,listedIn,satisfies --depth 2 --json
```

**Generate:** query **before** write; **`graph merge`** projection patch **after** each file (`rendersTo` + `dependsOn`). See [generate-graph.md](./generate-graph.md).

Use `projectionPaths`, `nodes`, `edges` from JSON. **If command fails or JSON invalid:** stop — do not glob `docs/**`.

**If success but empty domain nodes:** report to user; suggest `/analyze` — still no folder-wide reads.

## `graph impact`

```bash
npx ai-spector graph impact <nodeId> --json
npx ai-spector graph impact --file docs/srs/en/03-use-cases.md --heading "3.2 List Use Case" --json
npx ai-spector graph impact --git --json
```

MCP accepts `change`; CLI always uses `content_change` (no `--change` flag).

Note: doc file paths now always include a language subfolder: `docs/srs/{lang.code}/{filename}`.

The JSON output includes a `staleTranslations` array when secondary-language documents are affected. Those nodes need **re-translation from the primary file**, not re-generation from the graph.

If impact fails, do not guess scope — show CLI output and fix.

## `graph merge`

Called from `/analyze`. On merge/validate failure, do not patch `traceability.graph.json` by hand — fix `knowledge.json` or section ids and re-run merge.

## Narrow fallback (success only)

Only when **validate passed** and **query succeeded** but content is thin: read specific `docs/data-source/**` files. Never because CLI failed.
