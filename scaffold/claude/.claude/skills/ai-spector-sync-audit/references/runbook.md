# Layer Sync Audit — Agent Runbook

Proactive audit: detect which design-layer files changed since the user last
recorded a sync baseline, attach git diffs and graph impact hints, then plan
cross-layer updates with the user.

**Routing:** Baseline drift uses `sync_audit` / `sync snapshot` only — not
`review_status` (per-doc approval), `graph_impact --git` (uncommitted only), or
`adopt_scan` (migration). See [_skill-router.md](./_skill-router.md).

Storage: `.ai-spector/.docflow/sync/baseline.json` (per-file hashes, graph hash,
`gitRef` from snapshot time).

---

## MCP tools vs CLI

| Operation | MCP tool | CLI fallback |
|-----------|----------|--------------|
| **Run audit (preferred)** | `sync_audit({})` | `npx ai-spector sync audit --json` |
| Record / re-baseline | `sync_snapshot({ label?, force: true })` | `npx ai-spector sync snapshot --label <name> --force` |
| Refresh graph before impact | `index({})` | `npx ai-spector index` |

CI gate: `sync_audit({ failOnDrift: true })` or `npx ai-spector sync audit --fail-on-drift --json`.

---

## Usage triggers

| User says | Agent does |
|-----------|------------|
| "sync audit", "check doc drift", "layer sync" | Phase 1 — run audit, present results |
| "what changed since baseline" | Phase 1 — audit; **not** `review_status` (that is since approval) |
| "re-baseline", "layers are aligned again" | Phase 5 — `sync_snapshot` after user confirms |
| No baseline yet | Tell user to run `sync snapshot` when layers are aligned |

---

## Phase 1 — Run audit

**MCP (preferred):**

```
sync_audit({})
```

**CLI fallback:**

```bash
npx ai-spector sync audit --json
```

Handle errors:

| Situation | Agent response |
|-----------|----------------|
| No baseline (exit 2) | "No sync baseline — run `sync snapshot` when SRS, BD, and DD are aligned." |
| Graph missing | "Run `index` first, then retry sync audit." |
| `warnings` in result | List warnings; hash drift still valid |

---

## Phase 2 — Aligned shortcut

If `drift.hasDrift === false` **and** all `traceabilityGaps` arrays are empty:

> Design layers are aligned with baseline `{baseline.label || baseline.createdAt}`.
> No file or graph drift; no traceability gaps.

Stop unless the user wants a fresh snapshot or deeper review.

---

## Phase 3 — Present drift by layer

For each layer in `drift.byLayer` (`srs`, `basic-design`, `detail-design`),
show a table when any bucket is non-empty:

| Layer | Modified | Added | Deleted | Unchanged |
|-------|----------|-------|---------|-----------|
| basic-design | 2 | 0 | 0 | 14 |

**Modified files** — include diff summary from each entry:

- `linesAdded` / `linesRemoved` when present
- `diffSource: "git"` — offer to show full `diff` on request
- `diffSource: "none"` — hash drift only (no git ref or binary)

**Added / deleted** — list `path` only; no invented content.

If `drift.graphChanged`, call out: graph hash differs from baseline — run
`index` after doc updates before re-baselining.

---

## Phase 4 — Present impact and gaps

### Impact buckets (from audit JSON only)

Present `impact.regenerate`, `impact.syncUpstream`, and `impact.review` as
separate lists. Use **`projectionPath`** and **`reason`** from each entry.

**Guardrail — never invent paths:** Only list paths returned in the audit
`impact` arrays. Do not guess downstream SRS/BD/DD files from filenames or
domain knowledge. Semantic alignment judgment comes **after** reading git diffs
for modified files, not from invented regenerate lists.

When `impact.noTraceabilityImpact` is true for seeds with no graph linkage,
say so explicitly.

### Traceability gaps

If any of `traceabilityGaps.missingDownstream`, `missingUpstream`, or
`orphanFiles` is non-empty, present them in a table:

| Kind | Domain / file | Message |
|------|---------------|---------|
| missingDownstream | `domainId` | `message` |

---

## Phase 5 — Offer remediation

After presenting drift, impact, and gaps, ask the user how to proceed:

1. **`ai-spector-resolve-task`** (Standard) — incremental updates for specific
   changed paths or impact bucket entries the user selects.
2. **`ai-spector-generate-*`** — for `impact.regenerate` entries when bulk
   chapter regeneration is appropriate (same gates as generate workflow).

Read git diffs for modified files before proposing what to update. The agent
judges semantic alignment; the audit JSON supplies **which** paths the graph
flags, not **how** to rewrite them.

Do not start writes until the user confirms the plan.

---

## Phase 6 — Re-baseline after updates

When the user confirms layers are aligned again:

1. Refresh the graph:

```
index({})                    # MCP preferred
npx ai-spector index         # CLI fallback
```

2. Overwrite baseline:

```
sync_snapshot({ force: true, label: "<optional label>" })
```

CLI: `npx ai-spector sync snapshot --force --label post-remediation`

3. Verify clean state:

```
sync_audit({})
```

Expect `drift.hasDrift === false`. Report success to the user.

---

## Output format

1. Baseline summary (`createdAt`, `label`, `gitRef`, file count)
2. Drift tables by layer (or "aligned" shortcut)
3. Impact buckets — paths from JSON only
4. Traceability gaps (if any)
5. `suggestedNext` from audit result
6. Offer: resolve-task, generate-*, or re-baseline

Never dump raw JSON unless the user asks.
