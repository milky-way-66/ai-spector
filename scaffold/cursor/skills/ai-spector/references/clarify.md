# Clarify (stage 2 — resolve ALL gaps before generating)

The clarify stage finds **every** piece of missing or ambiguous information for
the target doc type and resolves it with the user before generation starts.
There is **no question cap** and nothing is silently deferred.

## Compute the gap set

Union of three sources:

1. **Completeness rules** — `completeness-rules.<docType>.json` required
   sections/fields; reframe each missing field as an open question.
2. **Graph coverage** — DAG seed nodes that resolve to empty (no actors for §2,
   no `F-xx` for feature details, no endpoints for the API list…) become
   questions.
3. **Context store** — previously recorded entries with status `open` or
   `stale` for this doc type: `context_list({ docType, status: "open" })` and
   `status: "stale"`. Answered entries are **not re-asked**.

## Resolve every gap

Each gap must end in one of two states before stage 5 may run:

- **Answered** — the user gave an answer.
- **Accepted assumption** — the user explicitly approved the agent's stated
  assumption.

Generation is blocked until the whole gap set is in one of those states.

Rules:
- Group questions logically (by section/scope) for readability.
- Store each answer **immediately** via `context_record` /
  `context_resolve` ([context-store.md](./context-store.md)) — an interrupted
  session keeps its progress.
- Stale entries (source file changed since the answer): show the old answer and
  what changed, ask the user to re-confirm or update; `context_resolve`
  refreshes the entry.
- Accepted assumptions are recorded too (`source: "inferred"`, answer = the
  assumption text) so future runs know they were user-approved.

## Output

A short summary feeding the context briefing
([plan-and-briefing.md](./plan-and-briefing.md)):

```
Clarified this run: Q-004, Q-007 (answers stored)
Re-confirmed stale: Q-001
Accepted assumptions: Q-009 — payment retry = 3 attempts
```
