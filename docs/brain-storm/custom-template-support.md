# Custom Template Support — Detailed Design

## Problem

The tool is hard-wired to two built-in manifest files (`documents.json` + `documents-basic-design.json`)
and two fixed template subfolders (`srs/`, `basic_design/`).
Users cannot swap, extend, or replace templates without hacking installed files.

---

## Principles

1. **Both AI IDE and CLI cooperate.** The import flow is split: the CLI does structured scanning
   and file I/O; the AI (Cursor / Claude) does the semantic work — inferring intent, writing the
   manifest, resolving ambiguity.
2. **Graph and index are template-agnostic.** They consume a `DocumentsManifest[]`. The only change
   is _how_ that list is loaded.
3. **Built-in packs stay.** They become named packs (`builtin-srs`, `builtin-basic-design`).
   Nothing breaks for existing users.

---

## Vocabulary

| Term | Definition |
|---|---|
| **Template Pack** | A self-contained folder: markdown templates + one `manifest.json` |
| **Pack Name** | Unique identifier string, e.g. `"arc42"`, `"kaopiz-srs"` |
| **Active Packs** | The list of packs currently loaded by the tool (replaces hard-coded two manifests) |
| **Pack Registry** | `.ai-spector/packs/` — local store for all installed custom packs |

---

## Directory Layout (after feature)

```
.ai-spector/
  docflow.config.json          ← adds "packs" field (see Config Changes)
  packs/                       ← new: local pack store
    kaopiz-srs/
      manifest.json
      templates/
        introduction.md
        use-cases.md
        ...
    arc42/
      manifest.json
      templates/
        ...
  templates/                   ← kept for backward compat (builtin copy on init)
  graph/
  registry/
```

---

## Config Changes (`docflow.config.json`)

```jsonc
{
  "version": 1,
  "languages": [{ "code": "en", "label": "English" }],
  "paths": {
    "graph": ".ai-spector/graph/traceability.graph.json",
    "registry": ".ai-spector/registry/section-registry.json",
    "templates": ".ai-spector/templates"
  },
  // NEW
  "packs": {
    "active": ["kaopiz-srs"],          // which packs are loaded (order = merge order)
    "installed": ["kaopiz-srs", "arc42"] // all packs on disk
  }
}
```

- If `packs` is absent → fall back to legacy behavior (load both built-in manifests).
- `active` is an array so future "merge multiple packs" is possible from day 1.

---

## Manifest Schema (`manifest.json` inside each pack)

Strict superset of today's `DocumentsManifest`.

```jsonc
{
  "packName": "kaopiz-srs",         // NEW — required, must match folder name
  "version": 1,
  "description": "Kaopiz SRS template following IEEE 830",  // NEW — optional
  "templatesDir": "templates",      // relative to manifest.json location
  "documents": [
    {
      "documentId": "doc.srs.intro",
      "template": "introduction.md",
      "output": "docs/srs/introduction.md"
    },
    {
      "documentId": "doc.srs.uc-detail",
      "template": "use-case-detail.md",
      "outputPattern": "docs/srs/use-cases/uc-{nn}-{slug}.md",
      "perDomain": "useCase"
    }
  ]
}
```

Existing `documents.json` / `documents-basic-design.json` remain valid — they lack `packName` which
is fine (they are loaded directly, not from the pack store).

---

## Import Flow — Three-Factor Collaboration

The setup process is a guided conversation between three actors.
No single actor owns the whole flow — each does what it is best at.

