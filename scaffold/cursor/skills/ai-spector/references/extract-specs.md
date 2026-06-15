# Extract specs (stage 6 — feed output back, with review)

After a successful generate run, harden the shared context: extract key specs
from the written documents and queue them for human review. Approved specs
merge to the graph; `docs/data-source/` stays purely human-authored —
**derived specs are never written there**.

## Flow

1. **Extract** — from the documents just written, pull key specs: decisions,
   constraints, identifiers, NFR thresholds. One clear statement each, with the
   file(s) it came from.
2. **Ask** — "I extracted these N key specs from the generated docs. Queue them
   for review?" Show the list. Skip silently if nothing meaningful was produced.
3. **Record** — on yes: `spec_record({ docType, specs: [{ statement,
   extractedFrom, patch? }] })`. Each spec lands `pending` in
   `.ai-spector/.docflow/extracted/<docType>.json`.
   - `patch` is an optional graph patch (`{ version: 1, nodes, edges }`) applied
     only on approval. Domain nodes must anchor to an **existing** document via
     `definedIn`/`listedIn` — unanchored nodes fail merge validation.
4. **Review** — the user approves or rejects, now or later:

| Action | MCP | CLI |
|--------|-----|-----|
| List queue | `spec_list({ docType?, status? })` | `npx ai-spector spec list [docType] [--status s]` |
| Approve (merges patch, validated) | `spec_approve({ docType, id, by? })` | `npx ai-spector spec approve <docType> <id>` |
| Reject (kept for audit, never merged) | `spec_reject({ docType, id, note? })` | `npx ai-spector spec reject <docType> <id> [--note …]` |

**Not** document sign-off (`review_approve` / `ai-spector-review`) — specs are extracted
decisions from generated docs; formal doc approval is a separate two-track workflow.

On approval the patch is also written beside the store
(`extracted/<docType>.<id>.patch.json`) as an audit trail, then merged with
`graph merge --validate`. Re-approving an approved spec is an error.

## Agent rules

- Never merge a spec's patch directly with `graph_merge` — always go through
  the queue so the human gate is preserved.
- Never write extracted content into `docs/data-source/`.
- After approvals, run `npx ai-spector index` so the graph and doc indexes pick
  up the merged nodes.

## Task gate (mandatory before task_complete)

After offering extraction (even if the user declines or there is nothing to queue):

```
task_update({
  patch: {
    snapshot: { extractOffered: true },
    step: { id: "extract", patch: { status: "done" } }
  }
})
```

`task_complete` is rejected while extract is `pending` or `in-progress` without
`snapshot.extractOffered`. This ensures every generate session surfaces the review
queue — users can approve later via `spec_list` / `spec_approve`.
