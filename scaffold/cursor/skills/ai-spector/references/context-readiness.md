# Context readiness assessment (before Clarify questions)

The Clarify stage must **not** jump straight to a few ad-hoc questions. First run a
structured **readiness assessment**: inventory what exists, map it to what each target
chapter needs, score gaps, then ask the user to fill blocking holes.

Standards grounding (see `standards[]` in criteria file):

| Standard | Used for |
|----------|----------|
| **ISO/IEC/IEEE 29148:2018** | SRS content §9.6, requirement quality §5.2, verification §9.6.19 |
| **ISO/IEC/IEEE 15288 / 12207** | Life-cycle process alignment (elicitation → specification) |
| **ISO/IEC 25010** | Quality attribute taxonomy for §7 |
| **IEEE 830** (superseded) | Legacy outline — mapped via 29148 |
| **CPRE Elicitation** | System context, requirements sources |

Machine-readable criteria: `.ai-spector/.docflow/config/doc-types/<docType>/readiness-criteria.json`

**Prefer MCP** (CLI only if MCP unavailable):

```
readiness_config({})                    // active profile per doc type — call first
readiness_profiles_list({})
readiness_get_criteria({ docType: "srs" })
readiness_assess({
  docType: "srs",
  targets: ["srs.3-use-cases", "srs.4-system-features"]
})
readiness_scan({ updateLastScan: true }) // after changing config — check existing docs
```

Configure in `.ai-spector/docflow.config.json`:

```json
{
  "readiness": {
    "profile": "regulated",
    "standards": ["ISO-29148", "IEC-62304"],
    "docTypes": {
      "srs": { "profile": "regulated", "enabled": true },
      "basic-design": { "profile": "general", "enabled": true }
    }
  }
}
```

### Three layers — do not confuse them

| Layer | Source | Question answered | When |
|-------|--------|-------------------|------|
| **Intent** | `docflow.config` → `readiness.standards[]` | Which standards does the project declare? | Reporting / alignment check |
| **Input assess** | `doc-types/<docType>/readiness-criteria.json` → `standards[]`, per-criterion `iso29148` | Enough context to write? | CLARIFY (`readiness_assess`) |
| **Output structure** | `doc-types/<docType>/completeness-rules.json` | File structure valid (headings, no TODO/TBD)? | After GENERATE (`readiness_scan`) |
| **Output semantic** | `readiness_output_checklist` + **agent** | Written prose covers ISO criteria? | After GENERATE — [output-compliance.md](./output-compliance.md) |
| **Review sign-off** | `review_status.readiness` + custom JSON in `review-checklists/` | Current doc meets ISO + team gates? | `/review` — [custom-checklists.md](../../ai-spector-review/references/custom-checklists.md) |

`readiness.standards` in docflow.config is **metadata** — it does not drive scoring.
`readiness_assess` always uses the merged criteria file. Call `readiness_config({})` first
to see active files, profile, and `standardsAlignment` per doc type.
`readiness_assess` also returns `standardsAlignment` when config tags do not match the criteria file.

After changing `profile`, run `readiness_scan({ updateLastScan: true })` — `workspace_check` reports **READY-002** until scan baseline is updated.

`readiness_assess` returns structured JSON: `ready`, `summary`, `criteria[]`, `blockingGaps`, `questionsForUser`, `inventory`.

**Tailoring profiles** (bundled in `readiness/profiles/` — one JSON file per profile):

| Profile | File | Use |
|---------|------|-----|
| `general` | `general.json` | Default ISO SRS baseline (`default: true`) |
| `regulated` | `regulated.json` | Extends SRS — safety class, V&V, traceability, audit gates |
| `arc42` | `arc42.json` | Replaces SRS — architecture doc (arc42 sections) |

Set default in `.ai-spector/docflow.config.json`:

```json
{ "readiness": { "profile": "regulated" } }
```

**Resolve path by active pack** (read `.ai-spector/docflow.config.json`):

