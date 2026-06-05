# Impact Algorithm Redesign Plan

## Problem statement

The current `graph impact` command uses a single omnidirectional BFS with global edge rules. This has three concrete failures:

1. **`derivedFrom` is a dead rule** — it's a path-target edge (target is a file path, not a node id), so BFS can never traverse it. The rule silently does nothing.
2. **Cross-layer impact is blocked** — depth limits are BFS-depth counters, not per-edge counters. A SRS section change finds affected useCases at depth 1, but the basic-design sections that trace to those useCases are at depth 2 and blocked.
3. **`rendersTo` is missing** — prototype output paths are never surfaced in impact results.

## Root cause

The graph has a layered structure with directed causal flow:

```
Source files
  ↓ derivedFrom (path-target)
Domain nodes (useCase, feature, actor, dataEntity, requirement, nfr)
  ↓ listedIn / definedIn / describedIn
SRS sections → partOf → SRS document
  ↑ tracesTo (BD domain/doc → SRS doc)
BD domain → describedIn → BD sections → partOf → BD document
  ↑ tracesTo (DD → BD)
DD sections → partOf → DD document
  ↓ rendersTo (path-target)
Prototype output files
```

Impact has two distinct directions that should not be mixed in a single BFS:

- **Bottom-up** (part → whole): section change → parent document regenerates
- **Downstream** (dependency → dependent): SRS domain node changes → BD sections that trace to it regenerate

A single BFS conflates these, causing depth counters to be consumed by bottom-up steps before downstream steps can run.

---

## Redesign: Two-pass propagation

### Pass 1 — Expand the change upward

From the origin node, walk structural and anchor edges to find:
- The parent document(s) (via `partOf`)
- The domain nodes anchored to the changed section (via `listedIn`/`definedIn`/`describedIn` inbound)
- Any directly dependent documents (via `dependsOn`)

```
origin: sec.srs.A
  → partOf(out, unbounded)      → doc.srs.X          → regenerate
  → listedIn(in, depth 1)       → UC-01, F-03         → review + seed pass 2
  → definedIn(in, depth 1)      → UC-01               → review + seed pass 2
  → describedIn(in, depth 1)    → UC-01               → review + seed pass 2
  → dependsOn(in, unbounded)    → doc that depends on this → regenerate
```

Output of pass 1:
- `regenerate` set: documents and sections
- `reviewAndSeed` set: domain nodes (used as seeds for pass 2)

### Pass 2 — Propagate downstream from domain nodes

From each domain node found in pass 1, walk downstream to find dependents in lower layers:

```
UC-01 (seed)
  → tracesTo(in, unbounded)   → BD/DD sections that trace to UC-01  → regenerate
  → satisfies(in, depth 1)    → features that satisfy UC-01          → review
  → references(in, depth 2)   → nodes that reference UC-01           → review

BD section found
  → partOf(out, unbounded)    → BD document                          → regenerate
  → tracesTo(in, unbounded)   → DD sections                          → regenerate (cascades)

DD section found
  → partOf(out, unbounded)    → DD document                          → regenerate
```

Pass 2 is fully exhaustive within each edge type — `tracesTo unbounded` correctly cascades SRS → BD → DD.

### Pass 3 — Collect output paths

After both passes, walk `rendersTo` outEdges on every node in the `regenerate` set. Since `rendersTo` targets are file paths (not node ids), they cannot be traversed in BFS but can be read directly:

```typescript
for (const nodeId of regenerateSet) {
  for (const e of g.outEdges.get(nodeId) ?? []) {
    if (e.type === "rendersTo") affectedOutputPaths.add(e.to);
  }
}
```

---

## Rules file (v2)

Replace the flat `edgePropagation` object with two named passes:

