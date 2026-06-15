# Builtin vs custom pack — gap matrix

Use during import to ensure custom packs reach parity with builtin SRS workflow.

| Capability | Builtin SRS | Custom pack (after install) | Who completes |
|------------|-------------|-----------------------------|---------------|
| Templates | `.ai-spector/templates/srs/` | `.ai-spector/packs/<pack>/templates/` | Install |
| DAG + graph seeds | `doc-types/srs/dag.json` | Regenerated from manifest | Install (CLI) |
| Generate hints | runbook + DAG | `generate-hints.md` | Install (CLI) |
| Readiness criteria | `doc-types/srs/readiness-criteria.json` | `readiness-criteria.json` + config copy | Install + **user review** |
| Completeness rules | `doc-types/srs/completeness-rules.json` | `completeness-rules.json` | Install |
| Gated workflow | `generate-workflow.md` | `workflow-setup.md` + skill | Install + **agent skill** |
| Context store | `context/srs.json` | `context/<docType>.json` | Install (empty) + **clarify** |
| Per-chapter context | `srs-context/*.md` | `pack-context/*.md` | Install + **agent review** |
| Placeholder map | implicit in templates | `context-map.json` | Install + **agent+user TODOs** |
| Task workflow | `generate-srs` | `generate-<pack>` + slot `generate:<pack>` | Install (code) |
| Task gate rules | TASK-002/003 for `docs/srs/` | Same for pack output paths | Install (code) |
| Install completeness | init scaffold | `pack-setup.json` + `install-checklist.md` | **Phase 7** |
| Setup check | — | PACK-001 in `workspace_check` | After Phase 7 |
| Generate skill | `ai-spector-generate-srs` | `ai-spector-generate-<pack>` | Phase 5 + install |
| Incremental continuation | `incremental-continuation.md` | Same reference | Agent |
| Spec extract | `extract-specs.md` | Same (if requirements pack) | Agent |
| Multi-language | `docflow.config.json` | User confirms Q8 | **User** |
| Graph domain nodes | analyze → index | User confirms Q9 | **User** |

## Still manual (by design)

- **Domain knowledge** — auto criteria from headings cannot replace user answers.
- **Custom graph schema** — non useCase/feature perDomain needs manual breakout workflow.
- **Tailoring profiles** — `readiness_profiles_list`, `readiness_assess` with `profile: regulated` | `arc42` (see `context-readiness.md`).

## Definition of done

```bash
npx ai-spector template inspect <pack> --json
# setupStatus: "ready", contextMapTodos: 0
npx ai-spector check
# no PACK-001 warning
```
