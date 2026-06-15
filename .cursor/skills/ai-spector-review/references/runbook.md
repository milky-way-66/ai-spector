# Document Review — Agent Runbook

The agent's job is not just to show a diff — it is to **read the document, understand the change, assess impact, and write a review** so the user can make an informed decision quickly.

Two-track flow: **internal (you)** → **client (web app)**. This runbook covers internal review only.

**Routing:** Formal sign-off uses `review_approve` only — not `spec_approve` (SPEC-NNN),
`task_approve_plan` (execution plan), or `comments_resolve` (C-NNN threads). See
[_skill-router.md](../../_skill-router.md) and rule `ai-spector-routing.mdc`.

Storage lives under `.ai-spector/.docflow/review-queue/` (registry, pending jobs, snapshots, history).
Agent session gate: `.session.json` (local — **do not commit**; tracks review phases before `review_approve`).
Legacy `reviews/` is migrated automatically on first review command, or via `npx ai-spector review migrate`.

---

## MCP tools vs CLI

| Operation | MCP tool | CLI fallback |
|-----------|----------|--------------|
| **Start review (preferred)** | `review_begin({ logicalPath? })` | `npx ai-spector review begin [path] --json` |
| Detect + queue first reviews | `review_check({})` | `npx ai-spector review check --json` |
| Show review queue | `review_queue({ track: "internal", showDiff: true })` | `npx ai-spector review queue --track internal --json` |
| Load status + diff + history | `review_status({ logicalPath, showDiff: true })` | `npx ai-spector review status <path> --json --history` |
| Ack review summary written | `review_session_ack_review({ logicalPath })` | `npx ai-spector review session ack <path> --json` |
| List all docs with review status | `review_list({ prefix?, status? })` | `npx ai-spector review list --json` |
| Approve document | `review_approve({ logicalPath, by })` | `npx ai-spector review approve <path> --by <name>` |
| Dismiss trivial change | `review_reject({ logicalPath, reason })` | `npx ai-spector review reject <path> --reason "..."` |
| Check downstream impact | `graph_impact({ file: "<docPath>", change: "content updated" })` | `npx ai-spector graph impact --file <path> --json` |
| Structural + semantic rubric | Included in `review_status` → `readiness` block; or `readiness_scan` + `readiness_output_checklist` | `npx ai-spector readiness scan --paths <path> --json` |

---

## Usage triggers

| User says | Agent does |
|-----------|------------|
| `/review` | `review_begin({})` → queue table → wait for pick → full review |
| `/review srs/01-overview` or "review introduction" | `review_begin({ logicalPath })` → full review |
| `/review approve srs/01-overview` | Still run review first, then approve if no concerns |
| "what changed since last approval" | `review_status` with diff for the named doc |
| "review queue" | `review_begin({})` or `review_queue` — show pending table only |

---

## Phase 0 — Discover and detect

**User named a document:** skip queue pick — go to Phase 2 with `review_begin({ logicalPath })`.

**No document named:**

```
review_begin({})
```

Report: `"Found N document(s) on disk — M pending internal review."` (from `discovery` + queue).

If `discovered === 0`: no docs on disk — tell user to generate docs first.

If errors exist, list them but continue with valid documents.

`review_check({})` is equivalent for detect-only; prefer `review_begin` as the single entry point.

---

## Phase 1 — Show queue, wait for pick

Skip when user already named a document in Phase 0.

```
review_queue({ track: "internal", showDiff: false })
```

Present as a table — never raw JSON:

| # | Document | Kind | Queued | +Lines | -Lines | Reason |
|---|----------|------|--------|--------|--------|--------|
| 1 | `srs/01-overview` | first | 2026-06-11 | — | — | first_review |
| 2 | `srs/02-scope` | changed | 2026-06-10 | +12 | -5 | content_changed |

Use `reason` from queue (`first_review` | `content_changed`). Diff lines apply to re-reviews only.

**Stop and ask:** "Which document should I review? Reply with a number or path."

---

## Phase 2 — Load review bundle

**Preferred entry:**

```
review_begin({ logicalPath: "<picked or named>", showDiff: true })
```

Or `review_status({ logicalPath, showDiff: true })` — both auto-register never-reviewed docs.

Use `reviewKind` / `reviewTemplate` from the response (`first` | `re_review` | `client_signoff`).

