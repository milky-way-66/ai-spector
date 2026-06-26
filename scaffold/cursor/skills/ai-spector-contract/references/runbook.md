# Contract Operations — Agent Runbook

Consolidated runbook for all Writer contract operations: document review, comment resolution, translation, and language status.

**Path semantics:** refer to `kari-writer/contracts/CONTRACT.md` — do not load or link to `.docops/guide/`.

---

## Review

Document sign-off workflow. The agent reads the document, scores readiness, checks graph impact, and writes a review before asking the user to decide.

**Routing:** `contract_review` (or legacy `review_approve`) — not `spec_approve` (SPEC-NNN), `work_approve_plan` (plan gate), or `contract_comments` (C-NNN threads).

Storage: `.ai-spector/.docflow/review-queue/` (registry, pending jobs, snapshots, history). Agent session gate: `.session.json` (local — **do not commit**).

### MCP tools vs CLI

| Operation | MCP tool | CLI fallback |
|-----------|----------|--------------|
| Start review | `review_begin({ logicalPath? })` | `npx ai-spector review begin [path] --json` |
| Detect + queue first reviews | `review_check({})` | `npx ai-spector review check --json` |
| Show review queue | `review_queue({ track: "internal", showDiff: true })` | `npx ai-spector review queue --track internal --json` |
| Fast queue list | `review_queue({ track: "internal", enrich: false, showDiff: false })` | `npx ai-spector review queue --no-enrich --json` |
| Load status + diff + history | `review_status({ logicalPath, showDiff: true })` | `npx ai-spector review status <path> --json --history` |
| Ack review summary written | `review_session_ack_review({ logicalPath })` | `npx ai-spector review session ack <path> --json` |
| List all docs | `review_list({ prefix?, status? })` | `npx ai-spector review list --json` |
| Approve document | `review_approve({ logicalPath, by })` | `npx ai-spector review approve <path> --by <name>` |
| Decline vote | `review_decline({ logicalPath, by, note? })` | `npx ai-spector review decline <path> --by <name>` |
| Close review | `review_close({ logicalPath, by, reason })` | `npx ai-spector review close <path> --by <name> --reason "..."` |
| Dismiss trivial change | `review_reject({ logicalPath, reason })` | `npx ai-spector review reject <path> --reason "..."` |
| Downstream impact | `graph_impact({ file: "<docPath>", change: "content updated" })` | `npx ai-spector graph impact --file <path> --json` |
| Readiness rubric | included in `review_status` → `readiness` block | `npx ai-spector readiness scan --paths <path> --json` |

### Phases

**Phase 0 — Discover.** If user named a doc, skip queue pick → `review_begin({ logicalPath })`. Otherwise `review_begin({})`.

**Phase 1 — Queue.** `review_queue({ track: "internal", showDiff: false })` → table → wait for pick.

**Phase 2 — Load bundle.** `review_begin({ logicalPath, showDiff: true })` or `review_status({ logicalPath, showDiff: true })`. Read the full document file. Check `enrichment.impact.review` and `enrichment.impact.regenerate`. Check quorum block (`voterCount`, `approveCount`, `required`, `met`). Check `readiness` block — see `readiness-compliance.md` and `custom-checklists.md` (kept in place from prior `ai-spector-review/references/`).

**Phase 3 — Graph impact.** `graph_impact({ file: "<docPath>", change: "content updated — reviewing for approval" })`. Use `enrichment.impact` when present.

**Phase 3b — Readiness compliance.** Score `readiness.structuralScan.findings` + `outputChecklist.items[]` (met/partial/missing).

**Phase 4 — Write review.** Write structured review in chat before asking. Branch on `reviewTemplate`: `first` (no diff section) or `re_review` (include diff, cap 30 lines). Include: Summary of changes, Diff, Impact, Readiness compliance, Concerns, Recommendation. Then `review_session_ack_review({ logicalPath })` — required before `review_approve`.

**Phase 5 — Wait for user decision.** Ask: Approve / Request changes / Dismiss / Skip. Do not auto-approve.

**Phase 6 — Execute.**
- Approve: `review_approve({ logicalPath, by })` → confirm quorum progress.
- Request changes: do not call approve; optionally `review_decline`.
- Close (quorum unreachable): `review_close({ logicalPath, by, reason })`.
- Dismiss: `review_reject({ logicalPath, reason })`.

**Phase 7 — Continue queue.** Return to Phase 1 until queue empty.

**Phase 8 — Commit.** `git add .ai-spector/.docflow/review-queue/ && git commit -m "chore(review): approve <docs>"`.

### Guardrails

- Never skip Phase 4 (review write) or Phase 3b (readiness) even for one-line changes.
- Never skip `review_session_ack_review` — `review_approve` is blocked without it.
- Never approve if `overallStatus` is already `pending_client` or `approved`.
- Read the document, not just the diff.

---

## Comments

IDE-first workflow for git-backed review comment threads under `comments/`. Covers both document threads (C-NNN) and prototype HTML threads (C-NNN, routed via prototype section below).

Storage: git-only (`meta_data.json` + `events.jsonl`). No Writer API.

### MCP tools vs CLI

| Operation | MCP tool | CLI fallback |
|-----------|----------|--------------|
| Thread inbox | `contract_comments({ action: "inbox" })` | `npx ai-spector comments inbox --json` |
| Thread plan | `contract_comments({ action: "show", pickId: "C-001" })` | `npx ai-spector comments plan C-001 --json` |
| Resolve thread | `contract_comments({ action: "resolve", threadId, file, expectedVersion })` | `npx ai-spector comments resolve <threadId> --file <path>` |

