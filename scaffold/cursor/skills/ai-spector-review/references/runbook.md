# Document Review & Approval

Two-track sequential workflow: **internal approval first**, then **client approval** (done via web app). This runbook covers the internal track — what the agent handles.

Storage is git-backed under `reviews/`. No Writer API.

## MCP tools vs CLI

| Operation | MCP tool | CLI fallback |
|-----------|----------|--------------|
| Detect changed documents | `review_check({})` | `npx ai-spector review check --json` |
| Show review queue | `review_queue({ track, showDiff })` | `npx ai-spector review queue --track internal --json` |
| Show single doc status + diff | `review_status({ logicalPath, showDiff: true })` | `npx ai-spector review status <path> --json` |
| Approve document | `review_approve({ logicalPath, by })` | `npx ai-spector review approve <path> --by <name>` |
| Dismiss trivial change | `review_reject({ logicalPath, reason })` | `npx ai-spector review reject <path> --reason "..."` |

---

## Usage

| You say | Agent does |
|---------|------------|
| `/review` | Run check → show internal queue → wait for pick |
| `/review srs/01-overview` | Show status + diff for that doc → ask to approve |
| `/review approve srs/01-overview` | Approve immediately if already checked |

---

## Phase 0 — Detect changes

```
review_check({})
```

Reports: how many documents scanned, how many invalidated (content changed since last approval), errors.

Show summary in chat. If `invalidated === 0`, tell the user everything is up to date and stop.

---

## Phase 1 — Show internal review queue

```
review_queue({ track: "internal", showDiff: true })
```

**Present in chat as a table** — do not dump raw JSON:

| # | Document | Changed | Lines +/- | Reason |
|---|----------|---------|-----------|--------|
| 1 | `srs/01-overview` | 2026-06-11 | +3 / -1 | content_changed |
| 2 | `bd/api-design` | 2026-06-10 | +12 / -5 | content_changed |

Use `linesAdded` / `linesRemoved` from the diff payload for the +/- column.

**Stop and ask:** "Which document would you like to review? Reply with the number or path."

Do not approve anything until the user picks.

---

## Phase 2 — Show document diff

```
review_status({ logicalPath: "srs/01-overview", showDiff: true })
```

**Present the diff in chat:**

```
srs/01-overview
  internal: needs_review
  +3 lines / -1 line since approved by alice on 2026-06-01

  42 - ## Old Section Title
  42 + ## New Section Title
  67 + > Note: this requirement was updated.
  68 + >
  71 - See section 3.
```

Show at most 30 diff lines. If more, show count: "…and 15 more lines changed."

Also show any open comment thread warning if `openThreadWarning` is set in the result.

**Stop and ask:** "Approve this document, dismiss the change, or skip?"

---

## Phase 3 — Act on user decision

### Approve

```
review_approve({ logicalPath: "srs/01-overview", by: "<user name or 'local'>" })
```

On success, confirm in chat:
```
✅ srs/01-overview approved by alice
   Hash: abc123def456ef78
   Moved to client review queue.
```

If `openThreadWarning` is returned, surface it:
```
⚠️  Warning: 2 open comment thread(s) on this document. Consider resolving them too.
```

### Dismiss (trivial change — no re-approval needed)

```
review_reject({ logicalPath: "srs/01-overview", reason: "whitespace / formatting only" })
```

Confirm in chat and move to next item in queue.

### Skip

Note the skip and move to next item.

---

## Phase 4 — Continue queue

After acting on a document, return to Phase 1 and show the remaining queue.

When the internal queue is empty:
```
✅ Internal review queue is clear.
   N document(s) are now in the client review queue.
```

---

## Phase 5 — Optional: commit review state

Review state is stored as JSON files under `reviews/`. Commit them so the team sees the updated approval status:

```bash
git add reviews/
git commit -m "chore(review): approve srs/01-overview and bd/api-design"
git push
```

---

## Status badges quick reference

| `overallStatus` | Meaning |
|-----------------|---------|
| `pending_internal` | Waiting for internal review (you) |
| `pending_client` | Internal approved — waiting for client via web app |
| `approved` | Fully approved by both tracks |
| `rejected` | Client rejected — needs internal re-review |

---

## Guardrails

- Never approve without showing the diff first (Phase 2 is mandatory).
- Never approve if `overallStatus` is already `pending_client` or `approved` — tell the user.
- Never touch `internal_queue/` files directly — always go through MCP tools or CLI.
- Do not approve on the user's behalf without explicit confirmation ("approve this").

---

## If blocked

See [../../ai-spector/references/cli-failures.md](../../ai-spector/references/cli-failures.md).

| Issue | Fix |
|-------|-----|
| `review check` finds no approvals | No documents have been approved yet. Run `review approve` on a doc first. |
| Doc path not found | Check logical path format: `srs/01-overview` not `docs/srs/en/01-overview.md` |
| `Cannot approve: state is pending_client` | Document already internally approved — waiting for client web app |
| `Cannot resolve doc path` | Logical path prefix not recognised — check `logicalPathToDocPath` mapping in `src/core/comments/paths.ts` |
| Diff file missing | Run `review check` again to recompute |