```
Human                  CLI (ai-spector)                AI (Cursor / Claude)
 │                          │                                   │
 │                          │                                   │
 ╔══════════════════════════════════════════════════════════════════╗
 ║  STEP 1 — Human brings the template                              ║
 ╚══════════════════════════════════════════════════════════════════╝
 │                          │                                   │
 │  Has a folder of .md     │                                   │
 │  templates (own format,  │                                   │
 │  client template, etc.)  │                                   │
 │                          │                                   │
 │  Runs:                   │                                   │
 │  ai-spector template scan ./my-folder                        │
 │─────────────────────────>│                                   │
 │                          │  Walk folder                      │
 │                          │  Extract headings (remark)        │
 │                          │  Write scan-result.json           │
 │                          │  → .ai-spector/packs/.staging/    │
 │                          │                                   │
 │  CLI prints:             │                                   │
 │  "Found 8 templates.     │                                   │
 │   Now ask your AI:       │                                   │
 │   'set up template pack' "                                   │
 │<─────────────────────────│                                   │
 │                          │                                   │
 ╔══════════════════════════════════════════════════════════════════╗
 ║  STEP 2 — AI asks human for intent & context                     ║
 ╚══════════════════════════════════════════════════════════════════╝
 │                          │                                   │
 │  In IDE: "set up my      │                                   │
 │  template pack"          │                                   │
 │─────────────────────────────────────────────────────────────>│
 │                          │                                   │  Read scan-result.json
 │                          │                                   │
 │                          │                                   │  AI asks human:
 │  ┌─────────────────────────────────────────────────────────┐ │
 │  │ AI: "I see 8 template files. A few questions:           │<│
 │  │  1. What is this template for? (SRS / design / ADR / …) │ │
 │  │  2. Any files that are per-feature or per-use-case?     │ │
 │  │  3. What should the pack be called?                     │ │
 │  │  4. Where should generated docs go? (e.g. docs/srs/)   │ │
 │  └─────────────────────────────────────────────────────────┘ │
 │                          │                                   │
 │  Human answers in chat   │                                   │
 │─────────────────────────────────────────────────────────────>│
 │                          │                                   │
 ╔══════════════════════════════════════════════════════════════════╗
 ║  STEP 3 — AI drafts manifest, shows human for review             ║
 ╚══════════════════════════════════════════════════════════════════╝
 │                          │                                   │
 │                          │                                   │  Combine scan-result
 │                          │                                   │  + human answers
 │                          │                                   │  → draft manifest.json
 │                          │                                   │
 │  AI shows draft as table:│                                   │
 │  ┌───────────────────────────────────────────────────────┐  │
 │  │ # Draft manifest — please review                      │<─│
 │  │                                                       │  │
 │  │ Pack name: kaopiz-srs                                 │  │
 │  │                                                       │  │
 │  │ ID                      │ File            │ Type      │  │
 │  │ doc.srs.introduction    │ intro.md        │ single    │  │
 │  │ doc.srs.use-cases       │ uc-list.md      │ single    │  │
 │  │ doc.srs.uc-detail       │ uc-detail.md    │ useCase ← │  │
 │  │ doc.srs.feature-detail  │ feat-detail.md  │ feature ← │  │
 │  │                                                       │  │
 │  │ Output root: docs/srs/                                │  │
 │  │                                                       │  │
 │  │ Does this look right? Any changes needed?             │  │
 │  └───────────────────────────────────────────────────────┘  │
 │                          │                                   │
 ╔══════════════════════════════════════════════════════════════════╗
 ║  STEP 4 — Human reviews, corrects, confirms                      ║
 ╚══════════════════════════════════════════════════════════════════╝
 │                          │                                   │
 │  Human may say:          │                                   │
 │  "feat-detail.md is not  │                                   │
 │   per-feature, it's a    │                                   │
 │   single summary doc"    │                                   │
 │─────────────────────────────────────────────────────────────>│
 │                          │                                   │  AI corrects entry:
 │                          │                                   │  perDomain → null
 │                          │                                   │  output → single path
 │                          │                                   │  Re-shows updated table
 │                          │                                   │
 │  Human: "looks good,     │                                   │
 │  install it"             │                                   │
 │─────────────────────────────────────────────────────────────>│
 │                          │                                   │
 ╔══════════════════════════════════════════════════════════════════╗
 ║  STEP 5 — AI instructs CLI to install, CLI verifies              ║
 ╚══════════════════════════════════════════════════════════════════╝
 │                          │                                   │
 │                          │                                   │  Write manifest.json
 │                          │                                   │  → .ai-spector/packs/.staging/
 │                          │                                   │
 │                          │  ai-spector template install      │
 │                          │<──────────────────────────────────│
 │                          │                                   │
 │                          │  Validate schema ✓                │
 │                          │  All template files exist ✓       │
 │                          │  Copy staging → packs/kaopiz-srs/ │
 │                          │  Patch docflow.config.json        │
 │                          │  Run: ai-spector index            │
 │                          │  Registry built: 4 documents,     │
 │                          │  23 sections ✓                    │
 │                          │                                   │
 │  CLI prints result       │                                   │
 │<─────────────────────────│                                   │
 │                          │                                   │
 │                          │                                   │  AI summarizes:
 │  ┌─────────────────────────────────────────────────────────┐ │
 │  │ ✓ Pack 'kaopiz-srs' installed and active.               │<│
 │  │   4 documents · 23 sections · output → docs/srs/        │ │
 │  │                                                         │ │
 │  │   You can now ask me to:                                │ │
 │  │   - "generate SRS introduction"                         │ │
 │  │   - "generate all SRS docs"                             │ │
 │  │   - "switch to builtin template" (template use)         │ │
 │  └─────────────────────────────────────────────────────────┘ │
```

