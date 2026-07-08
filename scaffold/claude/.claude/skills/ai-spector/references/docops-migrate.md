# Docops migrate — agent runbook

**When user says:** *migrate*, *migrate to docops*, *migrate writer contract*, *migrate legacy layout*, *upgrade docops*, *fix docops*, *Writer not ready*, *migrate project*.

**Goal:** User only asks once — agent checks current vs expected, runs CLI when possible, gap-fills the rest, verifies.

**Do not** ask the user to run CLI steps manually unless a command fails and needs approval.

---

## Phase 0 — Guide (always first)

```bash
npx ai-spector docops guide --json
# or: npx ai-spector docops migrate --guide --json
```

Parse and **show the user a short summary**:

| Section | JSON path | What to show |
|---------|-----------|--------------|
| Current | `currentState` | layout, config exists?, doc roots on disk, missing scaffold count |
| Expected | `targetState.docTypes` | correct paths + enabled layers |
| Wrong → correct | `targetState.examples.wrongVsCorrect` | table of fixes |
| Example config | `targetState.examples.docopsConfig` | merge into existing (never blind replace) |
| Missing files | `currentState.missingScaffold` | gap-fill list |
| Bundle | `targetState.examples.bundle` | ai-spector package paths (standalone CLI) |
| Tasks | `agentTasks[]` | ordered checklist |

If `--json` is too large for chat, use `--prompt` for the agent-facing text.

---

## Phase 1 — Automated CLI

Run `cli.primaryCommand` from the guide output (typically one of):

```bash
npx ai-spector docops init
npx ai-spector docops migrate
npx ai-spector docops migrate --from-docflow
npx ai-spector docops migrate --repair
```

If `writerReady` is already `true` and `recommendedAction` is `ok` → skip to Phase 3.

On non-zero exit → continue to Phase 2 (do not stop).

---

## Phase 2 — Agent gap-fill

Execute `agentTasks` in priority order from the guide:

1. **Config** — merge `targetState.examples.docopsConfig` into `.docops/docops.config.json` (fix wrong paths from `wrongVsCorrect`)
2. **Scaffold** — copy from `targetState.examples.bootstrapCopyMap` using bundled ai-spector paths; **skip if destination exists**
3. **Templates** — copy from bundle `templates/` when dest has no `*.md`
4. **engine.json** — create from `targetState.examples.engineJson` if missing (upgrade from legacy)

**Hard rules:**

- Never overwrite existing files
- Never move `docs/` markdown — edit config paths instead
- Repo-root-relative paths (`docs/srs`, not `srs`)

Re-run guide after major edits:

```bash
npx ai-spector docops guide --json
```

---

## Phase 3 — Verify

```bash
npx ai-spector docops check --json
npx ai-spector docops status --json
```

Success: `valid: true`, `writerReady: true`, no blocking gaps.

Optional follow-ups:

```bash
npx ai-spector index
npx ai-spector docops registry sync
npx ai-spector lifecycle sync --json
```

Report to user: files **written** vs **skipped**, final `writerReady` status.

---

## Package upgrade (ai-spector version bump)

If user also wants **ai-spector package upgrade** (not just docops layout):

1. Finish docops migrate first (this runbook)
2. Then [runbook.md — Upgrade](runbook.md#upgrade) (`upgrade scan` → `upgrade apply`)

If `upgrade scan` lists UPG-010 / UPG-012 (docops/engine), this runbook covers them.

---

## Disambiguation

| User means | Use |
|------------|-----|
| Migrate Writer / docops / legacy `.ai-spector/` | **This runbook** |
| Move SRS to different folder (wrong path) | [runbook.md — Adopt](runbook.md#migrate-existing-project-self-service) if layout-only; else this runbook |
| Upgrade npm package only | [runbook.md — Upgrade](runbook.md#upgrade) |
