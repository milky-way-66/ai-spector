# ai-spector — Developer Guide for Claude

This is the **ai-spector source repo**. You are working on the tool itself,
not on a project that uses it.

Full architecture reference: [ARCHITECTURE.md](ARCHITECTURE.md)

---

## Commands

```bash
npm run build          # tsc
npm test               # vitest run (all tests in tests/ + packages/graph/tests/)
npm run test:watch     # vitest in watch mode
```

One pre-existing failure in `tests/commands/init.test.ts` is known — do not
treat it as a regression.

---

## Source Layout

```
src/
  cli.ts                  # CLI entry — Commander.js wiring only
  sdk.ts                  # SDK entry — re-exports interfaces/sdk/index.ts
  types.ts                # shared domain types

  core/                   # pure domain — no console.log allowed here
    operations/           # high-level run* functions (one per CLI command)
    graph/                # graph load, query, merge, impact, audit
    comments/             # comment thread storage + inbox
    config/               # docflow config load + types
    util/                 # fs, git-diff, paths, prompt helpers
    lang/                 # translation queue
    index/                # document indexing
    markdown/             # remark-based markdown AST
    registry/             # section registry
    visualize/            # HTML graph output
    prototype/            # prototype manifest + preview
    template/             # template scan + validate

  interfaces/
    cli/format/           # structured result → human-readable string
    mcp/                  # MCP server + Zod schemas + tool handlers
    sdk/                  # SDK re-exports


tests/                    # mirrors src/ layout
```

---

## Architecture Rules

### 1. No console.log in src/core/

`src/core/` functions must accept typed inputs and return typed outputs only.
They must never write to stdout or stderr — that breaks MCP tool handlers and
SDK callers.

Formatting goes in `src/interfaces/cli/format/`. The CLI handler pattern is:

```ts
const result = await runFoo(opts);
if (opts.json) console.log(JSON.stringify(result, null, 2));
else console.log(formatFoo(result));
```

### 2. Return typed results from run* functions

Every `run*` function in `src/core/operations/` must return a typed interface,
not `void`. Define the result interface in the same file and export it.

```ts
export interface FooResult { ... }
export async function runFoo(opts: FooOptions): Promise<FooResult> { ... }
```

### 3. Do not touch src/interfaces/ when changing core logic

Interface adapters (CLI formatter, MCP tool handler, SDK re-export) are
separate concerns. Changing a `run*` function's return shape requires updating:
- The formatter in `src/interfaces/cli/format/`
- The MCP tool handler in `src/interfaces/mcp/tools/`
- The SDK re-export if the type is part of the public API

### 4. Do not add IO to packages/graph/

`packages/graph/` is a pure domain package — types and algorithms only.
No `fs`, no `console.log`, no `process`. Keep it dependency-free from Node
built-ins.

### 5. Import paths use .js extensions

This is an ESM project (`"type": "module"`). All local imports must end in
`.js` even though the source files are `.ts`:

```ts
import { foo } from "./foo.js";       // correct
import { foo } from "./foo";           // wrong — will fail at runtime
```

### 6. Depth-sensitive import.meta.url paths

`src/core/config/load.ts` computes the package root with:

```ts
resolve(dirname(fileURLToPath(import.meta.url)), "../../..")
```

The depth is `../../..` because `dist/core/config/load.js` is three levels
below the package root. If you move config/load.ts, update this depth.

Similarly, `src/core/operations/setup.ts` requires `../../../package.json`.

---

## Adding a New Command

1. **Core operation** — create `src/core/operations/<cmd>.ts`:
   - Define `<Cmd>Options` and `<Cmd>Result` interfaces
   - Export `async function run<Cmd>(opts): Promise<<Cmd>Result>`
   - No console.log

2. **CLI formatter** — add `format<Cmd>` to the appropriate file in
   `src/interfaces/cli/format/`

3. **CLI handler** — wire in `src/cli.ts`:
   ```ts
   .command("cmd").action(async (opts) => {
     const result = await runCmd(opts);
     if (opts.json) console.log(JSON.stringify(result, null, 2));
     else console.log(formatCmd(result));
   });
   ```

4. **MCP tool** (optional) — add a tool handler in
   `src/interfaces/mcp/tools/`, add a Zod schema to
   `src/interfaces/mcp/schemas.ts`, and register it in
   `src/interfaces/mcp/server.ts`

