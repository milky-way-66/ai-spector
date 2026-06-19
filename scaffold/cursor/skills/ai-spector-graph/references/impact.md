# Task: impact

Scope regen after a change. **You describe what changed** — not a graph node id. The agent resolves the traceability seed, then runs `graph impact` ([graph.md](../../ai-spector/references/graph.md), [WORKFLOW.md](../../WORKFLOW.md)).

## Usage

- `/impact` — **current git changes** (staged + unstaged); if no diff, use selection, open file, @-attached paths
- `/impact current change` / “what’s the impact of what I changed?” — same as empty `/impact`
- `/impact {what you changed}` — natural language, e.g. `changing UC-3 acceptance criteria`, `add API endpoint in docs/basic-design/5-interfaces.md`
- `/impact this section` — selection or cursor section is the anchor

**Do not ask the user for `sec.*` / `doc.*` ids.** Resolve them yourself.

## Prerequisites

- `npx ai-spector graph validate` passes

## Current git change (default when no args)

When the user means **current change**, **my edits**, or runs `/impact` with no description:

### 1. Collect diff (agent runs in terminal)

Prefer one combined view of **staged + unstaged** vs last commit:

```bash
git diff HEAD
```

If the repo has **no commits yet**, use both (concatenate in order):

```bash
git diff
git diff --cached
```

Optional CLI (same resolution + merged buckets):

```bash
npx ai-spector graph impact --git --change content_change --json
```

**Not a git repo** or **clean working tree** → tell the user clearly; suggest `/impact <short description>`, editor selection, or `@path`.

### 2. Parse diff → regions

From the unified diff text:

| Signal | Use for seed |
|--------|----------------|
| `+++ b/<path>` / `--- a/<path>` | Repo-relative **file** |
| `<!-- section:sec.... -->` in hunk | **Section anchor** |
| `+### …` / `-## …` / context ` ### …` | **Heading** fragment |

Prioritize regions under `docs/` and `.ai-spector/` when many files changed. Group the report **by file**.

Map regions with the same rules as below (`resolveImpactOrigins` / graph JSON). In code: `resolveFromGitDiff(diff, graph)` (or CLI `--git`).

### 3. Run impact per seed, unify report

For each file/region, pick the **most specific** seed (`section` > domain > `document`). Dedupe seeds by id, then run impact (MCP preferred, CLI fallback):

```
graph_impact({ originId: "<id>", change: "content_change" })
# or for all git seeds at once:
graph_impact({ git: true, change: "content_change" })
```

```bash
# CLI fallback:
npx ai-spector graph impact <originId> --change content_change --json
npx ai-spector graph impact --git --change content_change --json
```

Merge `regenerate` / `review` / `syncUpstream` across seeds (CLI `--git` dedupes). Present one table with `projectionPath`; note which file/heading each seed came from (`gitSeeds` in JSON when using `--git`).

### Upstream sync (layer drift)

When editing **basic design** or **detail design**, upstream SRS may also need review:

```bash
npx ai-spector graph impact --git --direction both --change content_change --json
```

```text
graph_impact({ git: true, change: "content_change", direction: "both" })
```

- **`regenerate`** / **`review`** — downstream docs to regen or review (existing behavior)
- **`syncUpstream`** — upstream SRS sections that may be stale (suggest-only)

If `syncUpstream` is non-empty, offer **`ai-spector-resolve-task`** (Standard tier) spanning affected SRS paths — do not auto-regenerate upstream docs.

## Resolve change → graph seed (agent)

Gather context from the message (priority order):

1. **Git diff** — when no args / “current change” (see above)
2. **Explicit graph id** in text only if it clearly is one (`sec.srs.3.2`, `UC-01`, `doc.srs.3-use-cases`) — verify with graph JSON or `graph query <id> --json`
3. **File path** — `@docs/srs/3-use-cases.md`, path in user text, or file from open editor
   - Document: match `output` / `outputPattern` on `document` nodes (same rules as index)
   - Optional CLI: `npx ai-spector graph impact --file <path> --json`
4. **Section anchor** — `<!-- section:sec.uc01.main-flow -->` in the file body
5. **Heading / selection** — map heading text to `section` nodes (`heading` field); scope by file when known
   - Optional CLI: `npx ai-spector graph impact --file <path> --heading "<heading fragment>" --json`
6. **Domain entity** — `UC-3`, `F-12`, feature title from user text → `useCase` / `feature` nodes via label/id search in graph or registry
7. **New / added file** — treat as `content_change` on the **document** node for that path, or the parent section if the file is a per-domain detail doc (`docs/srs/uc-*.md`)

If several nodes match, pick the **most specific** seed: `section` > domain (`useCase`, `feature`, …) > `document`. If still ambiguous, ask **one** short clarifying question (never ask for raw node id format).

## Run impact

**Use MCP when the `ai-spector` server is configured. Fall back to CLI otherwise.**

### MCP (preferred)

```
graph_impact({ originId: "<id>", change: "content_change" })
graph_impact({ git: true, change: "content_change" })
graph_impact({ file: "docs/srs/3-use-cases.md", heading: "3.2 List Use Case", change: "content_change" })
```

### CLI fallback

```bash
npx ai-spector graph impact <originId> --change content_change --json
npx ai-spector graph impact --git --change content_change --json
npx ai-spector graph impact --file docs/srs/3-use-cases.md --heading "3.2 List Use Case" --json
```

After resolving `originId` (one primary seed per region; run again for unrelated regions if needed):

1. Parse JSON output:
   - `regenerate` / `review` arrays — traceability impact buckets
   - `noTraceabilityImpact: true` — changed files are not in the graph (e.g. config, prototype, source code); tell the user "no doc traceability impact found" and skip regen suggestions
   - `truncated: true` — BFS hit the propagation cap; warn the user results may be incomplete
   - `resolvedFrom` / `gitSeeds` — which file/heading each seed came from (present with `--file` / `--heading` / `--git`)
2. Present a table with `projectionPath` per entry.
3. For each **regenerate** id, suggest `/generate-srs` or `/generate-basic-design` using MCP `graph_query({ id: "<thatId>" })` or CLI:

```bash
npx ai-spector graph query <thatId> --json
```

**Do not** implement impact BFS in the agent.

## UX examples

| User context | Resolution approach |
|--------------|---------------------|
| `/impact` (no args) | `git diff HEAD` (or unstaged + staged) → regions → seeds → `graph impact --git` or per-seed |
| `/impact current change` | Same as empty `/impact` |
| Selection in `docs/srs/3-use-cases.md` | Heading → `section`; else document for file |
| `/impact add endpoint doc in docs/basic-design/5-interfaces.md` | Path → `document` or section under that doc |
| Edited UC-3 acceptance criteria | Text → `UC-03` / `useCase` + `definedIn` section if identifiable |
| Attached new `docs/srs/uc-04.md` | Path → per-domain document node; impact of adding file |

## If blocked

Use [cli-failures.md](../../ai-spector/references/cli-failures.md). If resolve or `graph impact` fails, show CLI output and fix — do not invent regenerate lists.

## After doc edits (automatic rule)

When finishing edits under `docs/srs/`, `docs/basic-design/`, or `docs/detail-design/`, agents should run this impact flow per `.cursor/rules/ai-spector-after-doc-edit.mdc`, then `npx ai-spector index`.

## Guardrails

- No whole-repo regen outside CLI buckets.
- No regen plan if impact CLI failed.

## Migration

`/graph-impact` is deprecated — use **`/impact`** (this command). Old name may remain as a stub that points here.
