# CLI failures

**Load this file only when a CLI command fails.** Do not pre-load.

When any `npx ai-spector` command exits non-zero or returns invalid JSON:

1. **Pause** — no writing, no silent fallbacks.
2. **Report** with the format below.
3. **Offer recovery** — fix + retry (default), or bounded workaround if approved.
4. **Wait** — then continue the same task from the failed step.

Auto-fix without asking: typo in seed id, missing parent dir, wrong cwd — fix and retry once.
Must ask user: deleting graph files, large manual edits, any workaround not listed below.

---

## Report format

```
## Blocked: <command> failed
**Command:** `npx ai-spector <subcommand>`  **Exit:** <n>
**Output:** <paste stdout/stderr>
**Means:** <one sentence>
**Fix:** <steps> then re-run `<same command>`
**Workaround (if any):** <bounded scope + trade-off>

Reply: 1 Fix & retry  2 Workaround  3 Pause
```

---

## Common fixes

| Error | Fix |
|---|---|
| `command not found` | `npm install ai-spector`; use `npx ai-spector` |
| `Could not find project root` | Run `npx ai-spector init`; check cwd |
| `analyze` fails | Show full error; check registry exists; re-run init if corrupt |
| `merge` — no domain entries | Re-run `/analyze`; ensure data-source has UC/F/actor content |
| `merge` — missing target node | Fix section id from `section-registry.json`; re-merge |
| `validate` — DOC-SECTION-COVERAGE | Run `npx ai-spector index` then re-merge and re-validate |
| `validate` — DOMAIN-ANCHORED / SCHEMA | Re-run analyze; patch only the single bad node/edge |
| `graph query` — empty subgraph | Wrong id or domain not merged; run analyze first |
| `graph query` — invalid JSON | Re-run from project root; report as bug if repeats |
| `index` fails on one path | Fix the path; re-index; do not skip required wave index without user OK |
| Stale graph after manual edits | `npx ai-spector index`; re-run `/analyze` for fully stale domain |

---

## Workarounds (user approval required)

| Situation | Workaround | Restore |
|---|---|---|
| `graph query` thin nodes | Read `projectionPaths` + cited data-source files only (no `docs/srs/**` glob) | `graph merge` + validate after draft |
| `validate` — one bad id/edge | Patch single node/edge; re-validate | Must pass before next wave |
| `index` fails one path | Skip that path if allowed; re-index after fix | Re-run index |
| Upstream SRS missing | Generate SRS prerequisite first (user approves) | Full pipeline order |

After any workaround that wrote docs: `graph validate` (+ `index` if required) before next wave.

**Forbidden without user approval:** hand-edit graph at scale · glob `docs/srs/**` as primary context · skip `graph merge` · continue generation after validate errors.

---

## Template-import fallback (MCP unavailable)

Prefer MCP when descriptors are current. **Do not** deep-import `node_modules/ai-spector/dist/core/operations/*` via `node -e`.

| Operation | MCP | CLI | SDK (`ai-spector`) |
|-----------|-----|-----|---------------------|
| Create import task | `task_create` | `npx ai-spector task create -k import -w template-import -t "…"` | `runTaskCreate` |
| Patch task / steps | `task_update` | `npx ai-spector task update <id> --patch '<json>' --json` | `runTaskUpdate` |
| Approve pack design | `task_approve_pack_design` | `npx ai-spector task approve-pack-design <id> --design-spec <path>` | `runTaskApprovePackDesign` |
| Approve manifest plan | `task_approve_import_plan` | `npx ai-spector task approve-import-plan <id>` | `runTaskApproveImportPlan` |
| Install pack | `template_install` | `npx ai-spector template install` | `installTemplateFromStaging` |
| Scan / infer | `template_scan` / `template_infer` | `npx ai-spector template scan …` / `template infer` | — |

If MCP and CLI both fail for a gated step, **stop and report** — do not invent export names or shell one-liners.

Full table: `ai-spector-template-import/references/import-aspects.md`.

---

## Filing a feedback report

Write a feedback report whenever the **tool or workflow itself caused friction** — even if the agent recovered. A workaround that worked is still a signal the tool should be improved.

Triggers (write even if agent fixed it):
- Error message gave no actionable fix steps
- CLI silently ignored an argument or flag
- Agent had to do extra undocumented steps to complete the task
- Documented behavior contradicts what the CLI actually does
- Command output implied success when something did not actually run
- Workflow required manual edits that the docs say you should not do

Load `@feedback-report.md` for the full template and instructions.
Save the report to `docs/feedback/YYYY-MM-DD-<short-slug>.md` and tell the user where it was saved.
