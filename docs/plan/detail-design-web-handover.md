# Detail Design — Web Handover

> **Audience:** Web team building the documentation browser / review UI (release branch).
> **Your job:** List, navigate, and render detail design markdown — same as SRS and basic design.
> **Not your job:** Generate detail design, edit markdown on release branch, graph merge, or agent workflows.

**Backend status (ai-spector):** Detail design reached parity with SRS / basic design in commit `ec947ee` — registry, index, review discovery, and graph extraction are wired. If the web already shows `srs/` and `basic-design/`, extend the same patterns for `detail-design/`.

**Spec / plan:** [`docs/superpowers/specs/2026-06-17-detail-design-parity-design.md`](../superpowers/specs/2026-06-17-detail-design-parity-design.md) · [`docs/superpowers/plans/2026-06-17-detail-design-parity.md`](../superpowers/plans/2026-06-17-detail-design-parity.md)

---

## 1. What to show in the UI

| Layer | User-facing label | Logical prefix | On disk |
|-------|-------------------|----------------|---------|
| SRS | Requirements | `srs/` | `docs/srs/` |
| Basic design | Basic design | `basic-design/` | `docs/basic-design/` |
| **Detail design** | **Detail design** | **`detail-design/`** | **`docs/detail-design/`** |

Detail design is the **third documentation layer**: implementation-level specs per feature, plus shared “common” chapters (architecture, security, error handling, etc.).

```text
Pipeline (for context only — web is read-only):

SRS → basic design → detail design → prototype
```

---

## 2. On-disk layout

All paths are **repo-relative**. Language subfolders follow `docflow.config.json` → `languages[]` (same as SRS/BD).

```text
docs/detail-design/
  {lang}/                          # e.g. en/, vi/
    common/
      architecture-overview.md
      security-patterns.md
      error-handling-patterns.md
      performance-standards.md
      integration-patterns.md
      deployment-infrastructure.md
    feature-list.md
    features/
      f-01-{slug}.md               # one file per F-xx feature
      f-02-{slug}.md
      ...
```

| File kind | Example logical path | Example `docPath` (en) |
|-----------|---------------------|-------------------------|
| Common chapter | `detail-design/common/security-patterns` | `docs/detail-design/en/common/security-patterns.md` |
| Feature list | `detail-design/feature-list` | `docs/detail-design/en/feature-list.md` |
| Per-feature detail | `detail-design/features/f-01-checkout` | `docs/detail-design/en/features/f-01-checkout.md` |

**Aliases:** Users/agents may say `dd/…` instead of `detail-design/…` — normalize to `detail-design/` in URLs and API.

---

## 3. Resolving `logicalPath` → file (language)

Reuse the **same resolver** as SRS and basic design. Do not hard-code `en/` only.

**Algorithm** (matches `resolveReviewDocPath` in ai-spector):

1. Flat path: `docs/detail-design/{rest}.md` from logical `detail-design/{rest}`
2. If missing → `docs/detail-design/{preferredLang}/{rest}.md`
3. Else → primary language subfolder
4. Else → first other configured language that exists

```typescript
function logicalPathToFlatDocPath(logicalPath: string): string | null {
  const p = logicalPath.replace(/^\/+|\/+$/g, "").replace(/\.md$/, "");
  if (p.startsWith("dd/")) return `docs/detail-design/${p.slice(3)}.md`;
  if (p.startsWith("detail-design/")) return `docs/detail-design/${p.slice("detail-design/".length)}.md`;
  return null;
}

async function resolveDetailDesignDocPath(
  projectRoot: string,
  logicalPath: string,
  preferredLang: string,
  languages: string[],
): Promise<string> {
  const flat = logicalPathToFlatDocPath(logicalPath);
  if (!flat) throw new Error("Not a detail-design path");

  const candidates = [
    flat,
    flat.replace("docs/detail-design/", `docs/detail-design/${preferredLang}/`),
    ...languages
      .filter((l) => l !== preferredLang)
      .map((l) => flat.replace("docs/detail-design/", `docs/detail-design/${l}/`)),
  ];

  for (const rel of candidates) {
    if (await fileExists(join(projectRoot, rel))) return rel;
  }
  throw new Error(`Document not found for ${logicalPath}`);
}
```

