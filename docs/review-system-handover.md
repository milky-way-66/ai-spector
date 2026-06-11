# Document Review System — Web Integration Handover

> **Audience:** Web team implementing the client-side review UI.
> **Source of truth:** `src/core/reviews/` in this repository.

---

## 1. Overview

The system enforces a sequential two-track review flow:

```
Internal Review  →  Client Review  →  Fully Approved
```

- **Internal track** — company employees using ai-spector CLI / MCP tools
- **Client track** — client users using the web app

The web app **reads** data written by ai-spector and **writes back only the client review decision**. All internal queue management, hash computation, and change detection is handled by ai-spector.

**Key rule:** when a document's content changes after approval, both tracks are automatically invalidated and the document re-enters the internal queue. Internal must approve again before the client sees it.

---

## 2. State Machine

Each document has an `overallStatus` field:

| `overallStatus`    | Meaning                                       | Notes |
|--------------------|-----------------------------------------------|-------|
| `pending_internal` | Waiting for internal review                   | Starting state; also set after content changes |
| `pending_client`   | Internal approved, waiting for client review  | **Web app should surface this to the client** |
| `approved`         | Both tracks approved the same content hash    | Fully signed off |
| `rejected`         | Client rejected                               | Web app sets this; loops back to internal |

### Transitions

```
document created / content changes
        ↓
  pending_internal
        ↓  internal approves (ai-spector)
  pending_client        ← entry appears in client_queue/pending.json
        ↓  client approves (web app)
     approved

  client rejects (web app)
        ↓
     rejected           ← ai-spector's next reconcile moves it back to internal_queue
```

---

## 3. Directory Structure

All review data lives under `reviews/` at the project root:

```
reviews/
  <logicalPath>/                      e.g. reviews/srs/01-overview/
    approval.json                     primary status record
    approval_snapshot.md              document content at last approval (read-only for web)
    approval_history.jsonl            append-only audit log

  internal_queue/                     owned by ai-spector — do not write
    pending.json
    resolved.json
    rejected.json
    failed.json
    diffs/
      srs--01-overview.json

  client_queue/                       web app reads and partially writes here
    pending.json                      ← poll this for documents awaiting client review
    resolved.json
    rejected.json
    diffs/
      srs--01-overview.json           ← load on demand for diff display
```

> **Filename convention:** logical paths use `/` in directory names (`reviews/srs/01-overview/`) but `--` in filenames (`srs--01-overview.json`).

---

## 4. File Schemas

### `approval.json`

```json
{
  "version": 1,
  "logicalPath": "srs/01-overview",
  "contentHash": "abc123def456ef78",
  "overallStatus": "pending_client",
  "internal": {
    "status": "approved",
    "approvedAt": "2026-06-11T10:00:00.000Z",
    "approvedBy": "alice",
    "invalidatedAt": null
  },
  "client": {
    "status": "pending",
    "approvedAt": null,
    "comment": null
  }
}
```

Enum values:
- `overallStatus`: `pending_internal | pending_client | approved | rejected`
- `internal.status`: `pending | approved | needs_review`
- `client.status`: `pending | approved | rejected`

### `client_queue/pending.json`

Lightweight index — no diff content inline. Poll this file.

```json
{
  "version": 1,
  "entries": [
    {
      "logicalPath": "srs/01-overview",
      "queuedAt": "2026-06-11T10:00:00.000Z",
      "reason": "content_changed",
      "approvedHash": "prevhash12345678",
      "currentHash": "newhash123456ab"
    }
  ]
}
```

`reason` values: `content_changed | client_rejected` (the latter means internal re-submitted after a prior rejection — surface this clearly in the UI).

### `client_queue/diffs/<safe-name>.json`

Load on demand when the user opens a document for review.

```json
{
  "logicalPath": "srs/01-overview",
  "approvedHash": "prevhash12345678",
  "currentHash": "newhash123456ab",
  "diff": "42 - ## Old Title\n42 + ## New Title\n",
  "linesAdded": 1,
  "linesRemoved": 1,
  "computedAt": "2026-06-11T10:00:00.000Z"
}
```

Diff format: `"{lineNo} - removed line"` / `"{lineNo} + added line"`. Render `-` lines in red, `+` lines in green.

### `approval_history.jsonl`

Append-only. One JSON object per line. Read-only for the web app (except appending client events — see §6).

```jsonl
{"event":"approved","track":"internal","at":"2026-06-11T10:00:00.000Z","by":"alice","hash":"abc123"}
{"event":"approved","track":"client","at":"2026-06-11T11:00:00.000Z","by":"client-user","hash":"abc123"}
{"event":"invalidated","at":"2026-06-12T08:00:00.000Z","reason":"content_changed","previousHash":"abc123","newHash":"def456"}
```

---

## 5. Write Boundary

| File / Field | ai-spector | Web app |
|---|---|---|
| `approval.json` → `internal.*` | **Write** | Read only |
| `approval.json` → `client.*` | Read only | **Write** |
| `approval.json` → `overallStatus` | Write (internal actions) | **Write** (on client decision) |
| `approval.json` → `contentHash` | **Write** | Read only |
| `internal_queue/*` | **Write** | Read only |
| `client_queue/pending.json` | Write (adds entries) | **Write** (removes entries) |
| `client_queue/resolved.json` | Read only | **Write** (archive on approve) |
| `client_queue/rejected.json` | Read only | **Write** (archive on reject) |
| `client_queue/diffs/*` | **Write** | Read only |
| `approval_snapshot.md` | **Write** | Read only |
| `approval_history.jsonl` | Write (internal events) | **Write** (client events only) |

