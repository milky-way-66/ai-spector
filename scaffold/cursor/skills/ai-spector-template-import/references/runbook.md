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

**Wait for the human to answer all 5 before proceeding.**

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
- `perDomain` = camelCase of the vocabulary from Q3 (e.g. `"use case"` → `"useCase"`, `"feature"` → `"feature"`, `"epic"` → `"epic"`)

If the file is a **single/non-repeating file**:
- `output` = output-root + slugified-filename + `.md`
  - Example: `introduction.md` in `docs/srs/` → `docs/srs/introduction.md`

After drafting all documents, also set:
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

## Phase 5 — Write manifest and install

Write the final manifest (incorporating any Phase 3 refinements) to:

```
.ai-spector/packs/.staging/manifest.json
```

Then run:

```bash
npx ai-spector template install
```

### If install succeeds

Show the CLI output and summarize:

> "✓ Pack '<name>' installed and active.
>
> You can now ask me to:
> - 'generate <document-type>' — uses your new template
> - 'template list' — see all installed packs
> - 'template use builtin' — switch back to builtin template"

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
