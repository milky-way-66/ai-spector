# CocoIndex Integration Plan

## Goal

Integrate CocoIndex as an opt-in add-on that enriches ai-spector's existing
features with semantic understanding. The traceability graph (structured typed
edges) and CocoIndex (semantic proximity via embeddings) answer different
questions — together they give agents a complete picture.

```
Agent question                             → Tool
──────────────────────────────────────────────────────────────────
"What's affected if auth.md changes?"      → graph_impact  (formal edges)
                                           + graph_impact   (+ semantic suggestions)  ← improved
"Find every mention of rate limiting"      → docs_search    ← new
"Show graph node for payment feature"      → graph_query_fuzzy  ← new (was: exact ID required)
"Which docs describe the login flow?"      → docs_search    ← new
"What needs regen after my edit?"          → graph_impact --git
"Are any translations semantically stale?" → lang queue     (+ semantic drift check)  ← improved
"Find all comments about rate limiting"    → docs_search → comments_list  (workflow)
```

**Core insight:** ai-spector knows *formal* relationships (edges in the graph).
CocoIndex knows *semantic* proximity (what is conceptually related, even without
an edge). The combination surfaces what the graph alone cannot.

---

## Architecture

```
User project
├── docs/
│   ├── srs/                ← ai-spector traceability graph sources
│   ├── basic-design/
│   └── detail-design/
├── .ai-spector/
│   └── .docflow/
│       ├── config/
│       │   └── index.docs.json    ← already exists — lists all doc roots
│       └── cocoindex/             ← NEW (created by `cocoindex setup`)
│           ├── pipeline.py        ← CocoIndex indexing pipeline
│           └── .env               ← DB connection (gitignored)
└── .claude/ or .cursor/
    └── skills/
        └── ai-spector-search      ← NEW skill (semantic search + workflow rules)
```

**Runtime:**
- Python ≥ 3.11 + `cocoindex` pip package
- **LanceDB by default** (file-based, zero setup, pushable to git) — switch to Postgres+pgvector via `COCOINDEX_DB_URL` env var
- Runs as a sidecar alongside the Node.js stack
- Pipeline reads `index.docs.json` — no extra config needed

**Bridge — graph ↔ semantic:**
Every `docs_search` result carries a `graphNodeId` field. When the matched doc
path maps to a known graph node, ai-spector fills it in automatically. Agents
get semantic results with traceability context in one call.

---

## How CocoIndex improves existing features

### `graph impact` — semantic blast radius

**Current:** traces formal edges only. A change to `uc-auth.md` won't surface
`security-arch.md` unless a graph edge exists between them.

**With CocoIndex:** after computing the formal impact, query CocoIndex for docs
semantically similar to the changed node's content. Return as a separate
`semanticSuggestions` bucket.

```
graph_impact("uc.auth.login")
  → formal:    feature.auth.session, doc.basic.auth     (graph edges)
  → semantic:  doc.basic.security, doc.detail.api-keys  (CocoIndex suggestions)
```

**Agent workflow (no code change needed):**
1. `graph_impact` → formal blast radius
2. `docs_search(query: <changed node description>)` → semantic neighbors
3. Agent reports both, flags semantic suggestions as "review recommended"

**Code integration (optional):** `ImpactResult` gains a `semanticSuggestions`
field populated by CocoIndex when the feature flag is enabled.

---

### `graph query` — natural language node lookup

**Current:** requires an exact node ID (`uc.auth.login`). Users and agents
often know the concept but not the ID.

**With CocoIndex:** `graph_query_fuzzy` resolves natural language to a node ID
via semantic search, then runs the normal graph traversal.

```
graph_query_fuzzy("user login")
  → docs_search("user login") → graphNodeId: "uc.auth.login"
  → graph_query(seedId: "uc.auth.login")
```

**Agent workflow (no code change):**
1. `docs_search(query: "user login")` → `graphNodeId`
2. `graph_query(seedId: graphNodeId)`

**New MCP tool:** `graph_query_fuzzy` — wraps both steps, single call for agents.

---

### `index` — keep embeddings in sync

**Current:** fingerprints markdown files, updates translation queue, writes
section registry.

**With CocoIndex:** after `ai-spector index`, trigger the CocoIndex pipeline
update so embeddings stay fresh. No stale `docs_search` results after indexing.

