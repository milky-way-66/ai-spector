# /link-graph — semantic meaning edges (agent + CLI)

Add **meaning (agent)** edges (`relatesTo`) that CLI/index cannot infer. Do **not** edit `traceability.graph.json` by hand.

## Prerequisites

- `ai-spector index` completed (spec sections + `derivedFrom` when possible)
- Seed id (e.g. `UC-03`) or `--file` + heading

## Steps

1. **Query graph (CLI)**

   ```bash
   npx ai-spector graph query <SEED> --direction both --depth 3 --json
   npx ai-spector graph report --json
   ```

2. **Read sources** — Only open paths from `derivedFrom` / `sourceRef` on the seed; read matching `docs/data-source/**` excerpts and relevant SRS `###` sections.

3. **Write patch** — Save edges to:

   `.ai-spector/.docflow/extract/semantic-links.patch.json`

   Use the example format in `semantic-links.patch.example.json`. Rules:

   - **Edges only** by default (`nodes: []`)
   - Allowed type: `relatesTo` (optional `role`: `evidence`, `usesEntity`, …)
   - Use **existing** node ids from query output only
   - Do **not** create new `document` or `section` nodes

4. **Merge + validate (CLI)**

   ```bash
   npx ai-spector graph merge --semantic
   npx ai-spector graph validate
   ```

5. Show the user a short summary: edges added, seed, and whether `graph report` still lists domains needing links.

## Failures

See `.cursor/commands/_cli-failures.md`. If merge rejects an edge, fix the patch ids/types and re-run merge.
