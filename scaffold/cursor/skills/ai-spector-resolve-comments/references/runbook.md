# Resolve review comments

IDE-first workflow (Cursor) for **git-backed review comments** under `comments/`. Web reviewers create threads; you resolve locally: inbox in chat → pick thread → impact → propose edit → apply → commit (doc + resolve meta) → push.

No Writer API — storage is git-only (`meta_data.json` + `events.jsonl`).

## Usage

| You say | Agent does |
|---------|------------|
| `/resolve-comments` | Inbox table in chat → wait for your pick |
| `/resolve-comments C-001` | Plan + impact for pick **C-001** |
| `/resolve-comments srs/01-overview` | Inbox filtered to that file |

## IDE workflow (agent — follow in order)

### Phase 0 — Sync

```bash
git pull
```

### Phase 1 — Show thread pick list in chat (user selects)

```bash
ai-spector comments inbox --json
```

**IDE presentation (required):**

1. Read `idePresentation.markdown` from JSON — render **only that markdown table** in chat.
2. Follow `idePresentation.rules`: **one row per open thread**, not per reply; **no raw JSON**; **no thread uuids** in user-facing text.
3. Use **pick ids** (`C-001`, `C-002`, …) for selection.

Example table (from CLI):

| Pick | Document | Lines | Lang | Reviewer ask |
|------|----------|-------|------|--------------|
| **C-001** | `docs/srs/01-overview.md` | 12-14 | EN | Please clarify… |

**Stop and ask:** “Which thread should we resolve? Reply with **C-00N**.”

Do not start editing until the user picks (unless they already passed `C-001` in the slash command).

**Do not use** `comments list` for user selection — use **`comments inbox`** only.

### Phase 2 — Plan + impact (after pick)

```bash
ai-spector comments plan C-001 --json
```

**Show in chat:** full thread comments, anchored doc text, impact summary, regen targets.

### Phase 3 — Propose edit (user approval required)

1. Quote anchored lines + reviewer ask
2. Propose concrete markdown change
3. Ask: **“Apply this edit?”** — wait for explicit approval

### Phase 4 — Apply edit

Edit `anchor.docPath` at lines `startLine`–`endLine`. Show diff summary in chat.

### Phase 5 — Resolve status + single git commit (doc + comment meta)

Each resolve must land in git with **both** the **document fix** and **comment thread metadata** — never commit only `comments/` without the changed doc file.

**Steps:**

```bash
# 1) Stage and commit doc fix first (establishes resolvedInCommitSha target)
git add docs/srs/....md
git commit -m "fix(docs): address comment C-001 on srs/01-overview lines 12-14"

# 2) Write resolve meta pointing at that doc commit
ai-spector comments resolve <threadId> --file srs/01-overview \
  --expected-version <v from plan> --json

# 3) Stage comment meta AND re-include doc in the same final commit
git add comments/srs/01-overview/<threadId>/ docs/srs/....md
git commit --amend -m "fix(docs): address comment C-001 on srs/01-overview lines 12-14

Resolved thread <threadId>. Pick C-001."

git push
```

**Why amend:** `comments resolve` needs HEAD after the doc commit for `resolvedInCommitSha`. Amending folds `meta_data.json` + `events.jsonl` into the **same commit** as the doc change so one push contains the full resolve.

**Commit must include:**

| Path | Content |
|------|---------|
| `docs/…` | Edited document (the fix) |
| `comments/…/{thread_id}/meta_data.json` | `status: resolved`, `resolvedInCommitSha`, … |
| `comments/…/{thread_id}/events.jsonl` | append `resolved` event |

**Never:** `git add` only `comments/` while doc changes stay unstaged or uncommitted.

If HEAD moved before resolve, pass `--commit-sha <doc-fix-sha>` explicitly.

### Phase 6 — Optional follow-up

```bash
ai-spector index
```

Or targeted `/generate-srs` / `/generate-basic-design` when plan lists regen targets.

## Multi-thread session

Re-run `comments inbox --json` → show `idePresentation.markdown` → ask for next pick.

## Chat presentation rules

- Inbox: **`idePresentation.markdown` table only** (threads, not replies)
- Plan/impact: full detail after pick
- Commits: **doc file + comment meta together** (amend pattern above)
- Pick ids in chat; thread ids only in CLI args

## CLI reference

| Command | Purpose |
|---------|---------|
| `comments inbox [--json]` | Thread pick list + `idePresentation` for chat |
| `comments plan C-001 [--json]` | Anchor excerpt + graph impact |
| `comments resolve <threadId> --file <path> [--expected-version]` | Update meta before final amend commit |

## Guardrails

- No Writer API
- No resolve before doc edit is applied
- No commit with only metadata — **always include changed doc file**
- No push until amend commit contains doc + `comments/…/thread/`

## If blocked

See [cli-failures.md](../../ai-spector/references/cli-failures.md).

| Issue | Fix |
|-------|-----|
| Unknown C-00N | Re-run `comments inbox --json` |
| Stale version | Re-run `comments plan`, refresh `--expected-version` |
| Doc missing from commit | `git status` — stage `docs/…` before amend |