**Agent workflow (no code change):**
```
npx ai-spector index
python .ai-spector/.docflow/cocoindex/pipeline.py cocoindex update
```

**Code integration (optional):** `runIndex()` spawns the CocoIndex update as a
background step when `cocoindex` is configured (checked via presence of
`.ai-spector/.docflow/cocoindex/pipeline.py`).

---

### `lang queue` — detect semantic staleness

**Current:** translation jobs are queued when a doc's content hash changes.
A doc that drifted semantically but not byte-for-byte (e.g. reworded sentences
same meaning) is not flagged.

**With CocoIndex:** compare the embedding of the source doc against the
embedding of its translation. High cosine distance → flag as potentially stale
even if the hash hasn't changed.

**This is a code integration** in `reconcileTranslationQueue`. New optional
field on `TranslationJob`: `semanticDriftScore?: number`.

---

### `comments` — topic-based search across all docs

**Current:** comments are anchored to specific file+heading. Finding all
comments about a topic requires knowing file paths in advance.

**With CocoIndex (pure agent workflow):**
1. `docs_search("rate limiting")` → list of matching doc paths
2. For each path: `comments_list(filePath: path)` → comments on that section
3. Agent aggregates and reports all comments about the topic

No code change needed.

---

## Phases

---

### Phase 1 — Python pipeline scaffold

**Goal:** Working CocoIndex pipeline users can run manually. No CLI, no MCP
yet. Validate the Python side independently.

#### Files to create

**`scaffold/cocoindex/pipeline.py`**
```python
"""
ai-spector CocoIndex pipeline.
Reads doc roots from .ai-spector/.docflow/config/index.docs.json
and indexes all markdown files for semantic search.

Storage: LanceDB by default (file-based, zero setup).
Set COCOINDEX_DB_URL=postgresql://... to use Postgres+pgvector instead.

Embedding: all-MiniLM-L6-v2 (local, no API key, ~80 MB).
Set OPENAI_API_KEY + COCOINDEX_EMBED_MODEL=openai:text-embedding-3-small
for higher-quality embeddings.
"""
import json, os
from pathlib import Path
import cocoindex

PROJECT_ROOT = Path(os.getenv("AI_SPECTOR_ROOT", str(Path.cwd())))
INDEX_CONFIG = PROJECT_ROOT / ".ai-spector/.docflow/config/index.docs.json"
DB_URL = os.getenv("COCOINDEX_DB_URL", "")          # empty → LanceDB
EMBED_MODEL = os.getenv("COCOINDEX_EMBED_MODEL", "sentence-transformers/all-MiniLM-L6-v2")
LANCE_PATH = str(PROJECT_ROOT / ".ai-spector/.docflow/cocoindex/lance_data")

def load_doc_roots() -> list[str]:
    cfg = json.loads(INDEX_CONFIG.read_text())
    return [str(PROJECT_ROOT / src["root"]) for src in cfg.get("sources", {}).values()]

def make_embed():
    if EMBED_MODEL.startswith("openai:"):
        return cocoindex.functions.OpenAIEmbed(model=EMBED_MODEL.removeprefix("openai:"))
    return cocoindex.functions.SentenceTransformerEmbed(model=EMBED_MODEL)

def make_storage():
    if DB_URL:
        return cocoindex.storages.Postgres(table_name="doc_chunks")
    return cocoindex.storages.LanceDB(uri=LANCE_PATH, table_name="doc_chunks")

@cocoindex.flow_def(name="ai_spector_docs")
def docs_flow(flow_builder: cocoindex.FlowBuilder, db: cocoindex.DataScope):
    for root in load_doc_roots():
        docs = flow_builder.add_source(
            cocoindex.sources.LocalFile(path=root, included_patterns=["**/*.md"])
        )
        chunks = docs.transform(
            cocoindex.functions.SplitRecursively(),
            language="markdown", chunk_size=400, chunk_overlap=50,
        )
        chunks.transform(make_embed()).save_to(db["doc_chunks"], make_storage())

if __name__ == "__main__":
    cocoindex.cli.main()
```