```json
{
  "version": 2,
  "pass1_expand": {
    "partOf":      { "direction": "out", "depth": "unbounded" },
    "listedIn":    { "direction": "in",  "depth": 1 },
    "definedIn":   { "direction": "in",  "depth": 1 },
    "describedIn": { "direction": "in",  "depth": 1 },
    "dependsOn":   { "direction": "in",  "depth": "unbounded" }
  },
  "pass2_downstream": {
    "tracesTo":  { "direction": "in",  "depth": "unbounded" },
    "satisfies": { "direction": "in",  "depth": 1 },
    "references":{ "direction": "in",  "depth": 2 },
    "partOf":    { "direction": "out", "depth": "unbounded" }
  },
  "buckets": {
    "regenerate": ["section", "document"],
    "review":     ["useCase", "feature", "requirement", "nfr", "actor", "dataEntity"]
  }
}
```

Removed from v1:
- `derivedFrom` — path-target edge, can't be traversed; handled by pass 3 equivalent
- `relatesTo` — too broad, adds noise without clear causal meaning
- `contains in` — redundant with `partOf out` (both reach the parent document)

---

## New output shape

```typescript
interface ImpactResult {
  origin: { id: string; type: string };

  // Nodes of type section/document that need to be regenerated
  regenerate: ImpactEntry[];

  // Domain nodes that need human review (meaning may have changed)
  review: ImpactEntry[];

  // File paths from rendersTo edges on affected nodes (prototype, templates)
  affectedOutputPaths: string[];

  // Changed files had no matching graph nodes — no doc traceability impact
  noTraceabilityImpact?: boolean;

  // BFS was capped — results may be incomplete
  truncated?: boolean;

  // Which git regions seeded this result (--git mode)
  gitSeeds?: GitSeed[];

  // Which node/file resolved the origin (--file / --heading mode)
  resolvedFrom?: ResolvedOrigin;
}
```

Agents reading this output:
- `regenerate` → run generate skill for each `projectionPath`
- `review` → tell user these domain nodes may need attention
- `affectedOutputPaths` → list prototype/template files to check
- `noTraceabilityImpact: true` → "no doc traceability impact found" — stop, don't regenerate anything
- `truncated: true` → warn user results may be incomplete

---

## Files to change

| File | Change |
|------|--------|
| `schemas/rules.impact.json` | Restructure to v2 two-pass format |
| `src/graph/impact.ts` | Split `computeImpact` into `expandChange` + `propagateDownstream` + `collectOutputPaths`; update `ImpactResult` type |
| `src/commands/graph-impact.ts` | Wire new `computeImpact` signature; surface `affectedOutputPaths` in output |
| `scaffold/cursor/skills/ai-spector-graph/references/impact.md` | Document `affectedOutputPaths` field |
| `scaffold/claude/.claude/skills/ai-spector-graph/skill.md` | Same |
| `tests/graph/impact.test.ts` | Update tests for two-pass behaviour; add cross-layer test cases |

---

## What this fixes

| Scenario | Before | After |
|----------|--------|-------|
| SRS section changes → BD document needs regen | ✗ blocked at depth 1 | ✓ pass 2 `tracesTo unbounded` |
| SRS section changes → DD document needs regen | ✗ | ✓ pass 2 cascades BD → DD |
| Domain node changes → prototype path surfaced | ✗ | ✓ pass 3 `rendersTo` collection |
| `derivedFrom` rule | ✗ silent no-op | ✓ removed |
| `relatesTo` noise | adds unrelated nodes | ✓ removed |
| BFS truncation | silent | ✓ `truncated` flag (already done) |
| Non-doc `--git` diff | ✗ throws error | ✓ `noTraceabilityImpact` (already done) |

## What stays the same

- CLI flags (`--git`, `--file`, `--heading`, `--json`, `-o`)
- Seed resolution logic (`resolve.ts`) — unchanged
- `mergeImpactResults` for multi-seed `--git` mode — minor update to merge `affectedOutputPaths`
- Output field names `regenerate` / `review` — agents don't need to change

---

## Backwards compatibility

The `regenerate` and `review` arrays keep their shape. Existing agent skills reading those fields continue to work. The only additions are `affectedOutputPaths` (new field, agents can ignore if not present) and removal of `relatesTo`/`derivedFrom` results (which were noise or dead).

Rules file version bumps from 1 → 2. `loadImpactRules` should validate the version and error clearly if an old rules file is found.
