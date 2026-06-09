# Work 17 — Custom Template Packs (Optional)

**Course:** [Index](README.md) · [Overview](00-overview.md) · [Previous](16-visualize-the-graph.md)

**Goal:** Replace or extend the builtin SRS layout with your team's own markdown templates — installed as a **template pack** and switched on when you generate documents.

**Before you start:** Work 02 (Initialize a Project), Work 04 (Enable Agent Skills). Enable the `ai-spector-template-import` skill for the import workflow.

**Early install:** If you need a custom layout from day one, do this work right after Work 04 — before Work 05 — then continue the pipeline with `generate <pack-name>` instead of builtin SRS.

**Deep reference:** [Multi-template pack structure](../multi-template-structure.md) — folder layout, manifest fields, full config reference.

---

## Core config file — `docflow.config.json`

Path: **`.ai-spector/docflow.config.json`**

This is the **project config** ai-spector reads on every command. Template pack selection is controlled here — template file lists and output paths are **not**.

```json
{
  "version": 1,
  "languages": [
    { "code": "en", "label": "English" }
  ],
  "paths": {
    "graph": ".ai-spector/graph/traceability.graph.json",
    "registry": ".ai-spector/registry/section-registry.json",
    "templates": ".ai-spector/templates"
  },
  "packs": {
    "active": "kaopiz-srs"
  }
}
```

| Field | Template / pack role |
|-------|----------------------|
| `packs.active` | **Which pack drives generation.** Omit field or use `"builtin"` → default SRS + basic design. Any other string must match `.ai-spector/packs/<name>/`. |
| `paths.templates` | Always **builtin copy** from `init` (`.ai-spector/templates/`). Stays the same when a custom pack is active. |
| `paths.graph` | Rebuilt when you `template install` or `template use` — registry + graph follow the active pack manifest. |
| `paths.registry` | Same — rebuilt on pack switch. |
| `languages[]` | Independent of packs — see [Work 10](10-multi-language.md). Works with builtin or custom packs. |

**Not in this file:**

| What | Where it lives |
|------|----------------|
| Template filenames | `.ai-spector/packs/<name>/manifest.json` → `documents[].template` |
| Generated doc output paths | Pack `manifest.json` → `output` / `outputPattern` |
| Placeholder → graph mapping | `.ai-spector/packs/<name>/context-map.json` |
| Generation wave order | `.ai-spector/packs/<name>/generate-hints.md` + `.ai-spector/.docflow/config/dag.srs.json` |
| Actual template markdown | `.ai-spector/packs/<name>/templates/` (custom) or `.ai-spector/templates/` (builtin) |

Inspect current active pack:

```bash
cat .ai-spector/docflow.config.json | grep -A2 packs
npx ai-spector template list
```

`template install` and `template use` update `packs.active` for you. `template use builtin` **removes** the `packs` key entirely.

---

## Builtin vs custom pack

| | **Builtin** (default) | **Custom pack** |
|---|----------------------|-----------------|
| When | `packs` missing or `packs.active: "builtin"` | `packs.active: "<pack-name>"` |
| Templates | `.ai-spector/templates/` (SRS + basic design from package) | `.ai-spector/packs/<name>/templates/` |
| Generation skill | `ai-spector-generate-srs`, `ai-spector-generate-basic-design` | `ai-spector-generate-<pack-name>` (written at install) |
| Output paths | `docs/srs/{lang}/…`, `docs/basic-design/{lang}/…` | Paths you define in the pack `manifest.json` |

Only **one pack is active** at a time. You can install several; switch with `template use`.

---

## When you need a custom pack

- Your organization has a fixed SRS or requirements layout (not the default ai-spector SRS)
- You use arc42, a client-mandated template, or a team-specific section structure
- Output should land in a custom folder (e.g. `docs/requirements/` instead of `docs/srs/`)

If the builtin SRS fits your project, skip this work and stay on builtin.

---

## Import workflow (chat + CLI)

### 1. Prepare your template files

