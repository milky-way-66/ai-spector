# Readiness & workflow setup (custom template packs)

During template import, ai-spector **auto-generates** the same class of artifacts
builtin SRS has — tailored to your manifest and scan result.

## Generated on `template install`

| Artifact | Location |
|----------|----------|
| Readiness criteria (input) | `.ai-spector/packs/<pack>/readiness-criteria.json` |
| Config copy | `.ai-spector/.docflow/config/doc-types/<pack>/readiness-criteria.json` |
| Completeness rules (output) | `.ai-spector/packs/<pack>/completeness-rules.json` |
| Workflow guide | `.ai-spector/packs/<pack>/workflow-setup.md` |
| Placeholder map | `.ai-spector/packs/<pack>/context-map.json` (existing) |

## How criteria are derived

1. **Global criteria (G-001…)** — ISO 29148-aligned scope, stakeholders, traceability, verification (always).
2. **Per-document criteria** — from template **headings** (h2–h4) and **{placeholders}**.
3. **Per-domain breakout** — inventory criterion for each `perDomain` type (useCase, feature, …).
4. **Severity** — `blocking` for purpose/scope/requirement-like headings; `should-ask` for deeper sections; unresolved placeholders → `blocking`.

## Agent responsibilities during import

### After Phase 2 (manifest draft) — show readiness preview

Tell the user:

> "On install, I will generate `readiness-criteria.json` from your template structure.
> You can refine it after install — same as builtin SRS criteria."

### Phase 1 — add 2 questions to the core set

After the 5 core questions, also ask:

6. **Standards** — Which standards should readiness align with? (e.g. ISO/IEC/IEEE 29148, arc42, internal only)
7. **Requirements depth** — Does this pack produce atomic verifiable requirements (FR/NFR), or narrative docs only?

Write answers into `manifest.json`:

```json
{
  "purpose": "SRS",
  "standards": ["ISO-29148", "ISO-25010"],
  "docType": "kaopiz-srs"
}
```

### After Phase 6 (install succeeds) — validate & ask user

```bash
npx ai-spector template verify <pack> --json
# MCP: template_validate({ pack: "<pack>" })
```

1. If `ready: false` — present **every** item in `questionsForUser` to the user
2. Update `manifest.json`, `context-map.json`, graph, languages per `gaps[].fix`
3. After user confirms readiness criteria: `template setup-mark <pack> readiness.reviewed`
4. Re-run `template verify <pack> --sync` until `ready: true`
5. Point to `workflow-setup.md` for gated generate flow

## Generate skill must include

When writing `generate-skill.md` (Phase 5), include:

```markdown
## Load at start
…
5. `.ai-spector/packs/<pack>/readiness-criteria.json`
6. `.ai-spector/packs/<pack>/workflow-setup.md`
7. [`context-readiness.md`](../ai-spector/references/context-readiness.md)
8. [`generate-workflow.md`](../ai-spector/references/generate-workflow.md)

## Step 0 — Task gate
task_list({ bootstrap: { kind: "generate", workflow: "generate-<pack>", docType: "<pack>", … } })

## Gated flow
CHECK → readiness report → CLARIFY → BRIEFING → PLAN → GENERATE
```

## Builtin vs custom resolution

| Active pack | Readiness file |
|-------------|----------------|
| `packs.srs: "builtin"` | `doc-types/srs/readiness-criteria.json` |
| `packs.srs: "<custom>"` | `readiness-criteria.<custom>.json` or pack dir copy |

Agent: read `docflow.config.json` → resolve path before clarify stage.
