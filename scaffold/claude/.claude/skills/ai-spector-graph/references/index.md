# Task: index

Rebuild **graph**, re-merge **knowledge** staging, and update **document indexes** when project files changed outside the normal `/analyze` flow.

**Not** the same as **`/summary`**, which only builds human-readable summaries under `.ai-spector/index/`.

## Usage

- `/index` — full refresh via MCP (preferred) or CLI fallback
- User may run: `npx ai-spector index` with flags (see README) when MCP is unavailable

## When to use

- User edited `docs/data-source/`, `docs/srs/`, or templates manually
- Graph validate fails due to stale structure
- `.ai-spector/index/*.md` is out of date vs `docs/srs/` or `docs/basic-design/`

**Partial semantic refresh without `/analyze`:** After `/generate-srs`, index parses **UC/F/actor ids from markdown bodies** under `docs/srs/` and `docs/basic-design/` into the traceability graph. Per-domain detail files get **`doc.srs.uc-UC-01` / `doc.srs.f-F-01` document nodes**, **`section` nodes** with `title` + snippet `description` from real headings/body text, **`definedIn`** / **`describedIn`** from each UC/F to those sections, and **`contains`** from the list chapter to each detail doc. Domain `title` / `description` are refreshed from bold fields (`**Use Case Name:**`, `**Brief Description:**`, feature purpose) — extracted via structured AST parsing, not regex.

**Still requires `/analyze` for:** full knowledge extraction → `knowledge.json` (NFRs, data model, rich descriptions). Index re-merges existing `knowledge.json` when present; warns if SRS changed but knowledge is stale.

## Required Behavior

**Use the MCP tool when the `ai-spector` server is configured. Fall back to CLI only when MCP is unavailable.**

### MCP (preferred)

```
index({})                              # full refresh
index({ graphOnly: true })             # structure + knowledge merge only
index({ docsOnly: true })              # doc indexes only
index({ skipMerge: true })             # skip knowledge.json merge
index({ skipDocSemantics: true })      # skip UC/F body parsing
```

### CLI fallback

```bash
npx ai-spector index
npx ai-spector index --graph-only
npx ai-spector index --docs-only
```

Index steps (default): registry/bootstrap → knowledge merge → **SRS/docs body extract** → **source hub** → **provenance (`derivedFrom`)** → **business hub** → validate → doc indexes.

**CLI alone is not full semantics:** Index builds structure + parseable meaning. For cross-hub evidence links (`relatesTo`), run **`/link-graph`** after index, then `graph_merge({ semantic: true })` (MCP) or `npx ai-spector graph merge --semantic`. Check gaps with `npx ai-spector graph report --json`.

**Provenance:** UC/F/requirement/actor nodes get **`derivedFrom`** edges to `docs/data-source/**` paths (from `knowledge.json` `sourceRef` / `sourceRefs` / `derivedFrom`, SRS detail `Source:` lines, or inline `docs/data-source/…` mentions). No evidence → no edge.

## Stop on failure

Follow [cli-failures.md](../../ai-spector/references/cli-failures.md). Do not hand-edit `traceability.graph.json` to "fix" validate errors.

## Success

- Summary shows ✓ for requested steps
- `npx ai-spector graph validate` passes (unless `--skip-validate`)
- Suggest `/visualize-graph` or `/validate-graph` if user wants to inspect