5. **SDK export** (optional) — add re-export to
   `src/interfaces/sdk/index.ts`

6. **Tests** — add `tests/<domain>/<cmd>.test.ts`

---

## MCP Server

```bash
node dist/interfaces/mcp/server.js   # run directly
# or via bin:
npx ai-spector-mcp
```

Test with jsonrpc:
```bash
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}' \
  | node dist/interfaces/mcp/server.js
```

Tools are defined in `src/interfaces/mcp/tools/`. Schemas are Zod objects in
`src/interfaces/mcp/schemas.ts` — pass `.shape` to `server.tool()`.

---

## SDK

```ts
import { querySubgraph, runIndex, runCommentsList } from 'ai-spector';
import type { GraphQueryResult, IndexReport } from 'ai-spector';
```

Package subpath exports: `.` → SDK, `./mcp` → MCP server, `./cli` → CLI.

---

## Graph module

Graph algorithms live in `src/core/graph/`. Public API: `src/core/graph/index.ts`.
Published as `ai-spector/graph` subpath export for browser consumers.

---

## Key Files

| File | Purpose |
|------|---------|
| `src/cli.ts` | CLI entry — all Commander.js wiring |
| `src/sdk.ts` | SDK entry — single re-export line |
| `src/types.ts` | Shared types: `TraceabilityGraph`, `GraphNode`, `GraphEdge`, etc. |
| `src/core/config/load.ts` | `packageBundleRoot()`, `scaffoldBundleRoot()`, config loading |
| `src/interfaces/mcp/server.ts` | MCP server registration + startup |
| `src/interfaces/mcp/schemas.ts` | Zod schemas for all MCP tool inputs |
| `src/core/graph/index.ts` | Graph public API (`ai-spector/graph` export) |

<!-- gitnexus:start -->
# GitNexus — Code Intelligence

This project is indexed by GitNexus as **ai-spector** (7511 symbols, 10518 relationships, 300 execution flows). Use the GitNexus MCP tools to understand code, assess impact, and navigate safely.

> If any GitNexus tool warns the index is stale, run `npx gitnexus analyze` in terminal first.

## Always Do

- **MUST run impact analysis before editing any symbol.** Before modifying a function, class, or method, run `gitnexus_impact({target: "symbolName", direction: "upstream"})` and report the blast radius (direct callers, affected processes, risk level) to the user.
- **MUST run `gitnexus_detect_changes()` before committing** to verify your changes only affect expected symbols and execution flows.
- **MUST warn the user** if impact analysis returns HIGH or CRITICAL risk before proceeding with edits.
- When exploring unfamiliar code, use `gitnexus_query({query: "concept"})` to find execution flows instead of grepping. It returns process-grouped results ranked by relevance.
- When you need full context on a specific symbol — callers, callees, which execution flows it participates in — use `gitnexus_context({name: "symbolName"})`.

## Never Do

- NEVER edit a function, class, or method without first running `gitnexus_impact` on it.
- NEVER ignore HIGH or CRITICAL risk warnings from impact analysis.
- NEVER rename symbols with find-and-replace — use `gitnexus_rename` which understands the call graph.
- NEVER commit changes without running `gitnexus_detect_changes()` to check affected scope.

## Resources

| Resource | Use for |
|----------|---------|
| `gitnexus://repo/ai-spector/context` | Codebase overview, check index freshness |
| `gitnexus://repo/ai-spector/clusters` | All functional areas |
| `gitnexus://repo/ai-spector/processes` | All execution flows |
| `gitnexus://repo/ai-spector/process/{name}` | Step-by-step execution trace |

## CLI

| Task | Read this skill file |
|------|---------------------|
| Understand architecture / "How does X work?" | `.claude/skills/gitnexus/gitnexus-exploring/SKILL.md` |
| Blast radius / "What breaks if I change X?" | `.claude/skills/gitnexus/gitnexus-impact-analysis/SKILL.md` |
| Trace bugs / "Why is X failing?" | `.claude/skills/gitnexus/gitnexus-debugging/SKILL.md` |
| Rename / extract / split / refactor | `.claude/skills/gitnexus/gitnexus-refactoring/SKILL.md` |
| Tools, resources, schema reference | `.claude/skills/gitnexus/gitnexus-guide/SKILL.md` |
| Index, status, clean, wiki CLI commands | `.claude/skills/gitnexus/gitnexus-cli/SKILL.md` |

<!-- gitnexus:end -->