Put your markdown templates in a folder on disk (any structure). Each file should use `{placeholders}` where content will come from the graph.

### 2. Scan templates

```bash
npx ai-spector template scan ./path/to/your-templates
```

This writes `.ai-spector/packs/.staging/scan-result.json` (headings + placeholders per file).

### 3. Set up the pack in chat

```
set up template pack
```

```
import my custom template
```

The agent (skill `ai-spector-template-import`) will:

1. Read the scan result
2. Ask purpose, repeating files, vocabulary, pack name, output location
3. Draft `manifest.json` for your review
4. Refine staged templates if needed
5. Run install after you confirm

### 4. Install

After you approve the manifest:

```bash
npx ai-spector template install
```

Install copies the pack to `.ai-spector/packs/<pack-name>/`, sets `packs.active`, rebuilds registry/graph, writes `generate-hints.md`, and adds a dedicated generate skill under `.cursor/skills/`.

---

## Generate with a custom pack active

The router skill reads **`packs.active`** from `.ai-spector/docflow.config.json` before generating.

**Wrong** (builtin skill while custom pack is active):

```
generate SRS
```

**Right:**

```
generate <pack-name>
```

```
generate requirements
```

(use the name that matches your pack — the agent loads `generate-hints.md` and the pack DAG)

After switching packs, re-run analyze/index if the graph or registry looks stale.

---

## Switch or list packs

### In chat

```
list template packs
```

```
use builtin template
```

```
switch to pack kaopiz-srs
```

### CLI

```bash
npx ai-spector template list
npx ai-spector template use kaopiz-srs
npx ai-spector template use builtin
```

`template use builtin` restores default SRS/basic-design DAGs and **deletes `packs` from `docflow.config.json`**. Installed custom packs stay on disk under `.ai-spector/packs/`.

---

## Pack manifest (separate from core config)

Per-pack definition — **not** merged into `docflow.config.json`:

```
.ai-spector/packs/<pack-name>/manifest.json
```

Contains `packName`, `documents[]` (template + output paths), `perDomainTemplates`, `defaultListedIn`, etc. See [multi-template-structure.md](../multi-template-structure.md).

---

## Pack folder (after install)

```
.ai-spector/packs/<pack-name>/
├── manifest.json
├── templates/
├── generate-hints.md      ← wave 0 / wave 1 generation order
├── context-map.json       ← {placeholder} → graph source
├── gen-status.json        ← runtime progress (optional)
└── regen-plan.md          ← stale files after graph changes (optional)
```

---

## Export a pack (share with another project)

```bash
npx ai-spector template export ./my-pack --pack kaopiz-srs
```

Gives a portable `manifest.json` + `templates/` folder for another repo.

---

## Check

```bash
npx ai-spector template list
```

Active pack shows `●`. Inspect validation:

```bash
npx ai-spector template inspect <pack-name>
```

Generate one primary document in chat and confirm output path matches the manifest.

---

## Troubleshooting

**`generate SRS` still uses builtin layout**

Custom pack is active — use `generate <pack-name>` or the pack-specific skill, not `ai-spector-generate-srs`.

**`template install` fails — missing template file**

Every `documents[].template` in the manifest must exist under `.ai-spector/packs/.staging/templates/`. Re-run scan or fix staged files.

**Edited `.ai-spector/templates/` but generation unchanged**

With a custom pack active, templates are read from `.ai-spector/packs/<active>/templates/`, not the builtin copy.

**Multi-language + custom pack**

Both features use the same `docflow.config.json`:

- `languages[]` — primary + secondary (Work 10)
- `packs.active` — which template pack (this work)

Primary docs are generated from the graph in `languages[0]`; secondary langs are translated ([Work 10](10-multi-language.md)). If the pack manifest uses per-language folders, include `{lang}` in `output` / `outputPattern` — the core config does not add `{lang}` automatically.

**Want builtin SRS again**

```
use builtin template
```

---

## Next

Go to [Work 18 — Enable CocoIndex (Optional)](18-enable-cocoindex.md), or return to the [Course index](README.md).
