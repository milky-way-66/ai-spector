# Output compliance (agent-driven — after GENERATE)

Semantic compliance is **not** scored by code. After each wave the agent:

1. Runs **structural** checks (`readiness_scan`)
2. Loads a **rubric** (`readiness_output_checklist`)
3. **Reads** each written file and judges met / partial / missing
4. **Reports** to the user before `task_record_wave`

This closes Gap E without a semantic engine in core.

## Three layers (recap)

| Layer | Tool | Who judges | Question |
|-------|------|------------|----------|
| Input | `readiness_assess` | Code (graph/context) | Enough context to write? |
| Structure | `readiness_scan` | Code (headings, placeholders) | File shape valid? |
| **Semantic** | `readiness_output_checklist` + **agent** | **Agent reads body** | Content covers ISO criteria? |

## Per-wave workflow (mandatory)

```
readiness_scan({ paths: [artifacts], updateLastScan: false })
readiness_output_checklist({ paths: [artifacts], docType: "srs" })
→ Read each path from disk
→ For each checklist item, score met | partial | missing with a short evidence quote
→ Present "Output compliance" table to the user
→ Fix blocking partial/missing in file, OR context_record assumption + user accept
→ task_record_wave
```

## MCP tools

```
readiness_output_checklist({
  docType: "srs",
  paths: [
    "docs/srs/en/1-introduction.md",
    "docs/srs/en/2-overall-description.md"
  ]
})
```

Returns per path:

- `dagNode` — mapped from `dag.*.json`
- `iso29148Sections` — from `templateToIso29148` in criteria file
- `items[]` — `criterionId`, `iso29148`, `severity`, `agentCheck` (what to verify in prose)

Compare planned coverage from the approved plan (`criteriaIds` / `isoRefs` on each row).

## Report template (show user)

```
Output compliance — wave 1

File: docs/srs/en/2-overall-description.md (DAG: srs.overall-description)
ISO sections: 9.6.4–9.6.9

| ID | ISO | Severity | Status | Evidence / gap |
|----|-----|----------|--------|----------------|
| §2-003 | 9.6.6 | blocking | met | §2.5 lists 3 assumptions with owners |
| §2-004 | 9.6.7 | blocking | partial | Operational concept mentions actors but no main success flow |
| G-004 | 5.2.2 | should-ask | met | User classes described in §2.3 |

Blocking partial: 1 — fix now / accept assumption?
```

## Scoring rules (agent)

| Status | When |
|--------|------|
| **met** | Section or prose clearly addresses the criterion; a reviewer could find it without guessing |
| **partial** | Topic mentioned but thin, incomplete, or missing a required sub-aspect (field, heading, table) |
| **missing** | No substantive coverage; heading exists but body empty does **not** count as met |

Use `severity` from the checklist:

- **blocking** partial/missing → fix or recorded assumption before next wave
- **should-ask** → report; user may defer
- **nice-to-have** → note only

For FR/NFR detail files (`features/F-*.md`, `UC-*.md`), also apply `requirementQuality` RQ-01…RQ-09 from the checklist when present.

## When input assess disagrees with output

`readiness_assess` may show **missing** while the file already has content (graph-empty but prose written). **Trust the output compliance pass** for written artifacts; optionally re-run `readiness_assess` after graph merge/index if traceability was updated.

## Anti-patterns

- Skip output table because `readiness_scan` passed
- Mark all items `met` without reading the file
- Use `readiness_assess` alone to claim ISO §9.6 compliance on generated files
- Hide partial blocking items — always show the table before `task_record_wave`

## Related

- [generate-workflow.md](./generate-workflow.md) — wave checklist
- [plan-and-briefing.md](./plan-and-briefing.md) — planned `criteriaIds` / `isoRefs`
- [context-readiness.md](./context-readiness.md) — input-side assess
