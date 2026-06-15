# Context store — clarification persistence

One store per doc type at `.ai-spector/.docflow/context/<docType>.json`.
This is what lets a run months later "check back": which assumptions were
user-confirmed vs inferred, and which sources have since changed.

## Entry shape

```jsonc
{
  "id": "Q-001",
  "question": "Which auth providers must login support?",
  "answer": "Google + email/password. No SSO in v1.",
  "status": "answered",                  // open | answered | stale
  "scope": "srs.use-cases",              // DAG node / section this informs
  "source": "user",                      // user | inferred | data-source
  "sourceRefs": ["docs/data-source/auth-notes.md"],
  "answeredAt": "2026-06-12T...",
  "answeredBy": "khang"
}
```

## Surfaces

| Action | MCP | CLI |
|--------|-----|-----|
| List (filter by docType/status) | `context_list({ docType?, status? })` | `npx ai-spector context list [docType] [--status s]` |
| Record question (+ optional answer in one step) | `context_record({ docType, question, answer?, scope?, sourceRefs?, answeredBy? })` | `npx ai-spector context record …` |
| Answer an open/stale entry | `context_resolve({ docType, id, answer, answeredBy? })` | `npx ai-spector context resolve …` |

## Agent rules

- **Always set `sourceRefs`** when an answer is grounded in files — staleness
  detection depends on it.
- Record the human's name in `answeredBy` when known.
- Accepted assumptions: `source: "inferred"`, answer = the assumption text.
- Never edit the JSON by hand; use the tools so ids and timestamps stay valid.

## Staleness (automatic)

`npx ai-spector index` compares each answered entry's `sourceRefs` mtimes
against `answeredAt`; if a ref changed (or was deleted) after the answer, the
entry flips to `stale`. `workspace_check` rule CTX-001 lists stale Q-ids. The
next generate run re-asks **only** the stale questions
([clarify.md](./clarify.md)); `context_resolve` makes them current again.
