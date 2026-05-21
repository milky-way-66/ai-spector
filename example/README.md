# Example project

Sample consumer layout for **ai-spector**. Use this folder to try the workflow without publishing the package.

## Quick start

From the **repository root**:

```bash
npm install
npm run build
npm run init:example    # copy scaffold → example/
npm run analyze         # section registry + graph bootstrap
npm run graph:validate
```

Then open **`example/`** as your **Cursor workspace root** (File → Open Folder → `example`).

## Inside Cursor

1. Add real input files under `docs/data-source/` (not only README).
2. Run **`/analyze`** (needs Graphify MCP) — merge UC/features into `traceability.graph.json`.
3. Run **`/validate-graph`** or:

   ```bash
   npx ai-spector graph validate
   ```

   (from `example/`, or `npx ai-spector -r . graph validate` from repo root).

4. Run **`/generate-srs`**.

   The agent should call:

   ```bash
   npx ai-spector graph query <seedId> --json
   ```

5. Optional: **`/index-docs srs`**, **`/generate-basic-design`**.

## Try graph CLI from repo root

```bash
# query context around §3.2 List Use Case
npx ai-spector -r example graph query sec.srs.3-use-cases.l3.3.32-list-use-case --depth 2 --json

# impact if that section changes
npx ai-spector -r example graph impact sec.srs.3-use-cases.l3.3.32-list-use-case --json
```

## Layout

```text
example/
  .cursor/commands/       # slash commands
  .cursor/skills/         # ai-spector skill
  .ai-spector/
    graph/                # traceability.graph.json (generated)
    registry/
    .docflow/             # knowledge, DAGs, state
  docs/
    data-source/          # your inputs
    srs/                  # generated (after /generate-srs)
```

## Templates

| Context | Path |
|---------|------|
| Developing in this monorepo | `../templates/` at repo root |
| After `npm install ai-spector` elsewhere | `node_modules/ai-spector/templates/` |

Commands reference `node_modules/ai-spector/templates/`; when developing from source, agents should use `../templates/` relative to `example/`.
