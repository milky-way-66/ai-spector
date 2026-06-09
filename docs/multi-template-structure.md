# Multi-template pack structure

How ai-spector stores templates, what the on-disk layout looks like, and what
`docflow.config.json` controls after custom template pack support.

---

## Concepts

| Term | Meaning |
|------|---------|
| **Builtin templates** | SRS + basic-design manifests shipped inside the `ai-spector` npm package (`documents.json`, `documents-basic-design.json`). Default when no custom pack is active. |
| **Template pack** | A self-contained bundle: `manifest.json` + markdown templates + optional hints. One pack = one document workflow (e.g. a custom SRS, arc42, team-specific layout). |
| **Active pack** | The single pack currently driving registry rebuild, graph bootstrap, and SRS DAG config. Selected by `packs.active` in config. |
| **Installed packs** | All packs copied under `.ai-spector/packs/<name>/`. Many can exist; only one is active at a time. |

Switch packs with:

```bash
npx ai-spector template list          # builtin + installed packs
npx ai-spector template use <name>    # activate a custom pack
npx ai-spector template use builtin   # back to builtin SRS + basic design
```

---

## Project layout (after init + optional custom packs)

```
my-project/
├── .ai-spector/
│   ├── docflow.config.json          ← project config (see below)
│   │
│   ├── templates/                   ← builtin template copy (from `init`)
│   │   ├── srs/
│   │   ├── basic_design/
│   │   └── detail_design/
│   │
│   ├── packs/
│   │   ├── .staging/                ← import workflow only (not a real pack)
│   │   │   ├── scan-result.json
│   │   │   ├── manifest.json        ← draft, pre-install
│   │   │   ├── templates/
│   │   │   └── generate-skill.md
│   │   │
│   │   └── <pack-name>/             ← one folder per installed custom pack
│   │       ├── manifest.json        ← pack definition (required)
│   │       ├── templates/           ← markdown templates for this pack
│   │       ├── generate-hints.md    ← auto-written on install / template use
│   │       ├── context-map.json     ← {placeholder} → graph field mapping
│   │       ├── gen-status.json        ← generation progress (written at runtime)
│   │       ├── regen-plan.md          ← stale outputs after graph changes
│   │       └── skill-hints.md         ← optional, copied on export
│   │
│   ├── graph/
│   │   └── traceability.graph.json
│   ├── registry/
│   │   └── section-registry.json
│   │
│   └── .docflow/
│       ├── config/
│       │   ├── dag.srs.json              ← SRS generation DAG
│       │   ├── dag.srs.graph-seeds.json  ← DAG node → graph document id
│       │   ├── dag.basic-design.json     ← builtin basic-design DAG
│       │   ├── dag.detail-design.json
│       │   └── …
│       ├── state.json
│       └── translation-queue/
│
├── docs/                            ← generated markdown lives here
│   ├── srs/{lang}/                  ← builtin SRS outputs (per language)
│   ├── basic-design/{lang}/
│   ├── detail-design/
│   └── data-source/                 ← input material for analysis
│
├── .cursor/skills/
│   └── ai-spector-generate-<pack>/  ← per-pack generate skill (after install)
│
└── prototype/                       ← UI prototype: static HTML or SPA dist (separate from template packs)
```

### Where templates live

| Mode | Template files read during registry build | Notes |
|------|-------------------------------------------|-------|
| **Builtin** (`packs` absent or `active: "builtin"`) | Package: `node_modules/ai-spector/templates/srs/` and `…/basic_design/` | `init` also copies the full tree to `.ai-spector/templates/` for agents and local edits. DAG paths reference filenames under that copy (e.g. `srs/1-introduction.md`). |
| **Custom pack** (`packs.active: "<name>"`) | `.ai-spector/packs/<name>/templates/` | Builtin copy in `.ai-spector/templates/` is **not** used for the active pack. SRS DAG files are regenerated from the pack manifest. |

### Where generated docs live

Defined per document in the pack **manifest** (`output` or `outputPattern`), not in
`docflow.config.json`.

Builtin examples:

- `docs/srs/en/1-introduction.md` — primary language subfolder from `init`
- `docs/srs/en/03-use-cases/uc-01-login.md` — per-domain breakout (`perDomain: "useCase"`)