---

### Role of Each Actor

| Actor | What it owns | Why |
|---|---|---|
| **Human** | Intent, domain knowledge, corrections | Only the human knows what the template _means_ and whether the AI's guesses are right |
| **AI (IDE)** | Questions, inference, manifest draft, iteration | Semantic work — reading content, making judgment calls, holding the conversation |
| **CLI** | File I/O, parsing, validation, config, indexing | Deterministic structural work — no LLM needed, fast, auditable |

The AI never touches the file system directly.
The CLI never makes semantic decisions.
The human is in the loop at every ambiguous step — not just at the end.

---

### Human Decision Points

These are the moments where the human must actively participate:

| # | Decision | Why human must decide |
|---|---|---|
| 1 | What is this template _for_? | AI can guess from filenames/headings but can easily be wrong |
| 2 | Which files are per-item (per feature, per use case)? | Critical for `perDomain` — a wrong guess breaks `generate` for all instances |
| 3 | Pack name | Naming is a product/org decision, not a structural one |
| 4 | Output folder structure | Depends on the team's existing folder conventions |
| 5 | Review the draft table | Final sanity check before anything is written |
| 6 | Any corrections in the review loop | Can go back and forth until satisfied |

---

## New CLI Commands

### `ai-spector template scan <path>`

**What it does:**
1. Walks `<path>` recursively, collects all `.md` files.
2. For each file: parses with remark, extracts heading tree (depth, text, order).
3. Writes `.ai-spector/packs/.staging/scan-result.json`.
4. Prints next-step instruction telling the user to ask the AI to run the import workflow.

**Output `scan-result.json` shape:**
```jsonc
{
  "scannedAt": "2026-06-06T10:00:00Z",
  "sourceDir": "/Users/khang/work/my-template",
  "files": [
    {
      "relativePath": "srs/introduction.md",
      "headings": [
        { "depth": 1, "text": "Introduction", "order": 1 },
        { "depth": 2, "text": "Purpose", "order": 2 },
        { "depth": 2, "text": "Scope", "order": 3 }
      ]
    },
    {
      "relativePath": "srs/use-case-detail.md",
      "headings": [
        { "depth": 1, "text": "Use Case: {name}", "order": 1 },
        { "depth": 2, "text": "Actors", "order": 2 }
      ]
    }
  ]
}
```

---

### `ai-spector template install [--name <pack-name>] [--activate]`

**What it does:**
1. Reads `.ai-spector/packs/.staging/manifest.json` (AI-generated).
2. Validates against manifest schema (JSON Schema check).
3. Checks all `template` paths exist inside the staging folder.
4. Copies staging → `.ai-spector/packs/<packName>/`.
5. Patches `docflow.config.json`:
   - Appends `packName` to `packs.installed`.
   - If `--activate` (default true): sets `packs.active = [packName]`.
6. Runs `buildSectionRegistry()` to verify it parses cleanly.
7. Prints summary.

**Flags:**
- `--name <str>` — override pack name from manifest (useful if manifest has no `packName` yet)
- `--activate` / `--no-activate` — whether to set as active immediately (default: `--activate`)
- `--dry-run` — validate + print, don't write anything

---

### `ai-spector template list`

Prints installed packs and which are active:

```
Installed template packs:
  ● kaopiz-srs        (active)   Kaopiz SRS template following IEEE 830
  ○ arc42             (inactive) Arc42 architecture doc template
  ○ builtin-srs       (builtin)  Default SRS pack
  ○ builtin-basic-design (builtin) Default basic design pack
```

---

### `ai-spector template use <pack-name>`

Sets `packs.active = [packName]` in config.
Triggers re-index automatically (or prompts user to run it).

---

### `ai-spector template inspect <pack-name>`

Prints the `manifest.json` in a readable table: documentId | template file | output | perDomain.

---

### `ai-spector template remove <pack-name>`

Removes the pack folder from `.ai-spector/packs/` and removes from `installed` / `active` in config.
Refuses if the pack is currently active (must `template use` another pack first).