**Registry shortcut:** If you already have `registry.json` from the review pipeline, use **`docPath` on each document** — it is the canonical path discovered at index/reconcile time. Prefer `docPath` over re-resolving when present.

---

## 4. Data sources for listing documents

### A. Review registry (recommended for review UI)

Same as SRS / basic design — `discoverReviewableDocs` already walks `docs/detail-design/`.

```
.ai-spector/.docflow/review-queue/registry.json
```

Each entry (when present):

```json
{
  "detail-design/common/security-patterns": {
    "logicalPath": "detail-design/common/security-patterns",
    "docPath": "docs/detail-design/en/common/security-patterns.md",
    "contentHash": "a1b2c3d4e5f67890",
    "overallStatus": "pending_internal",
    "internal": { "status": "pending", "votes": [] },
    "client": { "status": "pending", "votes": [] }
  },
  "detail-design/features/f-01-checkout": {
    "logicalPath": "detail-design/features/f-01-checkout",
    "docPath": "docs/detail-design/en/features/f-01-checkout.md",
    "contentHash": "…",
    "overallStatus": "pending_internal"
  }
}
```

| UI | Field |
|----|--------|
| Sidebar / doc list | Keys or `logicalPath` — group by prefix |
| Markdown body | Read file at `docPath` |
| Review actions | Same vote/withdraw/close flow as [`review-system-handover.md`](./review-system-handover.md) |
| Staleness | Compare live file hash to `contentHash` |

**Pending queue:** Jobs use id `"{logicalPath}:internal"` / `":client"` — e.g. `detail-design/feature-list:internal`.

### B. Document index (browse / search without review)

```
.ai-spector/index/detail-design.md
```

Generated by `npx ai-spector index`. Each entry has:

- `location` — repo-relative path
- `summary` — first heading line
- `metadata` — `graphNodeId=doc.dd.*` when indexed

Use for **flat file list** or search; use **registry** when review status matters.

### C. Walk disk (fallback)

Glob `docs/detail-design/**/*.md`, map to logical paths:

- Strip `docs/`
- Strip `.md`
- Strip language segment if it matches `docflow.config.json` languages
- Prefix must become `detail-design/…`

Reference: `docRelPathToLogicalPath()` in `src/core/reviews/discover.ts`.

---

## 5. Suggested navigation tree

```text
Detail design
├── Common
│   ├── Architecture overview
│   ├── Security patterns
│   ├── Error handling
│   ├── Performance standards
│   ├── Integration patterns
│   └── Deployment & infrastructure
├── Feature list          ← index table links to features/*
└── Features
    ├── F-01 Checkout
    ├── F-02 Login
    └── …
```

**Sort:** `common/*` in template order (see table below); `features/*` by `F-xx` numeric id from filename.

| Logical path suffix | Display title (from file) |
|---------------------|---------------------------|
| `common/architecture-overview` | `# Architecture Overview` |
| `common/security-patterns` | `# Security Patterns` |
| `common/error-handling-patterns` | `# Error Handling Patterns` |
| `common/performance-standards` | `# Performance Standards` |
| `common/integration-patterns` | `# Integration Patterns` |
| `common/deployment-infrastructure` | `# Deployment and Infrastructure` |
| `feature-list` | `# Detail Design: Feature List` |
| `features/f-{nn}-{slug}` | `# Detail Design: …` or `**Feature Name:**` |

**Cross-links in markdown:** Feature detail files link to `../../basic-design/...` and `../common/...`. Render as normal relative links; resolve against `docPath` directory.