| `packs.srs` | Readiness file |
|-------------|----------------|
| `"builtin"` | `doc-types/srs/readiness-criteria.json` (v2 — full ISO SRS) |
| `"<custom>"` | `readiness-criteria.<custom>.json` — auto-generated on `template install` |
| either | Pack copy: `.ai-spector/packs/<pack>/readiness-criteria.json` |

Custom packs: criteria are derived from template **headings + placeholders** at install time.
See `ai-spector-template-import/references/readiness-setup.md`.

Each criterion has `iso29148` ref (when applicable), `severity`, `graphProbe`, and optional `webSearchWhen`.

## When to run

After **CHECK** (`workspace_check`) and **scope selection** (which DAG nodes / files this
run targets), **before** presenting Clarify questions or the context briefing.

Mark task progress when starting and finishing:

```
task_update({ patch: { phase: "clarify", step: { id: "clarify", patch: { status: "in-progress" } } } })
// … readiness_assess → present FULL table (Step 4) …
task_update({ patch: { snapshot: { readinessReportShown: true } } })
// … gap resolution via context_record …
task_update({ patch: { step: { id: "clarify", patch: { status: "done" } } } })
```

**Hard gate:** `task_update` rejects `clarify: done` until `snapshot.readinessReportShown`
is true. Do not mark clarify done with a shortened summary — show ID, ISO ref, status, evidence.

## Step 1 — Derive targets from user request

| User signal | Targets |
|-------------|---------|
| "generate all SRS" | All DAG nodes in `doc-types/srs/dag.json` waves |
| Explicit paths (`docs/srs/en/3-use-cases.md`) | Map path → DAG node + dependency closure |
| "§3 + §4", "use cases and features" | `srs.3-use-cases`, `srs.4-system-features` (+ deps) |
| "trial / wave 0" | Only nodes in agreed wave — **still run readiness for those nodes** |

Load per-chapter graph→template mapping from `ai-spector-generate-srs/references/srs-context/`
when writing SRS.

## Step 2 — Inventory existing context

Collect evidence **before** judging gaps:

| Source | How to read | What it tells you |
|--------|-------------|-------------------|
| **Graph** | `graph_query` on DAG seed ids; `knowledge_status` | Entities, empty seeds, traceability |
| **Analysis gaps** | `.ai-spector/.docflow/analysis/gaps.json` | Known holes from last analyze |
| **Data-source** | List `docs/data-source/`; read files referenced in graph `definedIn` | Human-authored facts |
| **Context store** | `context_list({ docType, status: "open" })` + `"stale"` | Prior Q&A |
| **Disk artifacts** | Paths under `docs/srs/{lang}/` for targets | Already-written chapters |
| **User request** | Chat trigger text | Scope intent, constraints stated inline |

Optional — **domain web search** when:
- Industry/regulatory context is thin and criteria flag `webSearchWhen`
- User mentions unfamiliar domain ("healthcare billing", "ISO 27001")
- No data-source file covers standard practices for the domain

Use web search to learn **what sections typically need**, not to invent project-specific
requirements. Cite findings as "industry baseline"; still ask the user to confirm applicability.

## Step 3 — Score readiness per target

For each target chapter, evaluate criteria from `doc-types/<docType>/readiness-criteria.json`:

1. **Global criteria** (`globalCriteria`) — apply once per run.
2. **Target criteria** — match `dagNode` to selected targets.
3. For `perEntity: "useCase"` / `"feature"` — evaluate per UC-xx / F-xx in scope.

### Severity

| Severity | Meaning | Gate |
|----------|---------|------|
| **blocking** | Cannot produce a credible chapter without this | Must answer or user-accept assumption |
| **should-ask** | Quality risk if skipped | Ask; user may accept assumption |
| **nice-to-have** | Enriches doc | Note in briefing; skip unless user wants depth |

### Status per criterion

| Status | Rule |
|--------|------|
| **met** | Graph probe non-empty, or data-source/context answer covers field |
| **partial** | Some evidence but incomplete (e.g. actors exist, permissions missing) |
| **missing** | No graph nodes, no data-source, no prior answer |
| **stale** | Context store entry stale for this field |