---

## AI Workflow (Cursor / Claude Skill)

The AI skill is triggered by the user after `template scan` completes.

**Skill prompt (condensed):**

```
You are setting up a new template pack for ai-spector.

Read: .ai-spector/packs/.staging/scan-result.json

Your job:
1. For each file in `files[]`, decide:
   a. documentId  — a dot-separated slug, e.g. "doc.srs.introduction"
   b. output      — where the generated doc goes, e.g. "docs/srs/introduction.md"
                    OR outputPattern if this is a per-item template (use-case, feature, etc.)
   c. perDomain   — "useCase" | "feature" | null
      Clues: if headings contain placeholders like {name}, {slug}, {nn} → it is per-domain.
             heading text like "Use Case", "Feature Detail" → useCase or feature.

2. Infer a packName from the source folder name (snake_case, lowercase).

3. Write .ai-spector/packs/.staging/manifest.json following this schema:
   [paste schema here]

4. Show the user the generated manifest as a markdown table for review.

5. When user confirms, run:
   ai-spector template install
```

---

## Code Changes

### `src/config/types.ts`

Add to `DocflowConfig`:
```ts
packs?: {
  active: string[];      // pack names to load, in order
  installed: string[];   // all packs on disk
};
```

Add new type:
```ts
export interface PackManifest extends DocumentsManifest {
  packName: string;
  description?: string;
}
```

---

### `src/config/load.ts`

New function `resolveActiveManifests(root, config)`:

```ts
export async function resolveActiveManifests(
  root: string,
  config: DocflowConfig,
): Promise<Array<{ manifest: DocumentsManifest; templatesDir: string }>> {
  // Legacy path: no packs config → return builtin manifests (existing behavior)
  if (!config.packs || config.packs.active.length === 0) {
    return [
      await loadBundledSrsManifest(),
      await loadBundledBasicDesignManifest(),
    ];
  }

  const results = [];
  for (const packName of config.packs.active) {
    const packDir = join(root, ".ai-spector/packs", packName);
    const manifest = await readJson<PackManifest>(join(packDir, "manifest.json"));
    const templatesDir = join(packDir, manifest.templatesDir ?? "templates");
    results.push({ manifest, templatesDir });
  }
  return results;
}
```

---

### `src/registry/build.ts`

Replace the two hard-coded `loadDocumentsManifest` + `loadBasicDesignListManifest` calls with:

```ts
export async function buildSectionRegistry(root?: string): Promise<SectionRegistry> {
  const { root: projectRoot, config } = await loadDocflowConfig(root);
  const packs = await resolveActiveManifests(projectRoot, config);

  const documents: RegistryDocument[] = [];
  for (const { manifest, templatesDir } of packs) {
    for (const doc of manifest.documents) {
      documents.push(await scanTemplate(templatesDir, doc));
    }
  }
  return { version: 1, root: projectRoot, documents };
}
```

The graph bootstrap (`bootstrapFromRegistry`) and all query/index paths are untouched — they already consume `SectionRegistry`.

---

### New Files

| File | Purpose |
|---|---|
| `src/commands/template.ts` | Command group: `scan`, `install`, `list`, `use`, `inspect`, `remove` |
| `src/template/scan.ts` | Walk folder + remark extract → write `scan-result.json` |
| `src/template/install.ts` | Validate, copy, patch config, verify registry builds |
| `src/template/validate.ts` | JSON Schema validation of `manifest.json` |
| `schemas/manifest.pack.schema.json` | JSON Schema for `PackManifest` |
| `scaffold/claude/...` or `scaffold/cursor/...` | AI skill file for the import workflow |

---

## Backward Compatibility

| Scenario | Behavior |
|---|---|
| Existing project, no `packs` in config | `resolveActiveManifests` sees no `packs` field → loads both builtin manifests → **identical to today** |
| `ai-spector init` on a new project | Copies builtin templates to `.ai-spector/templates/` as today; `packs` not written until user imports a custom pack |
| Custom pack installed, user runs `template use builtin-srs` | `packs.active = ["builtin-srs"]`; built-in packs are special-cased in `resolveActiveManifests` |

---

## Setup Output — What Gets Written

After the three-factor setup completes, these are the concrete artifacts on disk:

