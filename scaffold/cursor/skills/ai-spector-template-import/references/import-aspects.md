# Import aspect registry

Clarify fills **required aspects** the scan could not resolve, plus **supplemental questions** when the scan surfaces more. Do not dump a fixed question list.

## MCP first, CLI when MCP fails

Prefer MCP when the ai-spector server is enabled and tool descriptors are current. **If MCP is unavailable, stale, or rejects import enums — use the CLI column below** (same gates, same behavior).

| Step | MCP tool | CLI fallback |
|------|----------|----------------|
| Scan templates | `template_scan({ sourcePath })` | `npx ai-spector template scan <path>` |
| Aspect coverage | `template_infer({})` | `npx ai-spector template infer` |
| Bootstrap task | `task_create({ kind: "import", workflow: "template-import", … })` | `npx ai-spector task create -k import -w template-import -t "…"` |
| Workspace check | `workspace_check({})` | `npx ai-spector check` |
| Patch task / steps | `task_update({ taskId, patch })` | `npx ai-spector task update <taskId> --patch '<json>'` |
| Pack design gate | `task_approve_pack_design({ designSpecPath })` | `npx ai-spector task approve-pack-design <taskId> --design-spec <path>` |
| Manifest plan gate | `task_approve_import_plan({ taskId })` | `npx ai-spector task approve-import-plan <taskId>` |
| Validate pack | `template_validate({ pack, sync: true })` | `npx ai-spector template verify …` |
| Mark readiness | `template_setup_mark({ pack, itemId })` | `npx ai-spector template setup-mark …` |
| Install (gated) | `template_install({})` | `npx ai-spector template install` (needs approved import task; `--legacy` only as human escape hatch) |
| Complete | `task_complete({ taskId })` | `npx ai-spector task complete <taskId>` |

Gate error hints list MCP tool names first; use the matching CLI command when MCP cannot be called.

## Required aspects (minimum checklist)

| Aspect ID | Needed for |
|-----------|------------|
| `doc-purpose` | `manifest.purpose`, `docType`, readiness profile |
| `doc-shape` | single vs repeating files, DAG seeds |
| `domain-vocabulary` | `perDomain`, `outputPattern`, generate wave 1 |
| `list-detail-pairs` | `defaultListedIn`, generate-hints |
| `pack-identity` | `packName`, `nodePrefix`, skill name |
| `output-routing` | `manifest.output*`, task gate paths |
| `standards-alignment` | `manifest.standards`, readiness severity |
| `requirements-model` | extract-specs, completeness rules |
| `locale-strategy` | `docflow.config.json`, `{lang}` outputs |
| `graph-seeds` | `pack-setup` graph prerequisites |

These 10 are **not a cap**. Ask more when the scan requires it.

## Supplemental questions

`template_infer` returns `supplementalQuestions[]` for scan triggers outside the core aspects, e.g.:

- Multiple top-level template folders
- Repeating file without clear domain noun
- Uncommon `{placeholders}`
- Files with no headings
- Non-builtin `perDomain` (manual breakout)

**Agent may add more** via `task_update` on `ImportPlan.supplementalQuestions` when you notice ambiguity while reading templates.

Resolve each (`status: "resolved"`, `answer`, `resolvedAt`) or add new ones before marking `clarify` done.

## Workflow

1. `template_scan({ sourcePath })`
2. `task_create({ kind: "import", workflow: "template-import", trigger: "…" })`
3. `template_infer({})` → read `aspectCoverage` + `supplementalQuestions`
4. Post **scan digest** (facts per file, no questions)
5. Show **aspect coverage table**
6. For each core gap + open supplemental: one message — **Aspect/trigger · From scan · Unlocks · A/B/C**
7. Summary → user approves → `task_update` clarify step done

## Gap question template

```
Trigger: scan:placeholder:customerId
From scan: uncommon {customerId} in srs/introduction.md
Unlocks: context-map.json mapping

How should customerId be populated at generate time?
A) From context store  B) From graph node  C) Other: ___
```

## Graph note

Builtin first-class domain types: `useCase`, `feature`, `requirement`, `nfr`. Other `perDomain` values work in manifest but need **manual breakout** — surface via supplemental + `graph-seeds` aspect.
