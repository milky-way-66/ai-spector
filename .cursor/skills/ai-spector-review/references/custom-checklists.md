# Custom review checklists — user guide

Extend document sign-off by dropping JSON files under:

```
.ai-spector/.docflow/config/review-checklists/
```

Custom items are **merged automatically** with built-in ISO readiness criteria when the agent
calls `review_status` or `readiness_output_checklist`. No code changes required.

## Quick start

1. Create a folder for your doc type, e.g. `review-checklists/srs/_all/`
2. Copy the sample: `srs/_all/security-gates.json.example` → `srs/_all/security-gates.json`
3. Edit items (id, severity, question, agentCheck)
4. Run `/review` — the agent scores your items in the **Readiness compliance** table

## Folder layout

```
review-checklists/
  README.md
  srs/
    _all/                      ← every SRS document
      security-gates.json
      style-guide.json
    01-overview.json           ← only srs/01-overview
    1-introduction.json        ← only srs/1-introduction
  basic-design/
    _all/
      api-conventions.json
  detail-design/
    _all/
      coding-standards.json
```

| Location | Applies to |
|----------|------------|
| `<docType>/_all/*.json` | **All** documents of that type |
| `<docType>/<doc-stem>.json` | **One** document (stem matches logical path suffix) |
| `review-checklists/*.json` with `match` | Pattern / glob filter (any doc type) |

### Doc type folders

| Folder | docType |
|--------|---------|
| `srs/` | SRS documents |
| `basic-design/` | Basic design |
| `detail-design/` | Detail design |

## Checklist file format

```json
{
  "version": 1,
  "title": "Security review gates",
  "description": "Optional note for the review agent",
  "items": [
    {
      "id": "SEC-001",
      "severity": "blocking",
      "question": "Are threat actors and mitigations documented?",
      "agentCheck": "Look for named threat actors (or abuse cases) and corresponding controls"
    },
    {
      "id": "SEC-002",
      "severity": "should-ask",
      "question": "Is data classification stated for sensitive fields?"
    }
  ]
}
```

### Fields

| Field | Required | Description |
|-------|----------|-------------|
| `id` | yes | Unique within the file (shown in compliance table) |
| `severity` | yes | `blocking` \| `should-ask` \| `nice-to-have` |
| `question` | yes | What the reviewer checks |
| `agentCheck` | no | Extra prompt for the agent (defaults to `question`) |
| `iso29148` | no | ISO section ref (display only) |
| `heading` / `field` | no | Hint where to look in the document |

### Pattern matching (`match`)

For files at the `review-checklists/` root, or when one file should cover several paths:

```json
{
  "title": "Feature security",
  "match": {
    "logicalPaths": ["srs/features/**", "srs/3-*"],
    "docPaths": ["**/features/**"]
  },
  "items": [ ... ]
}
```

Patterns: `*` within a path segment, `**` across `/`.

Examples:

| Pattern | Matches |
|---------|---------|
| `srs/01-*` | `srs/01-overview`, `srs/01-scope` |
| `**/features/**` | `docs/srs/en/features/F-01.md` |
| `srs/features/**` | logical path `srs/features/F-01` |

## Severity during review

| Severity | Agent behavior |
|----------|----------------|
| `blocking` | partial/missing → **Concerns**; recommend Request changes |
| `should-ask` | Note in compliance table; may approve with note |
| `nice-to-have` | Optional note only |

## Template files

- Files named `*.example` or prefixed with `_` (except `_all.json`) are **ignored**
- Keep samples as `security-gates.json.example`; activate by copying without `.example`

## What the agent sees

In `review_status.readiness.outputChecklist`, custom items include:

- `source: "custom"`
- `checklistFile` — which JSON file they came from
- `checklistTitle` — optional title from the file

Score them **met | partial | missing** alongside built-in criteria. See
[readiness-compliance.md](./readiness-compliance.md) for the report template.

## Related

- Built-in ISO criteria: `.ai-spector/.docflow/config/doc-types/<docType>/readiness-criteria.json`
- Generate-time output compliance: [output-compliance.md](../../ai-spector/references/output-compliance.md)
- Review runbook: [runbook.md](./runbook.md)
