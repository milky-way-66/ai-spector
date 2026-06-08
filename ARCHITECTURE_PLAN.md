# ai-spector — Multi-Interface Architecture Plan

## Goal

Refactor ai-spector so the same domain logic can be consumed by multiple
interfaces (CLI, MCP, SDK, …) without duplication or stdout pollution.

---

## Problem With the Current Design

```
src/commands/run*.ts       ← business logic + console.log mixed together
src/cli.ts                 ← 753-line commander wiring calling run* directly
```

- `run*` functions print to stdout internally → impossible to reuse in MCP or
  SDK without getting unwanted output.
- All interface concerns live in one file (`cli.ts`).
- No public SDK entry point.

---

## Target Architecture

```
src/
  core/                        # Pure domain logic — zero console.log
    operations/                # run* business logic, stripped of IO
      graph-query.ts
      graph-impact.ts
      graph-merge.ts
      graph-validate.ts
      graph-report.ts
      graph-visualize.ts
      index.ts
      analyze.ts
      comments.ts
      template.ts
      lang.ts
      lang-queue.ts
      prototype.ts
      setup.ts
      hooks.ts
      init.ts
      sync-cursor.ts
    # domain modules stay in-place (already clean):
    # graph/ comments/ config/ markdown/ template/ util/
    # index/ lang/ registry/ visualize/ prototype/

  interfaces/
    cli/
      format/                  # formatters: structured result → human-readable string
        graph.ts
        comments.ts
        index.ts
        ...
      commands/                # thin commander handlers: parse → call core → format → print
        graph.ts
        comments.ts
        index.ts
        template.ts
        prototype.ts
        ...
      cli.ts                   # commander program setup (replaces src/cli.ts)

    mcp/
      server.ts                # MCP server entry point (stdio transport)
      tools/                   # one file per tool group
        graph.ts               # graph_query, graph_impact, graph_validate, graph_merge
        index.ts               # index (re-index project)
        comments.ts            # comments_list, comments_inbox, comments_resolve
        template.ts            # template_list, template_import
      schemas.ts               # Zod input schemas shared across tools

    sdk/
      index.ts                 # public API — re-exports core operations with clean types

  sdk.ts                       # package entry point → re-exports src/interfaces/sdk/index.ts
  cli.ts                       # bin entry point → imports src/interfaces/cli/cli.ts
  types.ts                     # shared types (unchanged)
```

---

## MCP Tool Surface (full list)

| Tool name            | Core function                        | Description                              |
|----------------------|--------------------------------------|------------------------------------------|
| `graph_query`        | `querySubgraph()`                    | Walk graph from a seed node              |
| `graph_impact`       | `computeImpact()`                    | Impact analysis for a change             |
| `graph_validate`     | `validateGraph()`                    | Validate graph schema + traceability     |
| `graph_merge`        | `runGraphMerge()`                    | Merge knowledge into graph               |
| `graph_report`       | `runGraphReport()`                   | Generate graph report                    |
| `index`              | `runIndex()`                         | Re-index project (graph + docs)          |
| `comments_list`      | `runCommentsList()`                  | List comments on a node                  |
| `comments_inbox`     | `runCommentsInbox()`                 | Show unresolved comment inbox            |
| `comments_resolve`   | `runCommentsResolve()`               | Mark comment resolved                    |
| `template_list`      | `runTemplateScan()`                  | List available template packs            |
| `template_import`    | `runTemplateImport()`                | Import a template pack                   |

---

## Phases

---

### Phase 1 — MCP Server (additive, no breaking changes)

**Goal:** Ship a working MCP server that agents (Cursor, Claude) can call today.
CLI is untouched. No file moves.

**Strategy:** Wire MCP tools directly to existing `run*` functions and domain
modules. Accept that some stdout may appear in core functions during this phase —
MCP returns structured data regardless because the tool handlers capture return
values, not stdout.

**Files to create:**

```
src/interfaces/mcp/server.ts
src/interfaces/mcp/tools/graph.ts
src/interfaces/mcp/tools/index.ts
src/interfaces/mcp/tools/comments.ts
src/interfaces/mcp/tools/template.ts
src/interfaces/mcp/schemas.ts
```

**New dependency:**
```
@modelcontextprotocol/sdk   # MCP server SDK
zod                         # input validation for tool schemas
```

**New bin entry in package.json:**
```json
"ai-spector-mcp": "./dist/interfaces/mcp/server.js"
```

**MCP server transport:** stdio (standard for local MCP servers used by Cursor/Claude).

**Acceptance criteria:**
- [ ] `npx ai-spector-mcp` starts without error
- [ ] Cursor / Claude Code can list tools via MCP protocol
- [ ] `graph_query` returns valid JSON subgraph
- [ ] `graph_impact` returns valid JSON impact result
- [ ] `index` triggers re-index and returns `IndexReport`
- [ ] `comments_list` returns comment list

**Estimated effort:** 1–2 days

---

### Phase 2 — Strip IO From Core Operations

**Goal:** Remove all `console.log` from `src/commands/run*` functions so they
are pure (input → structured output, no side effects on stdout).

**Strategy:**

1. For each `run*` function that prints:
   - Change return type from `void` to a structured result type
   - Remove all `console.log` / `process.stdout.write` calls from the function body
   - Move formatting logic into `src/interfaces/cli/format/<domain>.ts`

2. Update `src/cli.ts` command handlers to:
   ```ts
   const result = await runGraphQuery(opts);
   process.stdout.write(formatGraphQuery(result));
   ```