Custom pack examples (you choose at import time):

- `docs/requirements/introduction.md`
- `docs/requirements/features/f-{nn}-{slug}.md`

---

## `docflow.config.json` — what it stores

Path: `.ai-spector/docflow.config.json`

```json
{
  "version": 1,
  "languages": [
    { "code": "en", "label": "English" },
    { "code": "vi", "label": "Vietnamese" }
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

### Field reference

| Field | Purpose |
|-------|---------|
| `version` | Config schema version. |
| `languages` | BCP-47 codes; **first entry is primary**. Drives `docs/<type>/{lang}/` folders and translation graph nodes. Not pack-specific. |
| `paths.graph` | Traceability graph JSON path (relative to project root). |
| `paths.registry` | Section registry JSON path. Rebuilt when packs change. |
| `paths.templates` | **Builtin** template copy root (`.ai-spector/templates`). Stays the same when switching custom packs. |
| `packs.active` | Active template pack name. **Omit** or set `"builtin"` to use package manifests. Any other string must match a folder under `.ai-spector/packs/<name>/`. |

### What config does *not* store

- Individual template file paths → in pack `manifest.json` → `documents[].template`
- Output paths for generated markdown → in manifest → `documents[].output` / `outputPattern`
- Per-domain vocabulary (`useCase`, `feature`, `epic`, …) → manifest → `perDomain`, `perDomainTemplates`, `defaultListedIn`
- DAG node order → `.ai-spector/.docflow/config/dag.srs.json` (derived from manifest when a custom pack is active)
- Placeholder resolution hints → `.ai-spector/packs/<name>/context-map.json`

---

## Pack manifest (`manifest.json`)

Each installed pack has one manifest at `.ai-spector/packs/<pack-name>/manifest.json`.

```json
{
  "version": 1,
  "name": "Kaopiz SRS",
  "packName": "kaopiz-srs",
  "description": "Team SRS layout",
  "nodePrefix": "doc.kaopiz.srs",
  "templatesDir": "templates",
  "perDomainTemplates": {
    "useCase": "doc.kaopiz.srs.use.case.detail",
    "feature": "doc.kaopiz.srs.feature.detail"
  },
  "defaultListedIn": {
    "useCase": "doc.kaopiz.srs.use.cases",
    "feature": "doc.kaopiz.srs.features"
  },
  "documents": [
    {
      "documentId": "doc.kaopiz.srs.introduction",
      "template": "introduction.md",
      "output": "docs/srs/introduction.md"
    },
    {
      "documentId": "doc.kaopiz.srs.use.case.detail",
      "template": "use-case-detail.md",
      "outputPattern": "docs/srs/use-cases/uc-{nn}-{slug}.md",
      "perDomain": "useCase"
    }
  ]
}
```

| Manifest field | Role |
|----------------|------|
| `packName` | Directory name under `.ai-spector/packs/` and value for `packs.active`. |
| `templatesDir` | Subfolder of the pack dir holding templates (default `"templates"`). |
| `nodePrefix` | Prefix for graph document node IDs (e.g. `doc.kaopiz.srs`). |
| `documents[]` | One entry per template file. |
| `documents[].documentId` | Stable graph/registry id. |
| `documents[].template` | Path relative to `templatesDir`. |
| `documents[].output` | Fixed output path for single-shot documents. |
| `documents[].outputPattern` | Pattern for per-item breakout files (`{nn}`, `{slug}`, `{lang}`, …). |
| `documents[].perDomain` | Domain key for repeating templates (camelCase vocabulary). |
| `perDomainTemplates` | Maps domain key → breakout document id. |
| `defaultListedIn` | Maps domain key → list document id (where items are enumerated). |

On `template install` or `template use <name>`, the CLI also writes:

- `generate-hints.md` — wave 0 / wave 1 generation instructions for agents
- `context-map.json` — scanned `{placeholder}` → suggested graph sources
- Overwrites `dag.srs.json` and `dag.srs.graph-seeds.json` from the manifest

---

## Mode comparison

### Builtin (default)

```
Config:     packs absent  OR  packs.active = "builtin"
Manifests:  ai-spector package → documents.json + documents-basic-design.json
Templates:  package templates/ + project copy .ai-spector/templates/
DAG:        scaffold defaults under .ai-spector/.docflow/config/
Skills:     ai-spector-generate-srs, ai-spector-generate-basic-design, …
```

### Custom pack active

```
Config:     packs.active = "<pack-name>"
Manifest:   .ai-spector/packs/<pack-name>/manifest.json  (single manifest)
Templates:  .ai-spector/packs/<pack-name>/templates/
DAG:        dag.srs.* regenerated from pack manifest
Skills:     ai-spector-generate-<pack-name>  (written at install)
```

Basic-design and detail-design DAGs remain scaffold defaults unless the custom
pack replaces the whole workflow (typical custom packs target one doc type, e.g.
SRS only).

---

## What-if scenarios

### What if `packs` is missing from config?

Builtin mode. Registry uses package `documents.json` + `documents-basic-design.json`.
Templates resolve from the package bundle; agents should still read `.ai-spector/templates/`.

### What if `packs.active` points to a missing folder?

Commands like `template use` fail with an error pointing at the expected
`manifest.json` path. Fix by installing the pack or switching to builtin.

### What if I install two packs?

Both live under `.ai-spector/packs/<name>/`. Config holds only the **active** one.
Switch with `npx ai-spector template use <other>`. Inactive packs stay on disk;
their generated docs under `docs/` are not deleted automatically.

### What if I switch from custom pack back to builtin?

```bash
npx ai-spector template use builtin
```

Removes `packs` from config, restores builtin `dag.srs.*` from scaffold, rebuilds
registry and graph from builtin manifests. Custom pack folders remain installed.

### What if I edit `.ai-spector/templates/` while a custom pack is active?

Builtin copy changes do not affect the active custom pack. Registry build reads
from `.ai-spector/packs/<active>/templates/`. Edits matter again after
`template use builtin`.

### What if output paths in the manifest omit `{lang}` but the project is multi-language?

Builtin SRS uses `docs/srs/{lang}/…`. Custom packs must declare language in
`output` / `outputPattern` if they want per-language folders — the tool does not
inject `{lang}` automatically. Primary language is still `languages[0]` in config.

### What if I re-run `init --force`?

Scaffold and `.ai-spector/templates/` are refreshed from the package. Custom packs
under `.ai-spector/packs/` are **not** removed, but `docflow.config.json` may be
reset — check `packs.active` after re-init.

---

## Import / export layout

### Staging (during import)

```
.ai-spector/packs/.staging/
├── scan-result.json      ← output of: npx ai-spector template scan <dir>
├── manifest.json         ← drafted by agent + user review
├── templates/            ← refined copies of user templates
└── generate-skill.md     ← draft skill before install
```

`template install` copies staging → `.ai-spector/packs/<packName>/`, sets
`packs.active`, rebuilds registry/graph, writes DAG + hints + skill.

### Export (share a pack)

```bash
npx ai-spector template export ./my-pack --pack kaopiz-srs
```

```
my-pack/
├── manifest.json
├── templates/
│   └── …
└── skill-hints.md        ← if present in source pack
```

Portable pack folder; import elsewhere with `template scan` + import workflow or
by copying into `.ai-spector/packs/<name>/` and running `template use <name>`.

---

## Related commands

| Command | Effect on structure |
|---------|---------------------|
| `ai-spector init` | Creates `.ai-spector/`, copies builtin templates, writes config without `packs`. |
| `ai-spector template scan <dir>` | Writes `.ai-spector/packs/.staging/scan-result.json`. |
| `ai-spector template install` | Promotes staging → `.ai-spector/packs/<packName>/`, sets `packs.active`. |
| `ai-spector template use <name>` | Updates `packs.active`, regenerates DAG + hints, rebuilds registry/graph. |
| `ai-spector template list` | Lists builtin + installed pack names and which is active. |
| `ai-spector template inspect <name>` | Validates manifest, templates, context-map, gen-status. |
| `ai-spector template export <dir>` | Writes portable `manifest.json` + `templates/` tree. |

---

## See also

- Import runbook: `scaffold/cursor/skills/ai-spector-template-import/references/runbook.md`
- Builtin template layout: `templates/README.md`
- Types: `src/core/config/types.ts` (`DocflowConfig`, `PackManifest`)
- Manifest resolution: `src/core/config/load.ts` → `resolveActiveManifests()`
