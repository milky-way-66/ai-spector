# Resolve prototype comments (batch, gated)

IDE workflow for **prototype HTML** review comments (`commentType: prototype`). Supports **one screen** or **cross-screen** batch resolve. Plan stays in **chat context** — no file-backed plan state; user **yes** gates implementation.

## Scope

| User says | Filter / pick |
|-----------|----------------|
| resolve all on login screen | `--screen login` or `B-001` for login batch |
| resolve prototype comments | `--type prototype --group screen` |
| resolve login and home | `--picks B-001,B-002` or `--picks C-001,C-003,C-005` |

## Phase 0 — Sync

```bash
git pull
```

## Phase 1 — Discover + filter

```bash
npx ai-spector comments facets --type prototype --json
npx ai-spector comments inbox --type prototype --group screen --json
```

Show `idePresentation.markdown` — **batch table first** when present.

Natural phrases like "login screen" map to `--screen login` or `comments batch-plan --phrase "login screen"`.

## Phase 2 — User selects scope

Accept:

- **B-00N** — all open threads on one screen
- **Multiple B-00N** — cross-screen batch
- **C-00N list** — custom subset (may span screens)
- **--screen &lt;stem&gt;** — without opening inbox first

## Phase 3 — Batch plan (read-only)

```bash
npx ai-spector comments batch-plan B-001 --json
# or
npx ai-spector comments batch-plan --screen login --json
# or cross-screen
npx ai-spector comments batch-plan --picks B-001,B-002 --json
```

Show `formatted` output in chat. **Do not edit files.**

## Phase 4 — Clarify (mandatory)

Ask unless user already answered in the same message:

1. Scope confirmed? (this screen / these screens / listed picks)
2. Constraints — design tokens, `prototype/DESIGN.md`, no new CDN?
3. Drifted/missing anchors — edit current HTML or skip thread?

## Phase 5 — Propose 2–3 approaches (mandatory)

Present a small comparison table (minimal inline change vs class-based vs shared token). Include trade-offs. **No file edits.**

Wait for user to pick an approach (or refine).

## Phase 6 — Execution plan table

Show concrete steps:

| Step | Action |
|------|--------|
| 1 | Edit `prototype/…/*.html` (list each file from plan.targets) |
| 2 | Optional: `npx ai-spector prototype validate` |
| 3 | Commit HTML |
| 4 | `npx ai-spector comments batch-resolve B-001` (or matching picks) |
| 5 | Amend commit with all `comments/prototype/…/meta_data.json` |
| 6 | `git push` |

**Stop.** Ask: **"Proceed with implementation?"** — wait for explicit **yes** / **go ahead**.

## Phase 7 — Implement (after yes only)

1. Apply HTML edits per chosen approach
2. Show diff summary
3. Commit prototype file(s) first
4. Batch resolve:

```bash
npx ai-spector comments batch-resolve B-001 --json
# cross-screen
npx ai-spector comments batch-resolve B-001,B-002 --json
```

5. Amend to include comment meta + prototype files in one commit

## Filters reference

| Flag | Purpose |
|------|---------|
| `--type prototype` | Prototype threads only |
| `--file prototype` | All prototype URL folders |
| `--path prototype/src/` | Path prefix |
| `--screen login` | Screen stem |
| `--branch release/x.y` | originBranch |
| `--anchor-state active` | Skip drifted unless asked |
| `--group screen` | B-00N batch rows in inbox |

## Guardrails

- No HTML edits before Phase 7 (explicit yes)
- No `batch-resolve` before HTML fix is committed
- Use **thread.filePath** in resolve (e.g. `prototype/src/login.html`), not list key `prototype`
- Document comments → `ai-spector-resolve-comments` (single-thread, doc amend)

## CLI quick reference

```bash
npx ai-spector comments facets --type prototype
npx ai-spector comments inbox --type prototype --group screen --json
npx ai-spector comments batch-plan B-001 --json
npx ai-spector comments batch-plan --screen login --json
npx ai-spector comments batch-resolve B-001 --json
```
