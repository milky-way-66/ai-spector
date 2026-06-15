# Template Pack Import Runbook

Three-factor collaboration: **Human + AI (Cursor/Claude) + CLI**.
Follow phases in order. Do not skip ahead or run `template install` before Phase 3 is confirmed.

---

## Phase 0 — Check scan result exists

```bash
npx ai-spector template list
```

Then check whether `.ai-spector/packs/.staging/scan-result.json` exists (Read the file).

**If scan-result.json does NOT exist**, tell the user:

> "No scan result found. First run this command pointing at your template folder:
> `npx ai-spector template scan ./path/to/your-templates`
> Then come back and ask me to set up the template pack."

**Stop. Do not proceed to Phase 1 until the scan result is present.**

**If scan-result.json EXISTS**, read it and proceed to Phase 1.

---

## Phase 1 — Understand the template (5 core questions)

Read `.ai-spector/packs/.staging/scan-result.json`.

Show the user a brief summary:
- Number of files found
- List of file names with their placeholder inventory

Then ask all **5 core questions** together in one message, numbered:

1. **Purpose** — What is this template for? (SRS / basic design / architecture decision records / other — describe briefly)
2. **Repeating files** — Looking at the files and placeholders, which files repeat per item — one file generated per use case, feature, epic, story, etc.? (List them or say "none")
3. **Vocabulary** — What do you call those repeating items in your domain? (e.g. "use case", "feature", "epic", "user story", "module") — or "none" if no repeating files
4. **Pack name** — What should this template pack be called? (lowercase, hyphens ok — e.g. `kaopiz-srs`, `arc42`, `my-team-template`)
5. **Output location** — Where should generated docs go? (e.g. `docs/srs/`, `docs/requirements/`, `docs/design/`)
6. **Standards** — Which standards should readiness criteria align with? (e.g. ISO/IEC/IEEE 29148, arc42, team-internal only)
7. **Requirements depth** — Does this pack produce atomic verifiable requirements (FR/NFR), or narrative/docs only?

**Wait for the human to answer all 7 before proceeding.**

Record Q6–Q7 in the draft manifest as `standards[]`, `purpose`, and `docType` (defaults to pack name — see [readiness-setup.md](./readiness-setup.md)).

8. **Languages** — Single language or multi-language outputs? If multi: confirm `docflow.config.json` `languages[]` and `{lang}` in output paths.
9. **Graph prerequisites** — Is data-source already analyzed? Which graph node types must exist before generate (useCase, feature, requirement, …)?

### Follow-up rules

The AI must ask follow-up questions whenever answers are ambiguous or incomplete:

- If the user says "features" but the template has both feature-list and feature-detail files → ask which is which
- If the output path seems to conflict with existing project folders → flag it and ask to confirm
- If the pack name contains uppercase or spaces → suggest a corrected slug and ask to confirm (e.g. "My SRS" → `my-srs`)
- If the purpose is too vague (e.g. "documentation") → ask one more narrowing question
- If repeating files are listed but vocabulary is unclear → ask for the singular noun (e.g. "use case" not "use cases")

Keep asking until you have high confidence in all 5 answers. There is no hard limit on follow-up questions.

---

## Phase 2 — Draft the manifest and show for review

Using the scan result + the human's answers, draft the `manifest.json`.

### Drafting rules

- `packName` = the answer to Q4 (pack name)
- `nodePrefix` = `"doc." + packName.replace(/-/g, ".")` (e.g. `kaopiz-srs` → `"doc.kaopiz.srs"`)
- `templatesDir` = `"templates"`

For **each file** in `scan-result.json files[]`:
- `documentId` = `nodePrefix + "." + slugify(filename without extension)`
  - slugify: lowercase, replace non-alphanumeric characters with `.`, collapse consecutive dots
  - Example: `use-case-detail.md` → `doc.kaopiz.srs.use.case.detail`
- `template` = the `relativePath` from scan-result (exactly as written)

If the file is a **repeating file** (identified in Q2):
- `outputPattern` = output-root + vocabulary-slug + `/{nn}-{slug}.md`
  - Example: use cases in `docs/srs/` → `docs/srs/use-cases/uc-{nn}-{slug}.md`
  - If the project uses per-language subfolders (e.g. `docs/srs/en/`), include `{lang}` in the pattern:
    `docs/srs/{lang}/requirements/req-{nn}-{slug}.md`
- `perDomain` = camelCase of the vocabulary from Q3 (e.g. `"use case"` → `"useCase"`, `"feature"` → `"feature"`, `"epic"` → `"epic"`, `"requirement"` → `"requirement"`)

