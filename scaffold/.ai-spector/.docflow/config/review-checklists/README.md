# Custom review checklists

Drop JSON files here to extend what the review agent checks during document sign-off.
Custom items merge with built-in ISO readiness criteria in `review_status` and
`readiness_output_checklist`.

**Full guide (agents + users):** `.cursor/skills/ai-spector-review/references/custom-checklists.md`
(after `npx ai-spector sync-cursor` or init).

## Quick start

```bash
# 1. Copy the sample
cp srs/_all/security-gates.json.example srs/_all/security-gates.json

# 2. Edit items in security-gates.json

# 3. Run /review — agent scores custom items in Readiness compliance table
```

## Folder layout

```
review-checklists/
  srs/
    _all/                    ← every SRS document
      security-gates.json
    01-overview.json         ← only srs/01-overview
  basic-design/
    _all/
      api-style.json
```

| Location | Applies to |
|----------|------------|
| `<docType>/_all/*.json` | All documents of that type |
| `<docType>/<doc-stem>.json` | One document |
| Root `*.json` with `match` | Glob patterns |

## Minimal file format

```json
{
  "version": 1,
  "title": "Security review gates",
  "items": [
    {
      "id": "SEC-001",
      "severity": "blocking",
      "question": "Are threat actors and mitigations documented?",
      "agentCheck": "Look for named actors and corresponding controls"
    }
  ]
}
```

Severity: `blocking` | `should-ask` | `nice-to-have`.

Files named `*.example` or prefixed with `_` (except `_all.json`) are ignored.
