# Workflow Redesign — Implementation Plan

> Companion to [workflow-redesign.md](workflow-redesign.md). Phased, ordered by
> dependency. Each code phase follows the CLAUDE.md "Adding a New Command"
> pattern: core op (typed result, no console.log) → CLI formatter → CLI handler
> → MCP tool + Zod schema → SDK re-export → tests.

## Sequencing overview

```
Phase 1  Valid check (check)            ← independent, ship first (CI/pre-commit value)
Phase 2  Context store (clarify)        ← depends on nothing in code; skills use it in P5
Phase 3  Extracted-spec review queue    ← reuses review-queue patterns
Phase 4  Staleness wiring               ← touches index/analyze; needs P2
Phase 5  Skill/doc rewrite (the gates)  ← ties P1–P4 into the agent flow; ship last
```

Phases 1–3 are parallelizable. Phase 5 is the integration layer and must land
after the ops it calls exist.

---

## Phase 1 — Valid check (`check`)

**Goal:** `runCheck` core op surfaced as MCP `workspace_check` + CLI `check`,
wired into pre-commit. Design ref: §4.

| # | Task | File |
|---|------|------|
| 1.1 | `CheckOptions` / `CheckFinding` / `CheckResult` types + `runCheck` | `src/core/operations/check.ts` |
| 1.2 | Rule engine: load `workspace.rules.json`, evaluate STRUCT/CFG/TMPL/CTX/GRAPH rules | `src/core/operations/check.ts` (+ `core/util/` helpers as needed) |
| 1.3 | `--fix` for `autoFixable` findings (mkdir, scaffold empty config) | same |
| 1.4 | Default rule config | `scaffold/.ai-spector/.docflow/config/workspace.rules.json` |
| 1.5 | `formatCheck(result)` | `src/interfaces/cli/format/check.ts` |
| 1.6 | CLI `check [--json] [--fix]` handler | `src/cli.ts` |
| 1.7 | MCP tool `workspace_check({ fix? })` | `src/interfaces/mcp/tools/check.ts` |
| 1.8 | Zod schema + registration | `src/interfaces/mcp/schemas.ts`, `server.ts` |
| 1.9 | SDK re-export `runCheck`, `CheckResult` | `src/interfaces/sdk/index.ts` |
| 1.10 | Pre-commit: call `ai-spector check` non-interactive; non-zero exit on `error` | `src/core/operations/hooks.ts` + `hooks-constants.ts` |
| 1.11 | Tests: rule pass/fail, `--fix`, exit codes | `tests/operations/check.test.ts` |

**Acceptance:** `npx ai-spector check` exits non-zero on a broken workspace,
lists findings; `--fix` creates missing dirs; pre-commit blocks a commit when
structure is invalid; MCP tool returns identical `CheckResult`.

---

## Phase 2 — Context store (clarify persistence)

**Goal:** typed store for clarifying Q&A. Design ref: §6 (one file per doc type).

| # | Task | File |
|---|------|------|
| 2.1 | `ContextEntry` / `ContextStore` types; `listContext` / `recordContext` / `resolveContext` ops | `src/core/operations/context.ts` |
| 2.2 | Store IO: read/write `.ai-spector/.docflow/context/<docType>.json`, id allocation (`Q-NNN`) | same (+ `core/util/fs.js`) |
| 2.3 | JSON schema for the store | `schemas/context-store.schema.json` |
| 2.4 | `formatContext*` | `src/interfaces/cli/format/context.ts` |
| 2.5 | CLI `context list|record|resolve` | `src/cli.ts` |
| 2.6 | MCP `context_list` / `context_record` / `context_resolve` + Zod | `interfaces/mcp/tools/context.ts`, `schemas.ts`, `server.ts` |
| 2.7 | SDK re-exports | `src/interfaces/sdk/index.ts` |
| 2.8 | Tests | `tests/operations/context.test.ts` |

**Acceptance:** agent can record an answered question, list open ones for a doc
type, and resolve them; round-trips through both CLI and MCP.

---

## Phase 3 — Extracted-spec review queue

**Goal:** stage-5 specs land pending, merge to graph only on approval; kept out
of `docs/data-source/`. Design ref: §6.4, §8. Reuse `review-queue` patterns from
`src/core/operations/review.ts`.

