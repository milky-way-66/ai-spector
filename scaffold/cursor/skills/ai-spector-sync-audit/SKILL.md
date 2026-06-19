---
name: ai-spector-sync-audit
description: >-
  Proactive design-layer drift audit against an explicit sync baseline.
  Use when the user asks for sync audit, check doc drift, what changed since
  baseline, or layer sync across SRS, basic design, and detail design.
  Do NOT use for document sign-off (ai-spector-review — "since approval"),
  uncommitted-only impact (graph_impact --git), or translation queue status
  (ai-spector-lang-status).
paths:
  - "docs/srs/**"
  - "docs/basic-design/**"
  - "docs/detail-design/**"
  - ".ai-spector/.docflow/sync/**"
---

# AI Spector — Layer Sync Audit

Compare live SRS, basic-design, and detail-design files against the last
`sync snapshot` baseline. Report hash drift, git diffs, graph impact buckets,
and traceability gaps — then hand off to resolve-task or generate skills.

**Related but different:** `ai-spector-review` answers "what changed since last
**approval**" per document. This skill answers "what changed since last **layer
sync baseline**" across all design roots.

## Required reading

[references/runbook.md](references/runbook.md) — follow all phases in order.

## Natural language

"sync audit", "check doc drift", "what changed since baseline", "layer sync",
"are SRS and basic design still aligned", "design layers out of sync".