Then read the **full** document file (`docPath` in the response — e.g. `docs/srs/en/1-introduction.md`).

Use `workflowGuidance` from `review_status` — it lists `nextTools`, `notTheseTools`, and whether `canReviewApprove` is true for the current state.

**Readiness:** `review_status` returns `readiness` when the logical path maps to a doc type:
- `readiness.structuralScan` — automated structural findings
- `readiness.outputChecklist` — rubric items to score met/partial/missing

See [readiness-compliance.md](./readiness-compliance.md) for scoring rules and report template.
Custom team checklists: [custom-checklists.md](./custom-checklists.md).

**Read the document to understand context.** The diff alone is not enough — you need to see what the changed sections mean in the full document.

---

## Phase 3 — Check graph impact

```
graph_impact({ file: "<docPath>", change: "content updated — reviewing for approval" })
```

Note which downstream nodes or documents are affected. This tells you whether approving this change will require regenerating other docs.

---

## Phase 3b — Readiness compliance

Use the `readiness` block from `review_status` (Phase 2). If absent, run:

```
readiness_scan({ paths: ["<docPath>"], docType: "<type>", updateLastScan: false })
readiness_output_checklist({ paths: ["<docPath>"], docType: "<type>" })
```

1. **Structural scan** — report errors/warnings from `readiness.structuralScan.findings`
2. **Semantic checklist** — read the document and score each `outputChecklist.items[]` entry:
   - **met** / **partial** / **missing** with a short evidence quote
3. Include the **Readiness compliance** table in Phase 4 (see [readiness-compliance.md](./readiness-compliance.md))

Blocking partial/missing items belong in **Concerns** and affect **Recommendation**.
Custom items (`source: custom`) follow the same scoring — see [custom-checklists.md](./custom-checklists.md).

---

## Phase 4 — Write the review

This is the core of the skill. Write a structured review in chat **before** asking the user to decide.

Branch on `reviewTemplate` from `review_begin` / `review_status`:

### Template: `first` (first sign-off)

```
## Review: <logicalPath>

**Document overview**
<2-4 sentences on scope, structure, and overall quality.>

**Impact**
<From graph_impact. If none: "No downstream impact detected.">

**Readiness compliance**
<Structural scan + compliance table — see readiness-compliance.md.>

**Concerns** *(omit if none)*

**Recommendation**
Approve | Request changes | Dismiss
```

Omit **Summary of changes** and **Diff** — show "N/A — first sign-off" if needed.

### Template: `re_review` (content changed since last sign-off)

```
## Review: <logicalPath>

**Summary of changes**
<2-4 sentences in plain language — what changed and why it matters.>

**Diff**
<From review_status. Cap at 30 lines.>

**Impact**
<From graph_impact.>

**Readiness compliance**
<Table per readiness-compliance.md.>

**Concerns** *(omit if none)*

**Recommendation**
Approve | Request changes | Dismiss
```

### Legacy combined format (when template unclear)

```
## Review: <logicalPath>

**Summary of changes**
<2-4 sentences describing what actually changed in plain language.
Not a list of line numbers — explain the meaning of the change.>

**Diff**
<Show the diff from review_status. Lines starting with "{n} +" are additions,
"{n} -" are removals. Cap at 30 lines; show count if more.>

**Impact**
<What downstream documents or graph nodes are affected, from graph_impact.
If none: "No downstream impact detected.">

**Open comment threads**
<List any open threads on this document if openThreadWarning was returned.
If none: omit this section.>

**Readiness compliance**
<Structural scan summary + compliance table — see readiness-compliance.md.
Include blocking partial/missing count.>

**Concerns** *(omit section if none)*
<Flag anything that looks wrong, incomplete, inconsistent, or risky.
Examples: a section was deleted without explanation, a requirement ID was
changed (breaks traceability), a constraint was weakened, new content
contradicts an earlier section.>

**Recommendation**
<One of:>
  ✅ Approve — changes look correct and complete.
  ⚠️  Approve with note — minor issues, safe to approve but worth flagging.
  ❌ Request changes — specific concern that should be addressed first.
```

### What makes a good review