---

## 6. Graph IDs (optional — traceability panel)

If the UI shows “linked requirements” or graph badges:

| Graph node | Meaning |
|------------|---------|
| `doc.dd.feature-list` | Feature list chapter |
| `doc.dd.architecture-overview`, `doc.dd.security-patterns`, `doc.dd.error-handling`, `doc.dd.performance-standards`, `doc.dd.integration-patterns`, `doc.dd.deployment` | Common chapter anchors |
| `doc.dd.f-01` | Per-feature detail document instance (expanded from feature list) |
| `doc.dd.detail-feature` | Template id for per-feature docs (manifest); instances are `doc.dd.f-*` |
| `F-01` | Domain feature node (`tracesTo` from detail doc) |

Index metadata may include `graphNodeId=doc.dd.f-01`. Full graph is in `.ai-spector/graph/traceability.graph.json` — only needed for advanced traceability UI, not for basic markdown display.

---

## 7. Doc type / filters

| Check | Value |
|-------|--------|
| `docTypeFromLogicalPath(path)` | `"detail-design"` when path starts with `detail-design/` or `dd/` |
| Review custom checklists | `.ai-spector/.docflow/config/review-checklists/detail-design/` (if present) |
| Completeness rules | `.ai-spector/.docflow/config/doc-types/detail-design/completeness-rules.json` |

Filter chips example: **All · SRS · Basic design · Detail design**.

---

## 8. What you build vs omit

| Build | Omit |
|-------|------|
| Third nav section “Detail design” | `task_approve_plan`, generate gates, DAG waves |
| List from registry and/or index | Writing `docs/detail-design/**` on release branch |
| Render markdown at `docPath` | `graph merge`, `readiness_assess` |
| Review quorum UI (if in scope) | Agent skills / `dd-context` guides |
| Language fallback resolver | Parsing `knowledge.json` for content |

---

## 9. Edge cases

| Case | Handling |
|------|----------|
| No `docs/detail-design/` yet | Empty section; pipeline not run |
| Flat layout (no `{lang}/`) | Try flat path first in resolver |
| `logicalPath` without language in URL | Always resolve via `docPath` or language fallback |
| Feature list not generated | Show common chapters only; Features folder empty |
| Missing registry entry but file on disk | Show in browse mode; prompt ops to run review discovery / index |
| `dd/features/f-01` alias | Normalize to `detail-design/features/f-01` |

---

## 10. Smoke test (release bundle)

1. Confirm files exist under `docs/detail-design/{lang}/`.
2. Open `detail-design/feature-list` → markdown table with `F-xx` rows.
3. Open `detail-design/features/f-01-*` → long feature spec with links to basic design.
4. Open `detail-design/common/security-patterns` → common chapter.
5. If review enabled: registry contains keys prefixed `detail-design/`; vote flow matches SRS handover.

**CLI (ops, not web):**

```bash
npx ai-spector index                    # refreshes .ai-spector/index/detail-design.md
npx ai-spector review check             # lists reviewable docs including detail-design
```

---

## 11. Related handovers

| Doc | Use when |
|-----|----------|
| [`review-system-handover.md`](./review-system-handover.md) | Vote, quorum, registry, pending queue |
| [`../prototype/url-mapping-handover.md`](../prototype/url-mapping-handover.md) | Prototype screen links (downstream of detail design) |

---

## 12. Checklist for web PR

- [ ] Nav includes **Detail design** alongside SRS and Basic design
- [ ] List discovers `detail-design/*` logical paths (registry or index or disk walk)
- [ ] `docPath` resolution supports `{lang}/` subfolders
- [ ] Markdown renderer handles mermaid / tables in feature detail templates
- [ ] Review UI accepts `detail-design/…` logical paths (if review in scope)
- [ ] URL alias `dd/` → `detail-design/` normalized
- [ ] Empty state when no detail design files in release bundle
