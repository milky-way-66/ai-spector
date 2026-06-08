# ai-spector — Architecture

## Overview

ai-spector follows a **multi-interface, single domain** architecture. One domain
layer contains all business logic; multiple interface adapters expose it over
different protocols without duplication.

```
┌─────────────────────────────────────────────────┐
│                  Interfaces                     │
│  ┌──────────┐  ┌──────────┐  ┌──────────────┐  │
│  │   CLI    │  │   MCP    │  │     SDK      │  │
│  │ cli.ts   │  │server.ts │  │   sdk.ts     │  │
│  └────┬─────┘  └────┬─────┘  └──────┬───────┘  │
│       │             │               │           │
│  ┌────▼─────────────▼───────────────▼───────┐  │
│  │          src/interfaces/                  │  │
│  │  cli/format/   mcp/tools/   sdk/index.ts │  │
│  └────────────────────┬──────────────────────┘  │
└───────────────────────┼─────────────────────────┘
                        │
┌───────────────────────▼─────────────────────────┐
│                   Core Domain                   │
│  src/core/                                      │
│    operations/  graph/     comments/            │
│    config/      util/      lang/                │
│    index/       markdown/  registry/            │
│    visualize/   prototype/ template/            │
└─────────────────────────────────────────────────┘
```

**Key invariant:** nothing in `src/core/` writes to stdout. All core functions
accept typed inputs and return typed result objects. Interface adapters own
all IO (printing, JSON serialisation, MCP protocol framing).

---

## Source Layout

```
src/
  cli.ts                          # CLI bin entry point
  sdk.ts                          # SDK package entry point
  types.ts                        # shared domain types (TraceabilityGraph, etc.)

  core/                           # pure domain — no console.log
    operations/                   # high-level run* functions (one per command)
      graph-query.ts              # → GraphQueryResult
      graph-impact.ts             # → ImpactResult
      graph-merge.ts              # → GraphMergeResult
      graph-report.ts             # → LayerAuditReport
      graph-visualize.ts          # → GraphVisualizeResult
      validate.ts                 # → ValidationIssue[]
      index.ts                    # → IndexReport
      analyze.ts                  # → AnalyzePrepResult
      comments.ts                 # → CommentsListResult / CommentInbox / …
      lang.ts                     # → LangAddResult
      lang-queue.ts               # → QueueScanResult / TranslationJob[]
      hooks.ts                    # → HooksInstallResult / PreCommitReport
      setup.ts                    # → SetupAudit
      sync-cursor.ts              # → SyncCursorResult
      init.ts                     # project initialisation
      bootstrap.ts                # graph bootstrap from registry
      prototype.ts                # prototype preview/deploy
      template.ts                 # template pack import / export / regen
      template-regen.ts           # template regeneration
    graph/                        # graph load, query, merge, impact, audit
    comments/                     # comment threads (storage, inbox, plan)
    config/                       # docflow config load + types
    util/                         # fs helpers, git-diff, paths, prompt
    lang/                         # translation queue (types, store, queue)
    index/                        # document indexing (build, semantics)
    markdown/                     # remark-based markdown AST helpers
    registry/                     # section registry build + slug
    visualize/                    # HTML graph output + stats
    prototype/                    # prototype manifest, routes, preview
    template/                     # template scan + validate

  interfaces/
    cli/
      format/                     # structured result → human-readable string
        graph.ts                  # formatGraphQuery, formatGraphImpact, …
        comments.ts               # formatCommentsList, formatCommentsInbox, …
        index-cmd.ts              # formatIndexReport
        misc.ts                   # formatAnalyzePrep, formatSyncCursor, …
    mcp/
      server.ts                   # McpServer + StdioServerTransport entry
      schemas.ts                  # Zod input schemas for all 11 MCP tools
      tools/
        graph.ts                  # graph_query, graph_impact, graph_validate, graph_merge
        index.ts                  # index
        comments.ts               # comments_list, comments_inbox, comments_show, comments_resolve
        template.ts               # template_list, template_inspect
    sdk/
      index.ts                    # re-exports core operations + types as public API

packages/
  graph/                          # ai-spector-graph workspace package
                                  # pure domain types: GraphSession, querySubgraph,
                                  # computeImpact, LayerAuditReport, ImpactResult, …
```

