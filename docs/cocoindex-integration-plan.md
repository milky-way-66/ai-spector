# CocoIndex Integration Plan

## Goal

Add semantic document search to ai-spector as an opt-in add-on. Users who
enable it get a `docs_search` MCP tool that lets agents answer natural-language
questions over their SRS / basic-design / detail-design docs. The traceability
graph (structured) and CocoIndex (semantic) complement each other — neither
replaces the other.

```
Agent question                       → Tool
─────────────────────────────────────────────────────
"What's affected if auth.md changes?" → graph_impact
"Find every mention of rate limiting" → docs_search  ← new
"Show graph node for payment feature" → graph_query
"Which docs describe the login flow?" → docs_search  ← new
"What needs regen after my edit?"     → graph_impact --git
```

---

## Architecture

```
User project
├── docs/
│   ├── srs/               ← ai-spector traceability graph sources
│   ├── basic-design/
│   └── detail-design/
├── .ai-spector/
│   └── .docflow/
│       ├── config/
│       │   └── index.docs.json   ← already exists, lists doc roots
│       └── cocoindex/            ← NEW
│           ├── pipeline.py       ← CocoIndex indexing pipeline
│           └── .env              ← DB connection (gitignored)
└── .claude/ or .cursor/
    └── skills/
        └── ai-spector-search     ← NEW skill for semantic search
```

**Runtime:**
- Python ≥ 3.11 + `cocoindex` pip package
- PostgreSQL with pgvector extension (local or Docker)
- Runs as a sidecar process alongside the ai-spector Node.js stack
- CocoIndex pipeline reads `index.docs.json` — no extra config file

**Bridge:**
When `docs_search` returns a result chunk, ai-spector enriches it with the
traceability graph node for that doc path (`graphNodeId`). Agents get both
the matching text AND the graph context in one call.

---

## Phases

---

### Phase 1 — Python pipeline scaffold

**Goal:** Ship a working CocoIndex pipeline that users can run manually.
No CLI command yet, no MCP tool yet. Just the pipeline file in scaffold.

#### Files to create

**`scaffold/cocoindex/pipeline.py`**

```python
"""
ai-spector CocoIndex pipeline
Indexes docs/ into pgvector for semantic search.
Reads doc roots from .ai-spector/.docflow/config/index.docs.json
"""
import json, os
from pathlib import Path
import cocoindex

# ── Config ────────────────────────────────────────────────────────────────────

PROJECT_ROOT = Path(os.getenv("AI_SPECTOR_ROOT", Path.cwd()))
INDEX_CONFIG  = PROJECT_ROOT / ".ai-spector/.docflow/config/index.docs.json"
DB_URL        = os.getenv("COCOINDEX_DB_URL", "postgresql://localhost/cocoindex")

def load_doc_roots() -> list[str]:
    cfg = json.loads(INDEX_CONFIG.read_text())
    return [
        str(PROJECT_ROOT / src["root"])
        for src in cfg.get("sources", {}).values()
    ]

# ── Pipeline ──────────────────────────────────────────────────────────────────

@cocoindex.flow_def(name="ai_spector_docs")
def docs_flow(flow_builder: cocoindex.FlowBuilder, db: cocoindex.DataScope):
    for root in load_doc_roots():
        docs = flow_builder.add_source(
            cocoindex.sources.LocalFile(path=root, included_patterns=["**/*.md"])
        )
        chunks = docs.transform(
            cocoindex.functions.SplitRecursively(),
            language="markdown",
            chunk_size=400,
            chunk_overlap=50,
        )
        chunks.transform(
            cocoindex.functions.SentenceTransformerEmbed(
                model="sentence-transformers/all-MiniLM-L6-v2"
            )
        ).save_to(
            db["doc_chunks"],
            cocoindex.storages.Postgres(table_name="doc_chunks"),
        )

if __name__ == "__main__":
    cocoindex.cli.main()
```

