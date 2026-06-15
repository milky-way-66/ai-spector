# Custom review checklists

Drop JSON files here to extend what the review agent checks during document sign-off.
Custom items are merged with built-in ISO readiness criteria in `review_status` and
`readiness_output_checklist`.

## Folder layout

```
review-checklists/
  srs/
    _all/                    ← applies to every SRS document
      security-gates.json
    01-overview.json         ← only srs/01-overview (filename = doc stem)
    1-introduction.json      ← only srs/1-introduction
  basic-design/
    _all/
      api-style.json
  detail-design/
    _all/
      coding-standards.json
```

Optional: JSON files directly under `review-checklists/` with a `match` block for
cross-type or glob patterns.

## File format

```json
{
  "version": 1,
  "title": "Security review gates",
  "description": "Optional note shown to the agent",
  "items": [
    {
      "id": "SEC-001",
      "severity": "blocking",
      "question": "Are threat actors and mitigations documented?",
      "agentCheck": "Look for a threat/risk subsection with named actors and controls"
    }
  ]
}
```

### Optional `match` (pattern-based)

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

Patterns use `*` (within segment) and `**` (across `/`).

### Severity

| Value | Meaning |
|-------|---------|
| `blocking` | Flag in review Concerns; recommend Request changes if partial/missing |
| `should-ask` | Note in compliance table |
| `nice-to-have` | Optional note |

## Samples

- `_all/security-gates.json.example` — copy to `_all/security-gates.json` and edit
- Files prefixed with `_` (except `_all.json`) are ignored — use for templates

## During review

The agent scores each item **met | partial | missing** and includes custom items
(source `custom`, with `checklistFile`) in the Readiness compliance table.