```
.ai-spector/
  docflow.config.json          ← UPDATED: packs.active + packs.installed added
  packs/
    kaopiz-srs/                ← NEW pack folder
      manifest.json            ← the final manifest the AI + human produced
      templates/               ← copy of the user's original template files
        introduction.md
        use-cases.md
        use-case-detail.md
        feature-detail.md
        ...
  registry/
    section-registry.json      ← REBUILT: now reflects new pack's documents + sections
  graph/
    traceability.graph.json    ← REBUILT: graph nodes/edges now match new template structure
  .docflow/
    state.json                 ← UPDATED: graphPreparedAt timestamp
    packs/
      .staging/                ← CLEARED after successful install
```

### `manifest.json` (example)

```jsonc
{
  "packName": "kaopiz-srs",
  "version": 1,
  "description": "Kaopiz SRS template following IEEE 830",
  "templatesDir": "templates",
  "documents": [
    {
      "documentId": "doc.srs.introduction",
      "template": "introduction.md",
      "output": "docs/srs/introduction.md"
    },
    {
      "documentId": "doc.srs.use-cases",
      "template": "use-cases.md",
      "output": "docs/srs/use-cases.md"
    },
    {
      "documentId": "doc.srs.uc-detail",
      "template": "use-case-detail.md",
      "outputPattern": "docs/srs/use-cases/uc-{nn}-{slug}.md",
      "perDomain": "useCase"
    },
    {
      "documentId": "doc.srs.feature-detail",
      "template": "feature-detail.md",
      "outputPattern": "docs/srs/features/f-{nn}-{slug}.md",
      "perDomain": "feature"
    }
  ]
}
```

### `section-registry.json` (structure)

The registry is rebuilt immediately after install.
It now reflects the new pack's document list and heading structure extracted from each template file.

```jsonc
{
  "version": 1,
  "root": "/Users/khang/work/my-project",
  "documents": [
    {
      "documentId": "doc.srs.introduction",
      "template": "introduction.md",
      "output": "docs/srs/introduction.md",
      "sections": [
        { "id": "doc.srs.introduction#s2-purpose", "heading": "Purpose", "level": 2, "order": 1 },
        { "id": "doc.srs.introduction#s2-scope",   "heading": "Scope",   "level": 2, "order": 2 }
      ]
    },
    ...
  ]
}
```

### `traceability.graph.json` (structure)

The graph is also rebuilt. The new pack's documents and sections become **graph nodes**.
Per-domain template documents get a `perDomain` property so the graph engine knows they repeat.

```jsonc
{
  "nodes": [
    { "id": "doc.srs.introduction",  "type": "document", "template": "introduction.md",      "output": "docs/srs/introduction.md" },
    { "id": "doc.srs.uc-detail",     "type": "document", "template": "use-case-detail.md",   "outputPattern": "docs/srs/use-cases/uc-{nn}-{slug}.md", "perDomain": "useCase" },
    { "id": "doc.srs.introduction#s2-purpose", "type": "section", "documentId": "doc.srs.introduction", "heading": "Purpose", "level": 2 },
    ...
  ],
  "edges": [
    { "type": "contains", "from": "doc.srs.introduction", "to": "doc.srs.introduction#s2-purpose" },
    { "type": "partOf",   "from": "doc.srs.introduction#s2-purpose", "to": "doc.srs.introduction" },
    ...
  ]
}
```

---

## Integration — How the New Template Works with the System

Once the pack is installed and the registry/graph are rebuilt, every downstream system reads them
transparently. No command or skill needs to know which pack is active.

```
manifest.json
      │
      ▼
buildSectionRegistry()          ← only function that knows about packs
      │
      ├── section-registry.json (written to disk)
      │
      ▼
bootstrapFromRegistry()         ← pack-agnostic, consumes SectionRegistry
      │
      ├── traceability.graph.json (written to disk)
      │
      ▼
Everything below reads the graph/registry files directly:

  ai-spector index        → reads registry, merges doc semantics, updates graph
  ai-spector analyze      → reads graph, merges knowledge, validates
  ai-spector graph query  → queries traceability.graph.json
  ai-spector graph impact → reads edges from traceability.graph.json
  ai-spector validate     → validates graph against schema + rules

  AI skills (Cursor/Claude):
    "generate SRS"        → reads graph nodes with type=document, uses node.output/template path
    "generate use cases"  → reads nodes with perDomain=useCase, uses node.outputPattern
    "analyze data source" → reads graph structure to know what sections to fill
    "impact of change"    → traverses edges in graph (unchanged)
    "traceability report" → reads provenance/rendersTo edges (unchanged)
```