**`scaffold/cocoindex/.env.example`**
```
AI_SPECTOR_ROOT=.

# Storage — LanceDB (default, file-based, no server needed):
# leave COCOINDEX_DB_URL unset

# Storage — Postgres+pgvector (optional):
# COCOINDEX_DB_URL=postgresql://localhost/cocoindex

# Embedding — local model (default, ~80 MB download, no API key):
# COCOINDEX_EMBED_MODEL=sentence-transformers/all-MiniLM-L6-v2

# Embedding — OpenAI (optional, higher quality):
# OPENAI_API_KEY=sk-...
# COCOINDEX_EMBED_MODEL=openai:text-embedding-3-small
```

**`scaffold/cocoindex/requirements.txt`**
```
cocoindex>=0.1
sentence-transformers>=3.0
lancedb>=0.8
# Uncomment if using Postgres+pgvector:
# psycopg2-binary>=2.9
```

**`scaffold/cocoindex/.gitignore`**
```
.env
lance_data/
```

**`scaffold/cocoindex/README.md`** — setup instructions (pip install, first run, env options).

#### Acceptance criteria
- [ ] `python pipeline.py cocoindex update` runs on a sample project with no `.env`
- [ ] Chunks appear in `lance_data/` with embeddings (LanceDB default)
- [ ] Re-run only reprocesses changed files (incremental)
- [ ] Setting `COCOINDEX_DB_URL` routes to Postgres instead

**Estimated effort:** 1 day

---

### Phase 2 — CLI command + `docs_search`

**Goal:** `npx ai-spector cocoindex setup/search/index` and the first new MCP
tool `docs_search`.

#### New TypeScript files

**`src/core/operations/cocoindex.ts`**
```ts
export interface CocoindexSetupResult { pipelinePath: string; envPath: string; alreadyExists: boolean }
export interface SearchResult {
  docPath: string;       // relative path to matched file
  heading: string;       // nearest heading above the chunk
  excerpt: string;       // matched text
  score: number;         // similarity 0–1
  graphNodeId?: string;  // traceability graph node for this doc (if known)
}
export interface CocoindexSearchResult { query: string; results: SearchResult[] }

export async function runCocoindexSetup(opts): Promise<CocoindexSetupResult>
// copies scaffold/cocoindex/ → .ai-spector/.docflow/cocoindex/

export async function runCocoindexSearch(opts): Promise<CocoindexSearchResult>
// queries Postgres doc_chunks, enriches results with graph node lookup
```

**`src/interfaces/cli/format/cocoindex.ts`**
```ts
export function formatCocoindexSetup(r: CocoindexSetupResult): string
export function formatCocoindexSearch(r: CocoindexSearchResult): string
```

**`src/interfaces/mcp/tools/cocoindex.ts`** — `toolDocsSearch()`

**Add to `src/interfaces/mcp/schemas.ts`**
```ts
export const DocsSearchSchema = RootSchema.extend({
  query: z.string().describe("Natural language search query over project docs"),
  limit: z.number().int().min(1).max(20).optional().describe("Max results (default 5)"),
});
```

#### CLI subcommands
```
ai-spector cocoindex setup    # scaffold pipeline into project (also offered by `ai-spector setup`)
ai-spector cocoindex index    # run pipeline.py cocoindex update
ai-spector cocoindex search   # --query <text> --limit <n> --json
```

`ai-spector setup` gains an interactive prompt:
```
? Enable CocoIndex for semantic doc search? (y/N)
```
Answering yes calls `runCocoindexSetup` inline.

#### MCP tool output
```json
{
  "query": "login flow",
  "results": [
    { "docPath": "docs/srs/uc-auth.md", "heading": "## UC-AUTH-001", "excerpt": "...", "score": 0.91, "graphNodeId": "uc.auth.login" }
  ]
}
```

#### Graceful degradation
When CocoIndex is not configured, `docs_search` returns:
```json
{ "error": "CocoIndex not set up. Run: npx ai-spector cocoindex setup" }
```
Never throws — MCP server must not crash on optional features.

#### New dependencies
```json
"@lancedb/lancedb": "^0.8.0",
"pg": "^8.13.0"
```
`@lancedb/lancedb` is the default storage client. `pg` is imported only when
`COCOINDEX_DB_URL` is set (Postgres mode). Neither is loaded when CocoIndex is
not configured — no cost to users who don't use it.

