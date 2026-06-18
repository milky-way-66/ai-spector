# Import clarify (smart, aspect-driven)

**Forbidden:** numbered lists of 5–9 generic questions; re-asking aspects already `resolved` or `inferred`; ignoring `template_infer` output.

## MCP sequence (mandatory when server enabled)

1. `template_scan({ sourcePath })`
2. `task_create({ kind: "import", workflow: "template-import", trigger: "…" })`
3. `workspace_check` → mark `check` done via `task_update`
4. `template_infer({})` → `aspectCoverage[]` + `supplementalQuestions[]`
5. Store inference in import plan via `task_update` (`plan.aspectCoverage`, `plan.supplementalQuestions`)

## Message 1 — Scan digest (facts only, no questions)

Per file from `scanDigest` or `scan-result.json`:

```
detailed-design.md
  headings: 機能別アーキテクチャ検討 → ディレクトリ構成 → …
  placeholders: {id}, {keyword} (if any)
  signals: filled-example-candidate, purpose:detail-design
```

Call out **filled-in examples** vs real templates (concrete H1, code-snippet “placeholders”).

## Message 2 — Aspect coverage table

| Aspect | Status | Scan says | Needed for |
|--------|--------|-----------|------------|

Use `template_infer` rows. Do **not** invent statuses.

## Message 3 — Gaps only

Ask **only** for aspects with status `unknown` or `ambiguous`, plus `supplementalQuestions` with `status: "open"`.

| Status | Agent action |
|--------|----------------|
| `resolved` | State fact — **no question** |
| `inferred` + high/medium | **Confirm-or-correct batch** — one summary block, not 7 separate MCQ menus |
| `unknown` / `ambiguous` | One gap question each |

**One message** for confirm-or-correct batch:

> Proposed (confirm or correct any line):
> - Purpose: detail-design (per-feature)
> - Pack: detailed-design
> - Output: docs/detail-design/
> - Standards: team-internal
> - …

Then **separate** gap questions only for true unknowns (e.g. doc-purpose if still unknown).

## After user answers

1. `task_update` — set `confirmedAt` / `userValue` on aspects; resolve supplementals (`status: "resolved"`, `answer`)
2. Mark `clarify` done only when `isImportClarifyComplete` would pass
3. Continue → pack design spec → `task_approve_pack_design`

See [import-aspects.md](./import-aspects.md) for aspect registry and supplemental rules.
