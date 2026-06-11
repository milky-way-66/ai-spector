---
name: ai-spector-review
description: >-
  Document approval review workflow for ai-spector projects. Use this skill
  when the user asks about document approval status, reviewing documents,
  approving documents, what needs review, which documents have been approved,
  pending client approval, or "what changed since last approval". This is
  for document APPROVAL review — NOT for comment threads (use
  ai-spector-resolve-comments for those).
  Trigger phrases: "review document", "approve document", "which docs reviewed",
  "review status", "pending review", "needs review", "review queue",
  "has this been approved", "show review status", "list reviewed docs".
---

# AI Spector — Document Review & Approval

This skill handles the two-track document approval workflow:
**internal review** (you, via this agent) → **client review** (web app).

## IMPORTANT: Review vs Comments distinction

| User asks about... | Skill to use |
|---|---|
| Approving / reviewing documents, review status, review queue | **THIS SKILL** (`ai-spector-review`) |
| Comment threads, C-001, inbox, resolve comments | `ai-spector-resolve-comments` |

If unsure: "review" in the context of **documents and approval** → this skill. "review" in the context of **feedback, threads, or comments** → resolve-comments.

## MCP tools (use these, never read review-queue files directly)

| What you need | MCP tool |
|---|---|
| List all docs with review status | `review_list({ status?, prefix? })` |
| Find pending docs in queue | `review_queue({ track: "internal", showDiff: true })` |
| Detect content changes | `review_check({})` |
| Status + diff for one doc | `review_status({ logicalPath, showDiff: true })` |
| Status + approval history | `review_status({ logicalPath, includeHistory: true })` |
| Approve a document | `review_approve({ logicalPath, by })` |
| Dismiss trivial change | `review_reject({ logicalPath, reason })` |

Storage: `.ai-spector/.docflow/review-queue/` (registry, pending jobs, snapshots, history).

## Common questions → correct tool

| User asks | Call |
|---|---|
| "which SRS docs have been reviewed?" | `review_list({ prefix: "srs" })` |
| "does all document has reviewed?" | `review_list({})` — show summary table |
| "what needs review?" | `review_queue({ track: "internal" })` |
| "has srs/01-overview been approved?" | `review_status({ logicalPath: "srs/01-overview" })` |
| "show pending client review" | `review_queue({ track: "client" })` |
| "approve the SRS overview" | `review_approve({ logicalPath: "srs/01-overview", by: "..." })` |
| "what changed in srs/01 since approval?" | `review_status({ logicalPath: "srs/01-overview", showDiff: true })` |

## Full review workflow

See [SKILL.md in scaffold](../../../scaffold/cursor/skills/ai-spector-review/SKILL.md) for the complete runbook.

### Short version

1. `review_check({})` — detect changed documents
2. `review_queue({ track: "internal", showDiff: true })` — show pending table
3. User picks a document
4. `review_status({ logicalPath, showDiff: true })` — load diff
5. Read the actual document file (get path from `logicalPathToDocPath`)
6. `graph_impact({ file: "<docPath>" })` — check downstream impact
7. Write a review summary (what changed, impact, concerns, recommendation)
8. Wait for user decision: approve / request changes / dismiss
9. `review_approve(...)` or `review_reject(...)`
10. Commit `.ai-spector/.docflow/review-queue/` if team-shared approvals are desired

## Presenting `review_list` results

Always render as a table, never raw JSON:

| Document | Status | Approved by | Approved at |
|----------|--------|-------------|-------------|
| srs/01-overview | ✅ approved | alice | 2026-06-11 |
| srs/02-scope | ⏳ pending_internal | — | — |
| bd/api-design | 👁 pending_client | bob | 2026-06-10 |

Status icons: ✅ approved · ⏳ pending_internal · 👁 pending_client · ❌ rejected

## Guardrails

- Never read `.ai-spector/.docflow/review-queue/` files directly — always use MCP tools.
- Never approve without showing the diff review first.
- Never confuse document approval with comment threads.
- If `overallStatus` is `pending_client` or `approved`, tell the user — do not re-approve.