- **Be specific** — name the lines or sections that changed, not just "some changes were made".
- **Explain the meaning** — "Section 3.2 now requires OAuth 2.0 instead of API keys" not "line 42 was changed".
- **Flag traceability breaks** — if a requirement ID or section anchor was removed or renamed, call it out explicitly.
- **Note missing content** — if lines were deleted without replacement and the section now reads incomplete, say so.
- **Score readiness checklist** — do not skip Phase 3b; blocking partial/missing items must appear in Concerns.
- **Be honest about concerns** — recommend "Request changes" when something looks wrong. Do not approve to be helpful.

After Phase 4, **before** asking the user to decide:

```
review_session_ack_review({ logicalPath: "<picked>" })
```

This persists the session gate (`awaiting_decision`). `review_approve` will fail without it.
Check `workflowGuidance.canReviewApprove` from the last `review_status` — it stays false until ack.

---

## Phase 5 — Wait for user decision

After the review, ask exactly:

```
Decision for <logicalPath>:
  1. ✅ Approve
  2. ❌ Request changes (describe what to fix)
  3. ↩️  Dismiss (trivial / formatting only)
  4. ⏭️  Skip (review later)
```

Wait for the user's reply. Do not auto-approve.

---

## Phase 6 — Execute decision

### 1 — Approve

```
review_approve({ logicalPath: "<path>", by: "<reviewer name>", note: "<optional note>" })
```

Confirm in chat:
```
✅ <logicalPath> approved — moved to client review queue.
   Hash: <contentHash>
```

If `openThreadWarning` was returned:
```
⚠️  Note: <N> open comment thread(s) on this document. Consider resolving them.
```

### 2 — Request changes

Do **not** call `review_approve`. Tell the user what needs to be fixed. Optionally open the relevant comment thread workflow (`ai-spector-resolve-comments`).

### 3 — Dismiss

```
review_reject({ logicalPath: "<path>", reason: "<user's reason or 'trivial formatting change'>" })
```

Confirm and continue to next item.

### 4 — Skip

Note the skip and continue to next item in queue.

---

## Phase 7 — Continue queue

After each decision, return to Phase 1 and show the remaining queue.

When internal queue is empty:
```
✅ Internal review queue is clear.
   <N> document(s) are now waiting in the client review queue.
```

---

## Phase 8 — Commit review state

Review state is stored under `.ai-spector/.docflow/review-queue/`. Commit after a review session if team-shared approvals are desired:

```bash
git add .ai-spector/.docflow/review-queue/
git commit -m "chore(review): approve <doc1>, <doc2>"
git push
```

---

## Guardrails

- **Never skip the review write (Phase 4).** Even for a one-line change, write a brief summary.
- **Never skip readiness compliance (Phase 3b).** Include structural scan + checklist table in the review.
- **Never skip `review_session_ack_review` after Phase 4.** `review_approve` is blocked without it.
- **Never approve without showing the full review first.** Even if the user says "just approve it", still write the review — then ack — then approve.
- **Never approve if `overallStatus` is already `pending_client` or `approved`.** Tell the user the current state.
- **Recommend "Request changes" honestly.** Do not approve to avoid friction.
- **Never patch `.session.json`, registry, or queue files.** If blocked, follow `workflowGuidance.hint` / `suggestedTools` from the tool error — file feedback if the path is still broken.
- **Never touch `internal_queue/` files directly.** Always go through MCP tools / CLI.
- **Read the document, not just the diff.** Phase 2 requires reading the actual file.

---

## Status reference

| `overallStatus` | Meaning |
|-----------------|---------|
| `pending_internal` | Waiting for internal review (this runbook) |
| `pending_client` | Internal approved — waiting for client via web app |
| `approved` | Fully signed off |
| `rejected` | Client rejected — needs internal re-review |

---

## If blocked

See [../../ai-spector/references/cli-failures.md](../../ai-spector/references/cli-failures.md).

| Issue | Fix |
|-------|-----|
| `review check` finds no approvals | No documents approved yet — run `review approve` on a doc to register it first |
| Doc path not found | Use logical path format: `srs/01-overview` not `docs/srs/en/01-overview.md` |
| `Cannot approve: state is pending_client` | Already internally approved — tell user it is awaiting client |
| `Cannot resolve doc path` | Logical path prefix not recognised — check paths.ts mapping |
| Diff file missing | Run `review check` again to recompute |
| graph_impact returns no data | Graph may be stale — suggest `index({})` then retry |