### Phases

**Phase 0 — Sync.** `git pull`.

**Phase 1 — Inbox.** `comments inbox --json` → render `idePresentation.markdown` table only → ask for pick (C-00N). Do not use `comments list`.

**Phase 2 — Plan + impact.** `comments plan C-001 --json` → show thread, anchored doc text, impact summary.

**Phase 3 — Propose edit.** Quote anchored lines + reviewer ask → propose edit → ask "Apply this edit?" → wait for approval.

**Phase 4 — Apply.** Edit `anchor.docPath` at lines `startLine`–`endLine` (documents) or HTML at `workflow.suggestEdit.docPath` at `anchor.selector` (prototype).

**Phase 5 — Resolve + commit (amend pattern).**

```bash
# 1) Commit doc fix
git add docs/srs/....md && git commit -m "fix(docs): address comment C-001 on srs/01-overview"

# 2) Write resolve meta
npx ai-spector comments resolve <threadId> --file srs/01-overview --expected-version <v> --json

# 3) Amend to include doc + comment meta
git add comments/srs/01-overview/<threadId>/ docs/srs/....md
git commit --amend -m "fix(docs): address comment C-001 on srs/01-overview — resolve <threadId>"
git push
```

**Always amend.** Never commit only `comments/` without the changed target file.

**Phase 6 — Optional follow-up.** `npx ai-spector index` or targeted generate if plan lists regen targets.

---

## Prototype-Comments

Batch resolve for prototype HTML review comments (B-NNN batches or C-NNN prototype threads). No file-backed plan state — plan lives in chat; user yes gates implementation.

### Phases

**Phase 0 — Sync.** `git pull`.

**Phase 1 — Discover.** `comments facets --type prototype --json` → `comments inbox --type prototype --group screen --json` → render `idePresentation.markdown`.

**Phase 2 — Select scope.** Accept B-00N (screen batch), multiple B-00N (cross-screen), C-00N list, or `--screen <stem>`.

**Phase 3 — Batch plan (read-only).** `comments batch-plan B-001 --json` → show `formatted` output. Do not edit files.

**Phase 4 — Clarify (mandatory).** Ask: scope confirmed? constraints (design tokens, DESIGN.md, no new CDN)? drifted/missing anchors?

**Phase 5 — Propose 2–3 approaches.** Show comparison table (inline vs class-based vs token). No file edits. Wait for approach pick.

**Phase 6 — Execution plan table.** Show steps: edit HTML → validate → commit → `batch-resolve` → amend → push. Ask: **"Proceed with implementation?"** — wait for yes.

**Phase 7 — Implement (after yes).** Apply HTML edits → `comments batch-resolve B-001 --json` → amend commit.

### Guardrails

- No HTML edits before Phase 7 (explicit yes).
- No `batch-resolve` before HTML fix is committed.
- Use `thread.filePath` in resolve (e.g. `prototype/src/login.html`), not list key `prototype`.

---

## Translation

Sync whole document files across languages using the translation queue. Jobs are created automatically on `npx ai-spector index` when file hashes change.

### MCP tools vs CLI

| Operation | MCP tool | CLI fallback |
|-----------|----------|--------------|
| Pending queue | `contract_translate({ action: "list" })` | `npx ai-spector lang queue pending --json` |
| Fail a job | `contract_translate({ action: "fail", jobId, reason })` | `npx ai-spector lang queue fail <jobId> --reason conflict` |
| Retry a job | `contract_translate({ action: "retry", jobId })` | `npx ai-spector lang queue retry <jobId>` |

### Phases

**Phase 1 — Load queue.** `lang queue pending --json`. Note per-job: `direction` (outbound/inbound), `origin.path`, `targets[]`, `enrichment.diff`, `enrichment.impact`.

**Phase 2 — Merge context (when needed).** When `origin.mergedLangs` is set, read `.ai-spector/.docflow/translation-queue/changes/{docType}--{path}.json` for edit order via `sequence` + `mtimeMs`. On conflict: fail job or ask user.

**Phase 3 — Write target files.**
- Outbound: translate `origin.path` → each pending `targets[].path`.
- Inbound: backport secondary-lang origin to primary first, then propagate.
- Translation rules: translate all prose; keep IDs (`UC-01`, `F-03`, paths, CLI, code) verbatim; whole file only.

**Phase 4 — Reconcile.** `npx ai-spector index` → verify `lang queue pending --json` reduced. On `enrichment.layerDrift`: tell user, offer sync audit — do not auto-regenerate.

### Guardrails

- Do not invent queue jobs — they come from index/scan only.
- Do not skip `npx ai-spector index` after writes.
- Read `enrichment.diff` from queue — not legacy inline `changes[].diff`.

---

## Lang-Status

Translation status check — report only, no writes. Use when the user asks about language status, what's stale in JP/VI, or which docs need updating.

### Steps

1. Check `docops.config.json` `languages[]` — if only one language, report nothing to compare.
2. Refresh index: `index({})` MCP or `npx ai-spector index` CLI (skip if user just ran it).
3. `lang_queue({})` MCP → render table:

| ID | Document | Direction | Origin | Outdated targets |
|----|----------|-----------|--------|-----------------|
| a1b2 | `srs/01-overview.md` | outbound | en | jp, vi |

4. List failed jobs separately.
5. For writes, switch to the [Translation](#translation) section.