**Files to create:**
```
src/interfaces/cli/format/graph.ts
src/interfaces/cli/format/comments.ts
src/interfaces/cli/format/index.ts
src/interfaces/cli/format/template.ts
src/interfaces/cli/format/lang.ts
src/interfaces/cli/format/prototype.ts
```

**Files to modify (strip console.log):**

| File | console.log count | Return type change |
|------|------------------|--------------------|
| `src/commands/graph-query.ts` | ~10 | `void` → `QueryResult` |
| `src/commands/graph-impact.ts` | ~20 | `void` → `ImpactResult` |
| `src/commands/graph-merge.ts` | ~8 | `void` → `MergeResult` |
| `src/commands/graph-report.ts` | ~5 | `void` → `ReportResult` |
| `src/commands/graph-visualize.ts` | ~3 | `void` → `VisualizeResult` |
| `src/commands/index.ts` | ~15 | partially done (`IndexReport`) |
| `src/commands/analyze.ts` | ~10 | `void` → `AnalyzeResult` |
| `src/commands/comments.ts` | ~30 | `void` → `CommentsResult` |
| `src/commands/template.ts` | ~40 | `void` → `TemplateResult` |
| `src/commands/lang.ts` | ~10 | `void` → `LangResult` |
| `src/commands/lang-queue.ts` | ~15 | `void` → `QueueResult` |
| `src/commands/prototype.ts` | ~60 | `void` → `PrototypeResult` |
| `src/commands/setup.ts` | ~20 | `void` → `SetupResult` |
| `src/commands/hooks.ts` | ~10 | `void` → `HooksResult` |
| `src/commands/sync-cursor.ts` | ~5 | `void` → `SyncResult` |

**Acceptance criteria:**
- [ ] `npm test` still passes
- [ ] All CLI commands produce identical output to before (golden test or manual check)
- [ ] No `console.log` remaining in `src/commands/`
- [ ] MCP tools now get cleaner results (no stdout bleed)

**Estimated effort:** 2–3 days

---

### Phase 3 — SDK Entry Point

**Goal:** Publish a clean programmatic API so TypeScript projects can import
ai-spector as a library.

**Files to create:**
```
src/interfaces/sdk/index.ts    # re-exports core operations with clean types
src/sdk.ts                     # package entry (points to interfaces/sdk/index.ts)
```

**Add to package.json:**
```json
"exports": {
  ".": "./dist/sdk.js",
  "./mcp": "./dist/interfaces/mcp/server.js",
  "./cli": "./dist/cli.js"
}
```

**SDK surface (initial):**
```ts
// Graph
export { querySubgraph }     from './core/graph/query.js'
export { computeImpact }     from './core/graph/impact.js'
export { validateGraph }     from './commands/validate.js'
export { runGraphMerge }     from './commands/graph-merge.js'

// Index
export { runIndex }          from './commands/index.js'

// Comments
export { runCommentsList, runCommentsInbox, runCommentsResolve } from './commands/comments.js'

// Template
export { runTemplateImport } from './commands/template.js'

// Types
export type * from './types.js'
```

**Acceptance criteria:**
- [ ] `import { querySubgraph } from 'ai-spector'` works in a TypeScript consumer
- [ ] All exported functions have accurate JSDoc
- [ ] Types are exported (`.d.ts` generated)

**Estimated effort:** 0.5 day (Phase 2 must be done first for clean types)

---

### Phase 4 — Structural Cleanup (optional)

**Goal:** Move files into the clean `src/core/` layout so the folder structure
matches the architecture diagram.

**Moves:**
```
src/commands/graph-query.ts  → src/core/operations/graph-query.ts
src/commands/graph-impact.ts → src/core/operations/graph-impact.ts
... (all run* files)
src/graph/                   → src/core/graph/
src/comments/                → src/core/comments/
src/config/                  → src/core/config/
src/markdown/                → src/core/markdown/
src/util/                    → src/core/util/
src/index/                   → src/core/index/
src/lang/                    → src/core/lang/
src/registry/                → src/core/registry/
src/visualize/               → src/core/visualize/
src/prototype/               → src/core/prototype/
src/template/                → src/core/template/
```

**Update all import paths** across the codebase.

**Acceptance criteria:**
- [ ] `npm run build` succeeds
- [ ] `npm test` passes
- [ ] No imports reference old paths

**Estimated effort:** 1 day (mostly mechanical, can use automated refactor)

---

## Implementation Order

```
Phase 1 ──► Phase 2 ──► Phase 3 ──► Phase 4 (optional)
  MCP         Strip IO     SDK        Structural move
  (additive)  (careful)    (fast)     (cosmetic)
```

Phase 1 is safe to ship independently — it adds value immediately with zero
risk to the existing CLI.

Phase 2 is the most careful — each command needs a golden comparison before and
after to catch formatting regressions.

Phase 3 requires Phase 2 to be useful (otherwise SDK consumers get stdout noise).

Phase 4 is cosmetic — skip it if the team prefers stability over tidiness.

---

## Notes

- **No breaking changes to CLI** through Phase 3. All flags and command names stay identical.
- **MCP server uses stdio transport** — this is the standard for local MCP integrations with Cursor and Claude Code.
- **Zod schemas** defined once in `src/interfaces/mcp/schemas.ts` serve as both MCP input validation and SDK type guards.
- The `ai-spector-graph` workspace package (`packages/graph/`) is already a clean domain package — do not touch its structure.