| # | Task | File |
|---|------|------|
| 3.1 | `ExtractedSpec` types; `listSpecs` / `recordSpecs` / `approveSpec` / `rejectSpec` ops | `src/core/operations/extracted.ts` |
| 3.2 | Store IO `.ai-spector/.docflow/extracted/<docType>.json` (status: pending/approved/rejected) | same |
| 3.3 | On approve → emit graph patch and `graph merge` | reuse `graph-merge.ts` |
| 3.4 | Formatter + CLI `spec list|approve|reject` | `format/extracted.ts`, `cli.ts` |
| 3.5 | MCP `spec_list` / `spec_approve` / `spec_reject` + Zod | `interfaces/mcp/tools/extracted.ts`, `schemas.ts`, `server.ts` |
| 3.6 | SDK re-exports | `sdk/index.ts` |
| 3.7 | Tests incl. approve→graph-merge path | `tests/operations/extracted.test.ts` |

**Acceptance:** extracting specs writes pending entries; approve merges to graph;
reject drops them; nothing is ever written to `docs/data-source/`.

---

## Phase 4 — Staleness wiring

**Goal:** context entries flip `stale` when their `sourceRefs` change. Design
ref: §6.3. Touches existing ops — run `gitnexus_impact` before editing.

| # | Task | File |
|---|------|------|
| 4.1 | On `index`/`analyze`, compare `sourceRefs` mtime vs `answeredAt`; flip to `stale` | `src/core/operations/index.ts`, `bootstrap.ts` (analyze path) |
| 4.2 | `check` rule CTX-001 surfaces stale entries (already stubbed in P1 config) | `check.ts` rule |
| 4.3 | Tests: edit a source → entry goes stale → next clarify re-asks only that gap | `tests/operations/context-staleness.test.ts` |

**Acceptance:** editing a referenced data-source file marks dependent answers
stale; `check` warns; clarify re-asks only stale questions.

---

## Phase 5 — Skill / doc rewrite (the gate flow)

**Goal:** wire P1–P4 into the agent's generate flow as the 5 stages. No TS.
Design ref: §3, §5, §7, §7.1, §8, §10.

| # | Task | File |
|---|------|------|
| 5.1 | Rewrite generate flow: replace Scope/Plan with `CHECK → CLARIFY → BRIEFING → PLAN → GENERATE → EXTRACT`; make plan + briefing mandatory | `scaffold/cursor/skills/ai-spector/references/generate-workflow.md` |
| 5.2 | New reference: Clarify (gap-set computation, full-resolution rule §11.4) | `.../references/clarify.md` |
| 5.3 | New reference: Context store usage (record/resolve, scope field) | `.../references/context-store.md` |
| 5.4 | New reference: Context briefing template (§7.1) + plan table (§7) | `.../references/plan-and-briefing.md` |
| 5.5 | New reference: Extract & spec review queue (§8) | `.../references/extract-specs.md` |
| 5.6 | Each `ai-spector-generate-*` SKILL: add "run check + load context store" to **Load at start** | `scaffold/cursor/skills/ai-spector-generate-*/SKILL.md` |
| 5.7 | Update pipeline diagrams + intent tables | `scaffold/cursor/WORKFLOW.md`, `scaffold/cursor/commands/_workflow.md` |
| 5.8 | New skill `ai-spector-check` (or fold into setup skill) for "validate my workspace" | `scaffold/cursor/skills/ai-spector-check/SKILL.md` |
| 5.9 | Skill router entries for check + clarify intents | `scaffold/cursor/skills/_skill-router.md` |

**Acceptance:** a "generate SRS" request runs valid-check, resolves all gaps,
shows a context briefing + plan, writes only after `yes`, then offers spec
extraction → review queue. `docs/data-source/` untouched by the loop.

---

## Cross-cutting

- **Build/test gates:** `npm run build` + `npm test` green after each phase
  (ignore the known `tests/commands/init.test.ts` failure per CLAUDE.md).
- **Architecture rules:** no console.log in `src/core/`; every `run*` returns a
  typed result; update all three interface adapters when a result shape changes;
  `.js` import extensions.
- **Impact analysis:** run `gitnexus_impact` before editing `index.ts`,
  `bootstrap.ts`, `graph-merge.ts`, `hooks.ts` (Phases 3–4) and report blast
  radius; `gitnexus_detect_changes` before each commit.
- **Docs:** update `ARCHITECTURE.md` MCP tool table + `CLAUDE.md` review-tools
  table style with the new `workspace_check` / `context_*` / `spec_*` tools.

## Suggested PR breakdown

| PR | Contents |
|----|----------|
| PR1 | Phase 1 (check) — standalone value, CI/pre-commit |
| PR2 | Phase 2 + 4 (context store + staleness) |
| PR3 | Phase 3 (extracted-spec queue) |
| PR4 | Phase 5 (skill/doc rewrite) — flips the agent onto the new flow |