**`scaffold/cocoindex/.env.example`**
```
COCOINDEX_DB_URL=postgresql://localhost/cocoindex
AI_SPECTOR_ROOT=.
```

**`scaffold/cocoindex/requirements.txt`**
```
cocoindex>=0.1
sentence-transformers>=3.0
psycopg2-binary>=2.9
```

**`scaffold/cocoindex/README.md`**
Setup instructions: install Python deps, create DB, run pipeline.

#### Acceptance criteria
- [ ] `python pipeline.py cocoindex update` runs without error on a sample project
- [ ] Chunks appear in Postgres `doc_chunks` table
- [ ] Re-run is incremental (only changed files reprocessed)

**Estimated effort:** 1 day

---

### Phase 2 — `ai-spector cocoindex` CLI command

**Goal:** `npx ai-spector cocoindex setup` and `npx ai-spector cocoindex search`
so users don't need to manage the Python pipeline manually.

#### New files

**`src/core/operations/cocoindex.ts`**

```ts
export interface CocoindexSetupResult {
  pipelinePath: string;
  envPath: string;
  alreadyExists: boolean;
}

export interface CocoindexSearchOptions {
  root?: string;
  query: string;
  limit?: number;
}

export interface SearchResult {
  docPath: string;           // relative path to the doc file
  heading: string;           // nearest heading above the chunk
  excerpt: string;           // matched text excerpt
  score: number;             // similarity score 0–1
  graphNodeId?: string;      // ai-spector graph node for this doc (if known)
}

export interface CocoindexSearchResult {
  query: string;
  results: SearchResult[];
}

export async function runCocoindexSetup(opts): Promise<CocoindexSetupResult>
// copies scaffold/cocoindex/ into .ai-spector/.docflow/cocoindex/

export async function runCocoindexSearch(opts): Promise<CocoindexSearchResult>
// queries Postgres doc_chunks via pg driver, enriches with graph node lookup
```

**`src/interfaces/cli/format/cocoindex.ts`**
```ts
export function formatCocoindexSetup(result: CocoindexSetupResult): string
export function formatCocoindexSearch(result: CocoindexSearchResult): string
```

#### CLI wiring in `src/cli.ts`
```
ai-spector cocoindex setup   # copy pipeline files into project
ai-spector cocoindex search  # semantic search (--query, --limit, --json)
ai-spector cocoindex index   # run python pipeline.py cocoindex update
```

