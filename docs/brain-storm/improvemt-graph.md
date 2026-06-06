# Git-Backed Requirement Graph — Proposal

---

## Problems

BAs and BRSEs managing SRS documents in plain Markdown face seven recurring gaps:

| # | Problem | Symptom |
|---|---|---|
| 1 | **Traceability** | Can't trace a DB change back to the epic that caused it |
| 2 | **Rationale** | No context for why a spec exists |
| 3 | **Impact analysis** | No way to know what breaks when an API changes |
| 4 | **Tooling mismatch** | Jira/DOORS are heavy, expensive, disconnected from Git |
| 5 | **Change propagation** | New requirement added — which docs need updating? |
| 6 | **Onboarding** | New member reads every doc linearly with no map |
| 7 | **Spec rot** | Long-lived projects accumulate stale, contradictory specs |

---

## Why Not an Existing Tool

| Tool | Stack | Plain `.md` | Typed edges | CLI validate | Graph export | Gap |
|---|---|---|---|---|---|---|
| Sphinx-Needs | Python | No (RST) | Yes | Yes | `needs.json` | Wrong format |
| doorstop | Python | Yes | No | Partial | No | No typed rels, no JSON |
| StrictDoc | Python | No (`.sdoc`) | No | Yes | HTML | Proprietary format |
| OpenFastTrace | Java | Yes | No | Yes | No | Wrong stack |
| Foam / Obsidian | VS Code | Yes | No | No | No | UI only, no CI |
| GraphRAG / LlamaIndex | JS/Python | Yes | AI-inferred | No | Partial | Non-deterministic |

**Bottom line:** The schema pattern (doorstop) and the graph engine (Sphinx-Needs) exist separately in different tools with incompatible stacks. Neither integrates with AI-assisted authoring workflows.

---

## What ai-spector Already Has

The hard parts are already built in `packages/graph/src/`:

**Graph schema** — rich typed node and edge sets:
- Nodes: `actor` `useCase` `feature` `requirement` `nfr` `dataEntity` `document` `section` `component` ...
- Edges: `satisfies` `tracesTo` `dependsOn` `derivedFrom` `requires` `references` `translationOf` ...

**Graph engine:**
- `InMemoryGraph` — bidirectional index (`inEdges`, `outEdges`, `nodesById`)
- `computeImpact` — two-pass BFS with configurable rules; `regenerate` vs `review` buckets; stale translation detection
- `ImpactRulesFile` — JSON-driven traversal rules per edge type, with depth and direction control
- `querySubgraph` — subgraph extraction
- Markdown parsing via `remark` — already in `src/markdown/parse.ts`

**The gap is not the engine. It is the authoring layer** — how BAs write documents that feed the graph, and how the graph stays consistent as documents change.

---

## Proposed Solution

**Extend `ai-spector` with an `srs` subcommand.** Authors write plain Markdown with a small YAML frontmatter block. The CLI indexes, validates, and queries. AI agents in the IDE enforce schema. CI blocks broken commits.

### Authoring Format

Every spec file is a plain `.md` file with a frontmatter header:

```yaml
---
id: REQ-042
type: requirement
title: User authentication via OAuth2
status: active        # active | draft | deprecated
links:
  - id: FEAT-012
    rel: tracesTo
  - id: UC-001
    rel: tracesTo
---

The system shall authenticate users via OAuth2 using Google or GitHub...
```

- `id` — unique node ID, used by the graph engine
- `type` — maps to existing `NodeType`
- `status` — lifecycle; deprecated nodes are flagged in validation
- `links` — explicit typed edges; `rel` maps to existing `EdgeType`
- Body — free-form Markdown; used for semantic search (optional)

No RST. No Python environment. No proprietary format. Any editor can open and read these files.

### Node & Edge Taxonomy (BA-Facing)

**What BAs author:**

| Type | Meaning | ID convention |
|---|---|---|
| `useCase` | Actor-facing behaviour | `UC-001` |
| `feature` | Deliverable capability | `FEAT-012` |
| `requirement` | Functional requirement | `REQ-042` |
| `nfr` | Non-functional requirement | `NFR-003` |
| `dataEntity` | Data model entity | `ENT-user` |
| `component` | UI / API / DB component | `COMP-auth-api` |

**Relationships BAs declare:**

| Edge | Direction | Question it answers |
|---|---|---|
| `satisfies` | feature → useCase | Which use case does this feature cover? |
| `tracesTo` | requirement → feature | Which feature does this requirement belong to? |
| `dependsOn` | component → component | What does this component rely on? |
| `derivedFrom` | requirement → goal/epic | Where did this requirement come from? |
| `requires` | spec → requirement | Which requirement does this spec implement? |