#### Acceptance criteria
- [ ] `npx ai-spector cocoindex setup` creates pipeline files
- [ ] `npx ai-spector cocoindex search --query "login"` returns results
- [ ] `graphNodeId` populated when doc maps to a graph node
- [ ] MCP `docs_search` tool in `tools/list`
- [ ] Friendly error when DB is unreachable
- [ ] MCP server starts cleanly without CocoIndex configured

**Estimated effort:** 2 days

---

### Phase 3 — `graph_query_fuzzy` MCP tool

**Goal:** Let agents find graph nodes by natural language instead of exact ID.
Combines `docs_search` + `graph_query` into one call.

#### Implementation

**`src/core/operations/cocoindex.ts`** — add:
```ts
export interface FuzzyQueryResult {
  resolvedNodeId: string;
  resolvedVia: string;   // how the node was found
  confidence: number;
  subgraph: GraphQueryResult;
}
export async function runGraphQueryFuzzy(opts: { query: string; root?: string; depth?: number }): Promise<FuzzyQueryResult>
// 1. docs_search(query) → top result's graphNodeId
// 2. graph_query(seedId: graphNodeId, depth)
// 3. return merged result
```

**`src/interfaces/mcp/schemas.ts`** — add `GraphQueryFuzzySchema`

**`src/interfaces/mcp/tools/cocoindex.ts`** — add `toolGraphQueryFuzzy()`

**Register in `server.ts`** as `graph_query_fuzzy`.

#### Acceptance criteria
- [ ] `graph_query_fuzzy("user login")` resolves to `uc.auth.login` and returns subgraph
- [ ] `resolvedNodeId` and `confidence` present in response
- [ ] Falls back to error when no matching node found

**Estimated effort:** 1 day

---

### Phase 4 — `graph_impact` semantic enrichment

**Goal:** `graph_impact` returns both formal edges AND semantic suggestions in
one response. Agents see the full blast radius without a second call.

#### Changes to `src/core/operations/graph-impact.ts`

```ts
// ImpactResult gains optional field:
export interface ImpactResult {
  // ... existing fields ...
  semanticSuggestions?: SemanticSuggestion[];  // NEW — only present when CocoIndex configured
}

export interface SemanticSuggestion {
  docPath: string;
  heading: string;
  score: number;          // similarity 0–1; only suggestions ≥ threshold included
  graphNodeId?: string;
  reason: string;         // e.g. "semantically similar to changed section"
}

// threshold default: 0.75 — configurable via COCOINDEX_SIMILARITY_THRESHOLD env var
```

`runGraphImpact()` and `runGraphImpactFromGit()` call `runCocoindexSearch` with
the changed node's description after computing formal impact. Results merged
before returning. CocoIndex unavailable → `semanticSuggestions` omitted silently.

#### Changes to `src/interfaces/cli/format/graph.ts`

`formatGraphImpact()` renders `semanticSuggestions` as a new section:
```
semantic suggestions (review recommended):
  - docs/basic-design/security-arch.md § Auth Overview  (score: 0.87)
  - docs/detail-design/session.md § Token Lifecycle     (score: 0.81)
```

#### Acceptance criteria
- [ ] `graph_impact` response includes `semanticSuggestions` when CocoIndex is set up
- [ ] Formal impact results unchanged (no regression)
- [ ] CocoIndex not configured → `semanticSuggestions` absent, no error
- [ ] CLI output shows new section when suggestions present

**Estimated effort:** 1.5 days

---

### Phase 5 — `index` sync hook

**Goal:** `ai-spector index` optionally triggers CocoIndex pipeline update so
embeddings are always fresh after an index run.

#### Change to `src/core/operations/index.ts`

```ts
// IndexReport gains:
export interface IndexReport {
  // ... existing fields ...
  cocoindexUpdated?: boolean;   // true if pipeline ran and succeeded
  cocoindexSkipped?: boolean;   // true if not configured
}
```

After the existing index steps, check for `.ai-spector/.docflow/cocoindex/pipeline.py`.
If present, spawn `python pipeline.py cocoindex update` as a child process.
Report result in `IndexReport`.

Controlled by config flag `cocoindex.autoSync: true` in docflow config (default `false`).

#### Acceptance criteria
- [ ] `npx ai-spector index` runs CocoIndex update when configured and `autoSync: true`
- [ ] Output shows "CocoIndex: updated N chunks" or "CocoIndex: skipped (not configured)"
- [ ] Failure of CocoIndex update does not fail the index command