---

## 6. What the Web App Must Implement

### 6.1 Display: Client Review Queue

Poll (or watch) `reviews/client_queue/pending.json`. For each entry show:

- Document name / path from `logicalPath`
- `queuedAt` timestamp
- `reason` — if `client_rejected`, indicate this is a re-submission after prior rejection
- Hash change summary (`approvedHash` → `currentHash`)

To show the diff, load `reviews/client_queue/diffs/<safe-name>.json` (replace `/` with `--` in `logicalPath`).

### 6.2 Action: Client Approves

**Step 1 — Update `approval.json`** (read first, change only `client.*` and `overallStatus`):

```json
{
  "client": {
    "status": "approved",
    "approvedAt": "<ISO-8601>",
    "comment": "<optional note or null>"
  },
  "overallStatus": "approved"
}
```

Do NOT change: `version`, `logicalPath`, `contentHash`, `internal.*`.

**Step 2 — Remove from `client_queue/pending.json`:** load, filter out the entry, write back.

**Step 3 — Archive to `client_queue/resolved.json`:** load (create `{ "version": 1, "entries": [] }` if missing), append the entry, write back.

**Step 4 — Append to `approval_history.jsonl`:**

```jsonl
{"event":"approved","track":"client","at":"<ISO>","by":"<userId>","hash":"<contentHash>"}
```

**Step 5 — Delete diff file** (optional but keeps storage clean):

```
reviews/client_queue/diffs/<safe-name>.json
```

### 6.3 Action: Client Rejects

**Step 1 — Update `approval.json`:**

```json
{
  "client": {
    "status": "rejected",
    "approvedAt": null,
    "comment": "<reason — required>"
  },
  "overallStatus": "rejected"
}
```

**Step 2 — Remove from `client_queue/pending.json`** (same as approve step 2).

**Step 3 — Archive to `client_queue/rejected.json`** (same pattern as resolved).

**Step 4 — Append to `approval_history.jsonl`:**

```jsonl
{"event":"rejected","track":"client","at":"<ISO>","by":"<userId>","reason":"<comment>"}
```

> ai-spector's next `review check` run will detect the rejection and move the document back to `internal_queue` automatically. The web app does **not** touch `internal_queue`.

### 6.4 Status Badge

Read `reviews/<logicalPath>/approval.json` and show a badge:

| `overallStatus`    | Label                    | Color  |
|--------------------|--------------------------|--------|
| `pending_internal` | ⏳ Pending internal review | Grey   |
| `pending_client`   | 👁 Awaiting your review   | Yellow |
| `approved`         | ✅ Approved               | Green  |
| `rejected`         | ❌ Rejected               | Red    |
| (file missing)     | — Not submitted           | None   |

---

## 7. How Change Detection Works

1. When internal approves, ai-spector computes SHA-256 (first 16 hex chars) of the document and stores it as `contentHash`.
2. The full content is saved as `approval_snapshot.md`.
3. Periodically (`review check` CLI / MCP), ai-spector re-hashes all approved documents.
4. If the hash changed: approval is invalidated, a diff is computed from `approval_snapshot.md` to current content, and the document enters `internal_queue`.
5. If the document was `pending_client` when the change is detected, it is **removed from `client_queue/pending.json` automatically**.

The web app does not need to implement change detection.

---

## 8. Edge Cases

### Concurrent writes

- Always **read before write**. Never overwrite fields you do not own.
- The web app owns only `client.*` and `overallStatus`. Read the full JSON, update those fields, write the whole object back.
- If you read `overallStatus: "pending_internal"` on a document you were about to approve, the document was re-invalidated while the user was reviewing. **Discard the decision and show an "outdated — please wait for re-review" message.**

### Missing files

| Situation | Handle as |
|---|---|
| `approval.json` missing | Document not submitted — show "Not submitted" |
| `client_queue/pending.json` missing | No pending items — treat as empty array |
| Diff file missing | Show hash summary only (`approvedHash → currentHash`); do not error |
| `approval_history.jsonl` missing | Create it on first append |

### Re-rejection flow

When a previously rejected document is re-approved by internal and re-submitted, the queue entry has `reason: "client_rejected"`. Show this in the UI so the client knows context.

### `version` field

`approval.json` has `version: 1` for schema versioning (not a write counter). Always include it unchanged when writing back.

---

## 9. Quick Reference

### Files to read

| File | Purpose |
|---|---|
| `reviews/client_queue/pending.json` | Docs waiting for client review |
| `reviews/<path>/approval.json` | Status of a specific document |
| `reviews/client_queue/diffs/<safe>.json` | Line diff for review UI |
| `reviews/<path>/approval_history.jsonl` | Audit log |
| `reviews/client_queue/resolved.json` | History of client-approved docs |
| `reviews/client_queue/rejected.json` | History of client-rejected docs |

### Files to write

| File | When |
|---|---|
| `reviews/<path>/approval.json` (`client.*` only) | On approve or reject decision |
| `reviews/client_queue/pending.json` | Remove entry after decision |
| `reviews/client_queue/resolved.json` | Append on approve |
| `reviews/client_queue/rejected.json` | Append on reject |
| `reviews/<path>/approval_history.jsonl` | Append client event line |

### Files never to touch

| File | Owner |
|---|---|
| `reviews/internal_queue/*` | ai-spector only |
| `reviews/<path>/approval_snapshot.md` | ai-spector only |
| `reviews/<path>/approval.json` → `internal.*` | ai-spector only |
| `reviews/<path>/approval.json` → `contentHash` | ai-spector only |
| `reviews/client_queue/diffs/*` | ai-spector only |