### The One Coupling Point That Must Change: `PER_DOMAIN_TEMPLATE_DOC`

Currently `src/graph/doc-extract.ts` has a hardcoded map:

```ts
// CURRENT — hardcoded to builtin IDs
export const PER_DOMAIN_TEMPLATE_DOC = {
  useCase: "doc.srs.uc-detail",
  feature: "doc.srs.feature-detail",
};
```

When a custom pack uses different `documentId` values (e.g. `"doc.kaopiz.uc-template"`),
this map will look up the wrong node — causing the graph to link generated docs to a non-existent template node.

**Fix:** derive `PER_DOMAIN_TEMPLATE_DOC` dynamically from the loaded registry instead of hardcoding:

```ts
// NEW — derived from whatever pack is active
export function buildPerDomainTemplateMap(
  registry: SectionRegistry,
): Record<string, string> {
  const map: Record<string, string> = {};
  for (const doc of registry.documents) {
    if (doc.perDomain) {
      map[doc.perDomain] = doc.documentId;
    }
  }
  return map;
}
```

This is the **only breaking coupling** between the template identity and the rest of the system.
Everything else flows through the graph structure, which is already generic.

### Per-Domain Document Generation

When the AI generates a use-case detail doc for a custom pack, the flow is:

```
1. AI asks: "generate use case UC-01 Login"

2. Cursor skill / Claude skill:
   - Queries graph: find node where perDomain = "useCase"
   - Gets node: { id: "doc.kaopiz.uc-template", outputPattern: "docs/srs/use-cases/uc-{nn}-{slug}.md", template: "use-case-detail.md" }
   - Resolves template path: .ai-spector/packs/kaopiz-srs/templates/use-case-detail.md
   - Resolves output path: docs/srs/use-cases/uc-01-login.md  (from outputPattern)
   - Reads template file → fills content → writes to output path

3. CLI (ai-spector index):
   - Scans docs/srs/use-cases/*.md
   - Finds uc-01-login.md
   - Extracts headings
   - Creates graph node: { id: "doc.srs.uc-01-login", type: "document", ... }
   - Adds edge: rendersTo from "doc.kaopiz.uc-template" → "docs/srs/use-cases/uc-01-login.md"
   - Adds edge: partOf from "doc.srs.uc-01-login" → "doc.kaopiz.uc-template"
```

The outputPattern resolution (`uc-{nn}-{slug}`) is already implemented — it just needs to
read from the graph node instead of the hardcoded manifest.

### What the AI Skills Need to Know (and NOT know)

| Thing | Skill needs to know? | How it gets it |
|---|---|---|
| Which pack is active | **No** | Graph already has the right nodes |
| Template file path | **Yes** | `node.template` → resolve against pack dir in config |
| Output path for single doc | **Yes** | `node.output` from graph node |
| Output path for per-domain doc | **Yes** | `node.outputPattern` + item slug |
| Pack folder location | **Yes** | `.ai-spector/packs/<packName>/` from config `packs.active[0]` |
| Document IDs | **No** | Queried from graph by type + perDomain |

The skill only needs to know: **read graph → find the right node → use node.template + node.output**.
Pack name is an implementation detail the skill resolves once from config.

---

## Design Decisions & Problem Resolutions

The following captures decisions made during review. Each problem is closed with the chosen approach.

---

### P1 — Template files need refinement, not just copying ✅ DECIDED

**Decision:** The user's original template files are treated as _raw input_, not the final output.
During the setup workflow, the AI refines the template content itself — fixing placeholder syntax,
normalizing heading structure, removing non-template prose — before anything is written to the pack folder.

**Revised flow:**

```
User's raw templates (any format)
        ↓
template scan  →  scan-result.json  (headings + placeholders extracted, files NOT copied)
        ↓
AI refinement step (new):
  - Reads each raw template file directly from sourceDir
  - Normalizes placeholder syntax to {slug} convention
  - Cleans non-template content (example data, comments)
  - Writes REFINED template files to .ai-spector/packs/.staging/templates/
  - Also writes manifest.json to .ai-spector/packs/.staging/
        ↓
Human reviews both: refined templates + manifest table
        ↓
Human approves → template install  (copies from staging → packs/<name>/)
```

**What this means for the AI skill:**
The AI now has two jobs during setup: (1) produce the manifest, (2) produce refined template files.
Both outputs land in staging. The human reviews both before install commits anything.