> **Note on perDomain vocabulary:** The builtin generate-SRS skill has deep support for `useCase` and `feature` (it enumerates them automatically). Other values (`requirement`, `epic`, `story`, etc.) are valid and will appear in the DAG, but **breakout file generation for these types is a manual second wave** — after generating the primary document, ask the agent:
> `"generate breakout <vocabulary> files from the graph"`
> The agent will read `.ai-spector/packs/<name>/generate-hints.md` for instructions.

If the file is a **single/non-repeating file**:
- `output` = output-root + slugified-filename + `.md`
  - Example: `introduction.md` in `docs/srs/` → `docs/srs/introduction.md`

After drafting all documents, also set:
- `purpose`, `standards[]`, `docType` (from Q1, Q6–Q7)
- `perDomainTemplates`: object mapping each perDomain value → documentId of its repeating file
- `defaultListedIn`: object mapping each perDomain value → documentId of the most likely "list" document (the non-repeating file whose name or headings suggest it lists the repeating items — use best judgment from filename similarity)

### Show as markdown table

Display the draft as a table with columns:

| File | Document ID | Output / OutputPattern | Type |
|------|-------------|------------------------|------|

Where "Type" is either `single` or the perDomain value (e.g. `useCase`, `feature`).

Also show:
- Pack name
- Output root
- nodePrefix

Then ask:

> "Does this look right? Any changes needed?"

---

## Phase 3 — Refinement loop

If the user requests changes:
1. Update the specific entries they mention
2. Re-show the updated table
3. Ask: "Anything else to adjust?"

Repeat until the user confirms the manifest or says "install it" / "looks good" / "go ahead".

There is no limit on iterations. Be patient and thorough.

**Do not proceed to Phase 4 until the user explicitly confirms.**

---

## Phase 4 — Refine template files

Tell the user:

> "Now I'll read and refine each template file. I'll normalize placeholder syntax to `{slug}` convention and clean up any non-template content. This may take a moment."

For **each file** listed in the scan result:

1. Read the raw file from `<scan-result.sourceDir>/<relativePath>`
2. Apply refinements:
   - Standardize placeholder syntax: any `<<name>>`, `[name]`, `{{name}}`, `%name%`, `$name$` → `{name}`
   - Remove example data rows that look like filled-in sample content (keep table headers and placeholder rows)
   - Keep all headings, structure, and instruction comments intact
   - Do NOT change the meaning or structure — only normalize syntax
3. Write the refined file to `.ai-spector/packs/.staging/templates/<relativePath>`
   - Create subdirectory if needed

After all files are written, confirm:

> "Refined N template files. You can review them at `.ai-spector/packs/.staging/templates/` if you want."

---

## Phase 5 — Write the generate skill

Load the skill outline reference:

```
references/skill-outline.md
```

Read it fully, then write `.ai-spector/packs/.staging/generate-skill.md` following the outline.

**What you know by this point:**
- Template structure and placeholders (scan result)
- Pack name, vocabulary, output location (Phase 1 answers)
- Manifest with document IDs, outputPattern, perDomain values (Phase 2–3)
- Refined template files (Phase 4)

**Key things to fill in accurately:**
- `description` field — use the user's actual vocabulary from Phase 1 Q1 and Q3
- Wave 0 table — derive graph seed IDs by taking each primary documentId from the manifest
  (e.g. `doc.msrs.srs.template` → DAG node `msrs.srs-template`, seed `doc.msrs.srs.template`)
- Wave 1 table — one row per perDomain document, naming the perDomainKey and outputPattern
- Domain vocabulary — from Phase 1 Q3
- Output paths — exactly as specified in the manifest
- Guardrails — include at least: correct seed IDs, output path convention, breakout wave reminder

After writing, show the user a short summary:

> "I've written a tailored generate skill for this pack. It includes:
> - [list Wave 0 documents]
> - [list Wave 1 breakout types, if any]
> - [N guardrails]
>
> Ready to install?"

Wait for confirmation before proceeding to Phase 6.

---

## Phase 6 — Write manifest and install

Write the final manifest (incorporating any Phase 3 refinements) to:

```
.ai-spector/packs/.staging/manifest.json
```

Then run:

```bash
npx ai-spector template install
```

### If install succeeds

Read and summarize `.ai-spector/packs/<name>/readiness-criteria.json` and `context-map.json` (TODO count).

Walk the user through [readiness-setup.md](./readiness-setup.md) **post-install review** (standards, blocking criteria, placeholder TODOs).

Show the CLI output and summarize:

> "✓ Pack '<name>' installed and active.
>
> Readiness criteria and workflow were generated:
> - `.ai-spector/packs/<name>/readiness-criteria.json`
> - `.ai-spector/packs/<name>/workflow-setup.md`
>
> A tailored generate skill was written to:
> - `.claude/skills/ai-spector-generate-<name>/skill.md`
> - `.claude/skills/ai-spector-generate-<name>/skill.md`
>
> **Generation workflow:**
>
> Say 'generate <name>' or 'generate <primary doc type>' — the agent will load the skill,
> read generate-hints.md, and follow the wave structure.
>
> Other commands:
> - 'template list' — see all installed packs
> - 'template use builtin' — switch back to builtin template"