### CLI Commands

| Command | What it does |
|---|---|
| `ai-spector srs index` | Scan `.md` files, parse frontmatter, build `graph.json` |
| `ai-spector srs validate` | Check all `links[].id` resolve; flag broken edges, orphaned nodes, deprecated targets |
| `ai-spector srs impact <id>` | Run `computeImpact`; return regenerate/review buckets |
| `ai-spector srs onboard [topic]` | Return a guided reading path through the graph for new members |
| `ai-spector srs search "query"` | Semantic fuzzy search over node bodies (optional layer) |
| `ai-spector srs serve` | Launch local Cytoscape/Sigma.js graph viewer |

### Workflow

```
Write .md  →  AI agent enforces schema  →  srs index  →  graph.json
                                                ↓
                                          srs validate  ←  pre-commit hook
                                                ↓
                                       blocked if invalid
                                                ↓
                                          git commit
                                                ↓
                                     srs impact / onboard / serve
```

### AI Enforcement (IDE Rules)

A `.cursorrules` or `CLAUDE.md` rule file instructs the IDE agent:

1. All new spec files must include the full frontmatter block.
2. All `links[].id` must reference existing node IDs — agent checks `graph.json` before writing.
3. After any edit, agent runs `srs validate` and reports broken links before finishing.
4. After a requirement change, agent runs `srs impact <id>` and surfaces affected nodes so the BRSE knows what else to review.

This delegates schema discipline to the toolchain, not human memory.

### Multi-Agent First Indexing (Legacy Docs)

For existing unstructured documents, a one-time pipeline:

1. **Reader agent** — extracts entities and relationships from raw text; produces a candidate `id`, `type`, `links` JSON proposal.
2. **Formatter agent** — writes the frontmatter block into the `.md` file from the proposal.
3. **Validator agent** — runs `srs validate`; on failure, passes the error list back to the Formatter agent. Loops until clean or escalates to human.

**Validation contract** (what the validator checks):
- All `id` values are unique across the corpus
- All `links[].id` point to real nodes
- All `rel` values are valid `EdgeType` values
- No `active` node links to a `deprecated` node via `tracesTo` or `requires`

### CI Gate

```bash
# .husky/pre-commit
ai-spector srs validate && ai-spector srs index
git add graph.json
```

Every commit is blocked if the graph is broken. The index regenerates and re-stages automatically. No manual edit can slip through.

### Semantic Search (Optional)

Embed node bodies using a local model (`all-MiniLM-L6-v2` via `@xenova/transformers`). Store vectors alongside `graph.json`. Power `srs search` for fuzzy natural-language queries.

**Rule:** The deterministic graph is always authoritative. The semantic layer surfaces candidates — it never overrides graph facts.

---

## Build Plan

| Capability | Status | Notes |
|---|---|---|
| Graph schema (NodeType, EdgeType) | **Done** | `packages/graph/src/types.ts` |
| InMemoryGraph engine | **Done** | `packages/graph/src/InMemoryGraph.ts` |
| Impact analysis | **Done** | `packages/graph/src/impact.ts` |
| Subgraph query | **Done** | `packages/graph/src/query.ts` |
| Markdown parsing | **Done** | `src/markdown/parse.ts` |
| YAML frontmatter parsing | **Add** | `gray-matter` — small, standard library |
| `srs index` | **Build** | ~1 day |
| `srs validate` | **Build** | ~1 day |
| `srs impact` | **Wire up** | Engine exists; ~half day to expose via CLI |
| `srs onboard` | **Build** | Guided BFS traversal; ~1 day |
| `srs serve` | **Build** | Cytoscape.js viewer; ~2 days |
| AI rule files | **Write** | `.cursorrules` / `CLAUDE.md`; ~half day |
| Pre-commit hook | **Write** | ~1 hour |
| Multi-agent indexing pipeline | **Design** | Agent prompts + validation loop; ~2 days |
| Semantic search | **Optional** | Later phase |

**MVP scope** (`index` + `validate` + `impact` + rules + hook): ~3–4 days.  
**Full scope** (+ `onboard` + `serve` + first-indexing pipeline): ~1 sprint.

---

## Summary

Extend `ai-spector` with `srs` subcommands. Authors write plain Markdown with YAML frontmatter — no new format to learn. The existing graph engine handles impact analysis. AI agents enforce schema in the IDE. A pre-commit hook enforces integrity in CI. The result solves all 7 problems with minimal new code, in the team's existing stack.