**The staging folder now contains:**
```
.ai-spector/packs/.staging/
  scan-result.json          ← CLI output
  manifest.json             ← AI output
  templates/
    introduction.md         ← AI-refined template (not the raw user file)
    use-case-detail.md
    ...
```

---

### P2 — No hardcoded mappings, use pack config instead ✅ DECIDED

**Decision:** `PER_DOMAIN_TEMPLATE_DOC`, `DEFAULT_LISTED_IN`, and generated node ID prefixes
must not be hardcoded in source. They must come from the active pack's manifest.

**Manifest additions (new fields):**

```jsonc
{
  "packName": "kaopiz-srs",
  "nodePrefix": "doc.kaopiz",          // NEW — prefix for generated per-domain node IDs
  "perDomainTemplates": {              // NEW — replaces PER_DOMAIN_TEMPLATE_DOC
    "useCase": "doc.kaopiz.uc-detail",
    "feature": "doc.kaopiz.feature-detail"
  },
  "defaultListedIn": {                 // NEW — replaces DEFAULT_LISTED_IN in defaults.ts
    "useCase":  "doc.kaopiz.use-cases",   // documentId of the list doc, not a section ID
    "feature":  "doc.kaopiz.features",
    "actor":    "doc.kaopiz.stakeholders"
  },
  "documents": [ ... ]
}
```

**How code reads these:**

```ts
// resolveActiveManifests returns PackManifest
// doc-extract.ts reads from it instead of hardcoded constants:

const packConfig = await resolveActivePackManifest(root, config);

// replaces PER_DOMAIN_TEMPLATE_DOC:
const templateDocId = packConfig.perDomainTemplates?.[perDomain] ?? fallbackBuiltin[perDomain];

// replaces DEFAULT_LISTED_IN:
const listDocId = packConfig.defaultListedIn?.[kind] ?? DEFAULT_LISTED_IN_BUILTIN[kind];

// replaces doc.srs.uc-${norm}:
const prefix = packConfig.nodePrefix ?? "doc.srs";
const nodeId = `${prefix}.uc-${norm}`;
```

**Builtin pack manifest** gets these fields added so legacy behavior is just the builtin pack's config:
```jsonc
{
  "packName": "builtin-srs",
  "nodePrefix": "doc.srs",
  "perDomainTemplates": { "useCase": "doc.srs.uc-detail", "feature": "doc.srs.feature-detail" },
  "defaultListedIn": { "useCase": "doc.srs.3-use-cases", "feature": "doc.srs.4-system-features", ... }
}
```

**The `startsWith("doc.srs.uc-")` pattern** in node classification must change too:
Instead of prefix pattern matching, use `perDomain` property on the graph node.
Nodes generated by the per-domain flow always carry `perDomain` — that is the canonical classification signal.

---

### P3 — `template install` config patch order ✅ RESOLVED

Patch config first → verify registry builds → roll back config if verification fails.
No design change needed, just implementation order.

---

### P4 — All hardcoded couplings resolved by P2 ✅ RESOLVED

The `nodePrefix`, `perDomainTemplates`, `defaultListedIn` fields in the manifest cover all cases:
- `PER_DOMAIN_TEMPLATE_DOC` → `perDomainTemplates`
- `DEFAULT_LISTED_IN` section IDs → `defaultListedIn`
- `doc.srs.uc-${norm}` prefix → `nodePrefix`
- `startsWith("doc.srs.uc-")` classification → use `node.perDomain` property instead

---

### P5 — `packs.installed` removed from config ✅ DECIDED

Config only stores `packs.active` (single string — see P10).
Installed packs are discovered at runtime by scanning `.ai-spector/packs/` on disk.

---

### P6 — Stale staging handled ✅ RESOLVED

- `template scan` always clears and recreates `.ai-spector/packs/.staging/`.
- `template install` warns if `scan-result.json` is older than 24h.
- Staging is deleted after successful install.

---

### P7 — `perDomain` as open string ✅ DECIDED

`GraphNode.perDomain` becomes `string` (not a closed enum).
Unknown values are treated as generic per-domain documents: they get `outputPattern` behavior
but no special graph wiring (no `listedIn` anchor, no classification by prefix).
The `perDomainTemplates` and `defaultListedIn` in the manifest only declare keys they actually use.

---

### P8 — `template use` always re-indexes ✅ DECIDED

`template use` triggers a mandatory re-index automatically. No prompt, no skip option.
Output: same summary as `template install` — documents, sections, graph rebuilt.