`minGraphCount` not met → **missing** (or **partial** if user request names entities not yet in graph).

### Requirement quality gate (ISO 29148 §5.2)

When targets include **functional requirements** (`srs.feature-details`, `srs.use-case-detail`),
also score `requirementQuality.individualCharacteristics` (RQ-01…RQ-09) and
`requiredAttributes` (unique ID, priority, source, verification method).

Report in readiness summary:

```
Requirement quality readiness: 6/9 characteristics addressable from graph
Missing for generation: RQ-07 Verifiable (no acceptanceCriteria on FR-xx)
```

## Step 4 — Present readiness report (mandatory)

Show the user a table **before** the question batch. Include **ISO ref** column from
`criteria[].iso29148`. Then set `snapshot.readinessReportShown`. Example:

```
Readiness — generate SRS §3 + §4 (en)
Standards intent: ISO-29148 (config) — assess source: doc-types/srs/readiness-criteria.json

| ID | ISO | Dimension | Criterion | Status | Evidence | Gap |
|----|-----|-----------|-----------|--------|----------|-----|
| G-001 | 9.6.2 | scope | Product purpose | met | system.description + overview.md | — |
| G-003 | 5.2.2 | stakeholders | Actors | partial | 2 actors in graph, roles vague | permissions |
| §3-001 | 9.6.10 | graph | Use case list | missing | 0 useCase nodes | need UC list |
| §4-001 | 9.6.12 | graph | Feature list | missing | 0 feature nodes | need F list |

Blocking gaps: 3 | Should-ask: 2 | Met: 4

Cannot proceed to plan until blocking gaps are resolved.
```

If **web search** was used, add a short "Domain baseline" bullet list and mark which items
need user confirmation.

## Step 5 — Convert gaps → Clarify questions

Each **missing** or **partial** blocking criterion becomes a `context_record` question:

- Use the `question` template from readiness criteria; substitute `{UC-id}` / `{F-id}`.
- Group by dimension (scope → stakeholders → graph per chapter).
- **No question cap** — ask every blocking gap; batch should-ask in a second group.
- Store answers immediately ([context-store.md](./context-store.md)).
- Re-run readiness scoring after answers until **zero blocking gaps** remain.

Accepted assumptions: user explicitly approves agent text → `context_record` with
`source: "inferred"`.

## Step 6 — Handoff to Briefing

Output summary for [plan-and-briefing.md](./plan-and-briefing.md):

```
Readiness: 12/15 blocking met; 2 accepted assumptions; 1 stale re-confirmed
Clarified this run: Q-010, Q-011, Q-012
Domain search used: yes — PCI-DSS payment handling (user confirmed: not applicable v1)
```

## Per-doc-type notes

### SRS (builtin)

- Criteria file: `doc-types/srs/readiness-criteria.json`
- Graph probes: see `srs-context/*.md` for template↔graph mapping
- List chapters (§3, §4) need **entity lists** in graph; detail chapters need **per-entity fields**
- If graph is empty but user wants §3/§4: readiness will flag blocking — offer:
  (A) analyze data-source first, (B) user provides list in chat → record in context store,
  (C) generate skeleton with explicit assumptions (user must accept)

### Basic design

- Builtin: `readiness-criteria.basic-design.json` (when present)
- Same workflow; probes use `bd-context/` sections and `dag.basic-design.json`

### Custom template pack

- Installed via `template install` → `readiness-criteria.<packName>.json` + `workflow-setup.md`
- `context-map.json` TODO placeholders become **blocking** readiness gaps
- Generate skill must load `workflow-setup.md` and follow gated flow (not wave-only)

## Anti-patterns (do not)

- Skip readiness because "we already ran analyze once"
- Ask only 1–2 generic questions ("anything else?")
- Generate files when blocking criteria are **missing** without recorded assumptions
- Treat chat answers as stored — always `context_record` / `context_resolve`
- Web-search project-specific numbers (SLAs, user counts) — those must come from the user