---

## Interfaces

### CLI (`ai-spector`)

Entry: `src/cli.ts` → Commander.js program.

Each command handler follows the pattern:

```ts
const result = await runFoo(opts);
if (opts.json) console.log(JSON.stringify(result, null, 2));
else console.log(formatFoo(result));
```

Formatters live in `src/interfaces/cli/format/` and convert typed results to
human-readable text. They are the only place that knows about terminal
presentation (icons, alignment, line breaks).

### MCP Server (`ai-spector-mcp`)

Entry: `src/interfaces/mcp/server.ts` → stdio transport (standard for local MCP
integrations with Cursor and Claude Code).

Tools are registered via `server.tool(name, description, schema.shape, handler)`.
Input schemas are defined with Zod in `src/interfaces/mcp/schemas.ts`; the
`.shape` property produces the JSON Schema that the MCP SDK needs.

Tool handlers call core operations directly and return structured objects —
no text formatting.

**MCP tool surface:**

| Tool | Core function | Returns |
|------|--------------|---------|
| `graph_query` | `querySubgraph()` | subgraph nodes + edges |
| `graph_impact` | `computeImpact()` | `ImpactResult` |
| `graph_validate` | `validateGraph()` | `{ valid, errors, warnings }` |
| `graph_merge` | `runGraphMerge()` | `GraphMergeResult` |
| `graph_report` | `runGraphReport()` | `LayerAuditReport` |
| `index` | `runIndex()` | `IndexReport` |
| `comments_list` | `listThreads()` | `ThreadSummary[]` |
| `comments_inbox` | `buildCommentInboxPayload()` | `CommentInbox` |
| `comments_show` | `getThread()` | thread object |
| `comments_resolve` | `resolveThread()` | `ResolveThreadResult` |
| `template_list` | directory scan | pack list |
| `template_inspect` | `manifest.json` read | `PackManifest` |

### SDK (`import from 'ai-spector'`)

Entry: `src/sdk.ts` → re-exports `src/interfaces/sdk/index.ts`.

Package `exports` field:

```json
{
  ".":     "./dist/sdk.js",
  "./mcp": "./dist/interfaces/mcp/server.js",
  "./cli": "./dist/cli.js"
}
```

SDK surface:

```ts
// Graph domain (from ai-spector-graph)
export { querySubgraph, computeImpact }
export type { GraphQueryResult, ImpactResult, LayerAuditReport, ResolvedOrigin }

// Operations
export { validateGraph, runGraphMerge, runGraphImpact, runGraphQuery }
export { runIndex }
export { runCommentsList, runCommentsInbox, runCommentsPlan, runCommentsShow, runCommentsResolve }
```

---

## Domain Package (`ai-spector-graph`)

The `packages/graph/` workspace package is the lowest layer — pure TypeScript
with no CLI or IO dependencies. It exports:

- `GraphSession` / `ProjectSession` — graph load + query sessions
- `querySubgraph()` / `computeImpact()` — core graph algorithms
- All result types: `GraphQueryResult`, `ImpactResult`, `LayerAuditReport`, etc.

Do not add IO or CLI concerns to this package.

---

## Data Flow

```
User / Agent
     │
     ▼
Interface (CLI args / MCP JSON / SDK call)
     │
     ▼
core/operations/run*()          ← typed input, typed output, no stdout
     │
     ├── core/graph/             ← graph load, query, merge
     ├── core/comments/          ← thread storage, inbox
     ├── core/config/            ← docflow config
     └── core/util/              ← fs, git, paths
     │
     ▼
Typed result object
     │
     ├── CLI formatter → console.log(text)
     ├── MCP handler  → return { content: [{ type: "text", text: JSON }] }
     └── SDK caller   → result object returned directly
```

---

## Key Constraints

- **No `console.log` in `src/core/`** — core functions must be safe to call
  from any interface without polluting stdout.
- **No breaking CLI changes** — all existing flags and command names are preserved.
- **MCP uses stdio transport** — this is the correct transport for local agents
  (Cursor, Claude Code). Do not switch to HTTP.
- **Zod schemas in `mcp/schemas.ts`** are the single source of truth for MCP
  tool input shapes.
- **`ai-spector-graph` is untouched** — it is already a clean domain package;
  add no IO or CLI logic there.