---

### P9 — Builtin pack is the default, not a named pack ✅ DECIDED

**Decision:** The builtin template is just the default behavior when no `packs.active` is set.
It is not exposed as a named pack (`builtin-srs`) — no copying to `.ai-spector/packs/` on init.

`resolveActiveManifests`:
- `packs.active` absent or empty → load builtin manifests (current behavior, no change)
- `packs.active = "kaopiz-srs"` → load from `.ai-spector/packs/kaopiz-srs/`

`template use builtin` (reserved name) → clears `packs.active` → falls back to builtin.

This keeps init simple and avoids duplicating bundled files into every project.

---

### P10 — One template pack per project, no collision concern ✅ DECIDED

**Decision:** A project uses exactly one active pack at a time.
`packs.active` in config is a **single string**, not an array.
Multi-pack merge is out of scope. No collision detection needed.

```jsonc
// config
"packs": {
  "active": "kaopiz-srs"    // string, not array
}
```

Migration between packs (if a project wants to switch) is a future concern.

---

### P11 — AI skill is generic + updated during setup ✅ DECIDED

**Decision:** The setup skill itself can be updated as part of template installation.

Two layers:
1. **Generic skill** (shipped with ai-spector) — knows how to run the import workflow for any template.
2. **Pack-specific skill hints** (optional, inside the pack) — a `skill-hints.md` file the pack can include.
   After install, this file is appended/merged into the project's cursor/claude skill for generate/analyze.

This means installing a pack can teach the AI _how to use that specific template_ —
e.g. "this template uses `{epic}` as the top-level domain unit, not `{feature}`."

```
.ai-spector/packs/.staging/
  manifest.json
  templates/
    ...
  skill-hints.md    ← OPTIONAL — pack-specific additions to generate skill
```

On `template install`, if `skill-hints.md` exists:
- Append its content to `.cursor/skills/generate.md` (or Claude equivalent)
- Print: "Updated generate skill with pack-specific guidance."

---

### P12 — Placeholder extraction via remark AST ✅ DECIDED

**Decision:** Since all templates are markdown, remark already has a full AST.
Instead of sending first paragraphs, the scan extracts `{placeholder}` tokens from all text nodes
across the entire AST using a regex pass over the serialized text.

This gives the AI a placeholder inventory per file — compact and precise — without sending full content.

**Updated `scan-result.json`:**
```jsonc
{
  "files": [
    {
      "relativePath": "use-case-detail.md",
      "headings": [
        { "depth": 1, "text": "Use Case: {name}", "order": 1 },
        { "depth": 2, "text": "Actors", "order": 2 }
      ],
      "placeholders": ["{name}", "{actor}", "{nn}", "{slug}"]   // NEW — extracted from full AST
    }
  ]
}
```

`{nn}` and `{slug}` appearing in a file is a strong signal it is per-domain.
`{name}` appearing in a heading is an even stronger signal.
The AI uses this inventory to decide `perDomain` and `outputPattern` with high confidence.

---

## Phased Delivery (final)

### Phase 1 — Plumbing + config-driven mappings
- `packs.active` (single string) in `DocflowConfig`
- `PackManifest` type with `nodePrefix`, `perDomainTemplates`, `defaultListedIn`
- `resolveActiveManifests` with builtin fallback
- `buildSectionRegistry` refactored to use `resolveActiveManifests`
- All hardcoded coupling replaced: `PER_DOMAIN_TEMPLATE_DOC`, `DEFAULT_LISTED_IN`, node ID prefix, `startsWith` classification
- `template list` + `template use` (mandatory re-index) + `template inspect` commands
- Manual path: user hand-writes `manifest.json` + places template files → `template install`

### Phase 2 — CLI Scan + AI Refinement + Install
- `template scan <path>` — remark walk + placeholder extraction → `scan-result.json` (files not copied)
- `template install` — validates manifest, copies staging → pack folder, patches config, re-indexes
- Stale staging detection + cleanup
- `template remove`
- `perDomain` as open string

### Phase 3 — AI Skill (three-factor workflow)
- Generic import skill (Cursor + Claude)
- AI refines raw templates → writes to staging + writes manifest
- Human review loop
- `skill-hints.md` support: pack updates generate skill on install

### Phase 4 — Polish
- `template export` — pack existing project templates into a sharable folder
- Bundled named packs (`arc42`, etc.)
