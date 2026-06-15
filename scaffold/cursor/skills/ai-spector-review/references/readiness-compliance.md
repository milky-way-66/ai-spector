# Readiness compliance during document review

Document sign-off must verify **structure** and **semantic coverage** against the
active readiness profile — not just diff and graph impact.

`review_status` returns a `readiness` block when the logical path maps to a known doc type:

- `readiness.structuralScan` — automated findings (headings, TODO/TBD, empty sections)
- `readiness.outputChecklist` — rubric items the agent scores by reading the file body

If `readiness` is missing (unknown doc type or config error), call tools manually:

```
readiness_scan({ paths: [docPath], docType: "<type>", updateLastScan: false })
readiness_output_checklist({ paths: [docPath], docType: "<type>" })
```

## Doc type from logical path

| Logical path prefix | docType |
|---------------------|---------|
| `srs/…` | `srs` |
| `basic-design/…` or `bd/…` | `basic-design` |
| `detail-design/…` or `dd/…` | `detail-design` |

## Scoring rules (agent)

| Status | When |
|--------|------|
| **met** | Section or prose clearly addresses the criterion; a reviewer could find it without guessing |
| **partial** | Topic mentioned but thin, incomplete, or missing a required sub-aspect |
| **missing** | No substantive coverage; heading exists but body empty does **not** count as met |

Use `severity` from each checklist item:

- **blocking** partial/missing → flag in **Concerns**; recommend Request changes unless user accepts assumption
- **should-ask** → note in compliance table; may approve with note
- **nice-to-have** → note only

Structural scan **errors** (not warnings) should also appear in **Concerns**.

## Report template (include in Phase 4 review)

```
**Readiness compliance**

Structural scan: <ok | N errors, M warnings>
<D-list structural findings with severity error/warning, or "No structural issues.">

| ID | ISO | Severity | Status | Evidence / gap |
|----|-----|----------|--------|----------------|
| §2-003 | 9.6.6 | blocking | met | §2.5 lists 3 assumptions with owners |
| §2-004 | 9.6.7 | blocking | partial | Operational concept mentions actors but no main success flow |

Blocking partial/missing: <count> — <recommendation>
```

## Relationship to generate workflow

Same rubric as [output-compliance.md](../../ai-spector/references/output-compliance.md) used after GENERATE.
During **review**, re-run compliance on the current file — content may have changed since generation.

## Anti-patterns

- Skip checklist because diff looks fine
- Mark all items `met` without reading the document
- Approve when blocking partial/missing items exist without noting them in Concerns
- Use `readiness_assess` (input-side) to claim output ISO compliance — use output checklist instead