**Estimated effort:** 0.5 day

---

### Phase 6 — Agent scaffold + workflow rules

**Goal:** Teach agents (Cursor, Claude) when and how to use the new tools and
workflows. No code — just scaffold files.

#### New / updated files

**`scaffold/cursor/skills/ai-spector-search`** (new)
```markdown
# ai-spector-search

## When to use
- User asks to find sections about a concept
- graph_query returns no results (unknown node ID)
- "Find all mentions of X across the docs"
- "Are there any comments about Y?"

## Workflows

### Semantic search
1. docs_search(query) → results with graphNodeId
2. For each result: graph_query(seedId: graphNodeId) → traceability context
3. Read matched section from file if needed

### Natural language graph lookup
1. graph_query_fuzzy(query) → resolves node + returns subgraph in one call

### Full impact (formal + semantic)
1. graph_impact(nodeId) → formal blast radius + semanticSuggestions in one response

### Find comments on a topic
1. docs_search(query) → list of docPaths
2. For each docPath: comments_list(filePath) → comments on that section
```

**`scaffold/claude/CLAUDE.md`** — update skill table and CLI reference:
```markdown
| Semantic doc search / fuzzy graph lookup | `ai-spector-search` |
```

**`scaffold/cursor/WORKFLOW.md`** — add to "before editing a doc":
> Run `graph_impact` for formal blast radius. If CocoIndex is configured,
> `semanticSuggestions` are included automatically. Optionally run
> `graph_query_fuzzy` if you don't know the exact node ID.

#### Acceptance criteria
- [ ] `ai-spector init` (or `sync-cursor`) copies the search skill
- [ ] Skill documents all four workflows above
- [ ] Scaffold CLAUDE.md references new tools

**Estimated effort:** 0.5 day

---

## Implementation Order

```
Phase 1 ──► Phase 2 ──► Phase 3 ──► Phase 4 ──► Phase 5 ──► Phase 6
Pipeline    CLI +         Fuzzy       Impact       Index       Scaffold
scaffold    docs_search   query       enrichment   sync hook   + rules
(Python)    (MCP tool)    (MCP tool)  (core)       (optional)
```

- Phase 1 is pure Python — can be validated before any TypeScript work
- Phase 3 depends on Phase 2 (`runCocoindexSearch` must exist)
- Phase 4 depends on Phase 2 (same reason)
- Phase 5 depends on Phase 2 (cocoindex module must exist)
- Phase 6 is independent — can be written in parallel with any phase
- Phases 5 and 6 can be skipped in the first release

**Minimum viable release:** Phases 1 + 2 only (pipeline + `docs_search`).
Phase 3 + 4 are the highest-leverage additions for agent usability.

---

## Decisions (closed)

| Question | Decision |
|----------|----------|
| **Vector store** | LanceDB default (file-based, zero setup, git-friendly). Postgres+pgvector opt-in via `COCOINDEX_DB_URL`. |
| **Embedding model** | `all-MiniLM-L6-v2` local (no API key, ~80 MB). Auto-upgrade to `openai:text-embedding-3-small` when `OPENAI_API_KEY` + `COCOINDEX_EMBED_MODEL` set. |
| **`cocoindex setup` vs `init --with-cocoindex`** | `ai-spector setup` asks whether to enable CocoIndex. `ai-spector cocoindex setup` also available to add it later. |
| **`semanticSuggestions` threshold** | Default 0.75 minimum score. Configurable via `COCOINDEX_SIMILARITY_THRESHOLD` env var. |

---

## Full Acceptance Criteria

- [ ] `npx ai-spector cocoindex setup` scaffolds pipeline in < 10 s
- [ ] `npx ai-spector cocoindex search --query "payment flow"` returns ≥ 1 result
- [ ] MCP `docs_search` appears in `tools/list` alongside graph tools
- [ ] MCP `graph_query_fuzzy` resolves natural language to graph node
- [ ] `graph_impact` includes `semanticSuggestions` when CocoIndex configured
- [ ] All existing `graph_impact` / `graph_query` behavior unchanged (no regression)
- [ ] CocoIndex not configured → all new tools return friendly errors, MCP server does not crash
- [ ] `npm run build` and `npm test` pass throughout all phases