#### Dependencies to add
```json
"pg": "^8.13.0",
"@types/pg": "^8.11.0"
```
(Only used at runtime if CocoIndex is set up — no impact on users who don't use it.)

#### Acceptance criteria
- [ ] `npx ai-spector cocoindex setup` creates `.ai-spector/.docflow/cocoindex/`
- [ ] `npx ai-spector cocoindex search --query "login flow"` returns results
- [ ] Results include `graphNodeId` when the doc path maps to a graph node
- [ ] `--json` outputs `CocoindexSearchResult` as JSON

**Estimated effort:** 1.5 days

---

### Phase 3 — MCP tool `docs_search`

**Goal:** Expose semantic search as an MCP tool so Cursor and Claude Code can
call it directly without any CLI subprocess.

#### New files

**`src/interfaces/mcp/tools/cocoindex.ts`**
```ts
export async function toolDocsSearch(args: z.infer<typeof DocsSearchSchema>) {
  const result = await runCocoindexSearch({
    root: args.root,
    query: args.query,
    limit: args.limit ?? 5,
  });
  return result;  // structured JSON, no text formatting
}
```

**Add to `src/interfaces/mcp/schemas.ts`**
```ts
export const DocsSearchSchema = RootSchema.extend({
  query: z.string().describe("Natural language search query"),
  limit: z.number().int().min(1).max(20).optional()
    .describe("Max results to return (default: 5)"),
});
```

**Register in `src/interfaces/mcp/server.ts`**
```ts
server.tool("docs_search",
  "Semantic search over project documentation (SRS, basic design, detail design). Returns matching sections with graph node context.",
  DocsSearchSchema.shape,
  toolDocsSearch
);
```

**MCP tool output shape:**
```json
{
  "query": "login flow",
  "results": [
    {
      "docPath": "docs/srs/uc-auth.md",
      "heading": "## UC-AUTH-001 User Login",
      "excerpt": "The user enters credentials and the system validates...",
      "score": 0.91,
      "graphNodeId": "uc.auth.login"
    }
  ]
}
```

#### Graceful degradation
If CocoIndex is not set up (no DB connection, no pipeline), the tool returns:
```json
{ "error": "CocoIndex not configured. Run: npx ai-spector cocoindex setup" }
```
Never throws — the MCP server must not crash when optional features are absent.

#### Acceptance criteria
- [ ] Tool appears in `tools/list` MCP response
- [ ] Returns semantic results with graph enrichment
- [ ] Returns friendly error when DB is not reachable
- [ ] `npx ai-spector-mcp` still starts cleanly when CocoIndex is not configured

**Estimated effort:** 1 day

---

### Phase 4 — Agent scaffold

**Goal:** Add the `docs_search` tool to the agent workflow so Cursor/Claude
know when and how to use it.

#### Files to update

**`scaffold/cursor/skills/ai-spector-search`** (new skill)
```markdown
# ai-spector-search

Use this skill to search project documentation semantically.

## When to use
- User asks to find sections about a topic
- You need context before editing a doc and graph_query returns no results
- User asks "where is X described?"

## Steps
1. Call `docs_search` MCP tool with the user's query
2. For each result, note `graphNodeId` — use `graph_query` on it for traceability context
3. Read the matched section from the doc file if needed
4. Report findings before editing
```

**`scaffold/claude/CLAUDE.md`** — add to skill table:
```markdown
| Semantic doc search | `ai-spector-search` |
```

**`scaffold/cursor/WORKFLOW.md`** — add docs_search to "before editing" step.

#### Acceptance criteria
- [ ] `ai-spector init` (or sync-cursor) copies the new search skill
- [ ] Skill correctly describes when to use `docs_search` vs `graph_query`

**Estimated effort:** 0.5 day

---

## Implementation Order

```
Phase 1 ──► Phase 2 ──► Phase 3 ──► Phase 4
Pipeline    CLI cmd      MCP tool    Scaffold
(manual)    (automated)  (agent)     (workflow)
```

Phase 1 can be tested manually before any TypeScript work starts.
Phase 3 depends on Phase 2 (`runCocoindexSearch` must exist first).
Phase 4 is independent of Phase 3 — can be done in parallel.

---

## Open Questions

1. **Embedding model** — `all-MiniLM-L6-v2` runs locally (no API key). Switch
   to OpenAI `text-embedding-3-small` for better quality if the user has a key.
   Make configurable via `.env`.

2. **Postgres requirement** — heavy for local dev. Evaluate whether
   [LanceDB](https://lancedb.github.io/) (file-based, no server) is a better
   default for ai-spector's typical user (solo dev, laptop).

3. **`cocoindex setup` vs `ai-spector init --with-cocoindex`** — decide whether
   to add a `--with-cocoindex` flag to `init` or keep it as a separate
   `cocoindex setup` subcommand. Separate command is lower risk.

4. **`ai-spector index` vs CocoIndex** — ai-spector's `index` command already
   fingerprints docs. Consider whether `ai-spector cocoindex index` should be
   triggered automatically after `ai-spector index` (with a config flag).

---

## Acceptance Criteria (full integration)

- [ ] `npx ai-spector cocoindex setup` scaffolds pipeline in < 10 seconds
- [ ] `npx ai-spector cocoindex search --query "payment flow"` returns ≥ 1 result on a real project
- [ ] MCP `docs_search` tool appears alongside graph tools in Cursor/Claude
- [ ] `graphNodeId` is populated for docs that exist in the traceability graph
- [ ] CocoIndex not set up → MCP tool returns friendly error, server does not crash
- [ ] `npm run build` and `npm test` pass throughout all phases
