# Example project

Sample layout for **ai-spector**. Open this folder as your **Cursor workspace** (not the repo root).

## Setup (once)

From the **repository root**:

```bash
npm install
npm run build
npm run init:example
```

That copies scaffold files into `example/`. You do **not** need to run `analyze` or `graph merge` in the terminal for normal use — use Cursor slash commands in `example/`.

## In Cursor

1. Add files under `docs/data-source/`.
2. **`/analyze`** — agent runs `ai-spector analyze`, Graphify, merge, validate.
3. **`/visualize-graph`** (optional) — browser report.
4. **`/validate-graph`**
5. **`/generate-srs`**
6. Optional: **`/summary srs`**, **`/generate-basic-design`**

See `.cursor/commands/_workflow.md`.

## Layout

```text
example/
  .cursor/commands/
  .ai-spector/graph/
  docs/data-source/
  docs/srs/              # after /generate-srs
```

## Developing the package

Templates in this monorepo: `../templates/` (not `node_modules/`). Agents in `example/` should use that path when `node_modules/ai-spector` is absent.

From repo root, maintainers may run:

```bash
npm run analyze -r example
npm run graph:merge
npm run graph:validate
```

End users should still prefer **`/analyze`** in Cursor.