If the install output shows a `⚠  This pack includes ... per-domain breakout template(s)` warning, **explicitly tell the user** which vocabulary they need to generate as a second wave.

## Phase 7 — Validate setup & ask user to fill gaps (mandatory)

**Loop until `template validate` reports `ready: true`. Do not start first generate before that.**

### 7a — Run validation

```bash
npx ai-spector template verify <pack> --json
# MCP: template_validate({ pack: "<pack>" })
```

Read `questionsForUser` and `gaps[]` — present **every blocking question** to the user.

### 7b — Resolve gaps (agent + user)

| Gap category | Who | Action |
|--------------|-----|--------|
| `manifest.purpose` / `standards` | User answers → agent updates `manifest.json` |
| `context-map.*` TODO | User says value → agent updates `context-map.json` |
| `readiness.reviewed` | User confirms criteria → `template setup-mark <pack> readiness.reviewed` |
| `graph.domain.*` | User provides entities or run analyze → `index` |
| `languages.strategy` | User configures `docflow.config.json` languages[] |
| `skill.gated-flow` | Agent fixes generate skill |

After user answers, store clarifications in context store (`context_record`) when they inform generation.

### 7c — Re-validate

```bash
npx ai-spector template verify <pack> --json --sync
```

`--sync` refreshes auto-detected items in `pack-setup.json`.

When user confirms readiness review:

```bash
npx ai-spector template setup-mark <pack> readiness.reviewed
# MCP: template_setup_mark({ pack, itemId: "readiness.reviewed" })
```

### 7d — Gate

- `validation.ready === true`
- `workspace_check` — no PACK-001 warning
- Then allow first `generate <pack>`

---

### If install fails

1. Show the full error output
2. Diagnose the likely cause (missing template file, schema validation error, manifest field issue)
3. Fix the issue (update the manifest or re-write a staged template)
4. Run `template install` once more
5. If it fails again → show the error and ask the user to check the staging folder manually

---

## Guardrails

- **Never** run `template install` before the user has confirmed the manifest in Phase 3
- **Never** modify files outside `.ai-spector/packs/.staging/` and the final pack folder
- If at any point the user says "cancel" or "abort" → stop and tell them:
  > "Stopped. The staging folder is preserved at `.ai-spector/packs/.staging/` if you want to resume later. Just ask me to 'set up template pack' again."
- On any CLI failure → show full output, do not invent results

---

## ScanResult shape (for reference)

```jsonc
{
  "scannedAt": "2026-06-06T10:00:00Z",
  "sourceDir": "/absolute/path/to/user-templates",
  "files": [
    {
      "relativePath": "srs/introduction.md",
      "headings": [
        { "depth": 1, "text": "Introduction", "order": 1 },
        { "depth": 2, "text": "Purpose", "order": 2 }
      ],
      "placeholders": ["{projectName}", "{version}"]
    },
    {
      "relativePath": "srs/use-case-detail.md",
      "headings": [
        { "depth": 1, "text": "Use Case: {name}", "order": 1 },
        { "depth": 2, "text": "Actors", "order": 2 }
      ],
      "placeholders": ["{name}", "{actor}", "{nn}", "{slug}"]
    }
  ]
}
```

**Signals that a file is per-domain (repeating):**
- Placeholders include `{nn}` or `{slug}`
- Top-level heading contains a placeholder like `{name}`
- Filename contains "detail", "item", "per-", or a singular noun matching the vocabulary

---

## Manifest shape (for reference)

```jsonc
{
  "packName": "kaopiz-srs",
  "version": 1,
  "description": "Kaopiz SRS template following IEEE 830",
  "nodePrefix": "doc.kaopiz.srs",
  "templatesDir": "templates",
  "perDomainTemplates": {
    "useCase": "doc.kaopiz.srs.use.case.detail"
  },
  "defaultListedIn": {
    "useCase": "doc.kaopiz.srs.use.cases"
  },
  "documents": [
    {
      "documentId": "doc.kaopiz.srs.introduction",
      "template": "srs/introduction.md",
      "output": "docs/srs/introduction.md"
    },
    {
      "documentId": "doc.kaopiz.srs.use.cases",
      "template": "srs/use-cases.md",
      "output": "docs/srs/use-cases.md"
    },
    {
      "documentId": "doc.kaopiz.srs.use.case.detail",
      "template": "srs/use-case-detail.md",
      "outputPattern": "docs/srs/use-cases/uc-{nn}-{slug}.md",
      "perDomain": "useCase"
    }
  ]
}
```
