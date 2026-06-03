# CLI failures

**Load this file only when a CLI command fails.** Do not pre-load.

When any `ai-spector` command exits non-zero or returns invalid JSON:

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
**Command:** `ai-spector <subcommand>`  **Exit:** <n>
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
| `validate` — DOC-SECTION-COVERAGE | Run `ai-spector index` then re-merge and re-validate |
| `validate` — DOMAIN-ANCHORED / SCHEMA | Re-run analyze; patch only the single bad node/edge |
| `graph query` — empty subgraph | Wrong id or domain not merged; run analyze first |
| `graph query` — invalid JSON | Re-run from project root; report as bug if repeats |
| `index` fails on one path | Fix the path; re-index; do not skip required wave index without user OK |
| Stale graph after manual edits | `ai-spector index`; re-run `/analyze` for fully stale domain |

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
