# Plugin Features — Selective Capability Gating — Design Spec

> **Status:** Draft (brainstorming approved)  
> **Date:** 2026-06-19  
> **Scope:** ai-spector core, CLI/MCP, agent scaffold, web handover  
> **Approach:** Extend `docflow.config.json` + bundled registry; Option B agent gating (meta-rule + skill tags)  
> **Related:** [language-config-web-handover.md](../../plan/language-config-web-handover.md), [review-system-handover.md](../../plan/review-system-handover.md)

---

## 1. Problem

Some client projects use only a subset of ai-spector — e.g. **comments**, **prototype**, and **translate** — while generating SRS elsewhere. Today the system assumes the **full pipeline** is active:

| Layer | What happens without full pipeline |
|-------|-------------------------------------|
| Agent rules (`CLAUDE.md`, after-doc-edit) | Mandates index, graph impact, analyze before generate |
| CLI `check` / pre-commit hooks | Emits GRAPH-001, TASK-003, graph validate failures |
| MCP tools | Generic `PRECONDITION_FAILED` when graph/index missing |
| Web app | Shows errors for missing review/graph artifacts — cannot distinguish “intentionally unused” vs broken |

Clients get **blocked or nagged** for features they never adopted.

### Success criteria

1. User selects enabled plugins at setup (or edits config); dependencies auto-resolve.
2. Disabled plugins: web hides UI modules without error; agent does not suggest disabled workflows; CLI/hooks skip related rules.
3. Enabled plugins behave identically to today’s full-mode behavior.
4. Existing projects with no `plugins` block default to **`full`** — zero behavior change.
5. Web reads one config field (`plugins.resolved`) to drive feature flags.

### Out of scope (v1)

- Third-party / npm-installable plugins (registry is builtin only)
- Filtered scaffold generation (Option A — deferred; v1 uses meta-rule + skill tags)
- Per-user plugin overrides (project-level only)
- Plugin marketplace UI
- Disabling `docs` (always implicit base plugin)

---

## 2. Core concepts

```text
Plugin registry (builtin, versioned, shipped in scaffold)
    │
    ├── id, label, description
    ├── requires: string[]           ← hard deps (auto-enabled by resolver)
    ├── optionalRequires: string[]   ← soft deps (warn only, v1 unused)
    └── provides:
          web: { modules[], artifacts[] }
          agent: { skills[], rules[] }
          cli: { checkRules[], hooks[], commands[], workflowSteps[] }

User selection → docflow.config.json → plugins.enabled[]
    │
Plugin resolver (topological sort, validate, write-back)
    │
    └── plugins.resolved[]  ← single field all consumers read

Consumers: Web | Agent routing | CLI check | Pre-commit | MCP handlers
```

**Plugin vs pack:** A **pack** is a document template bundle (SRS layout). A **plugin** is a runtime capability (comments, graph, generate-srs). Orthogonal — a project can use builtin SRS pack with `generate-srs` disabled.

---

## 3. Builtin plugins (v1)

| Plugin | Requires | Unlocks |
|--------|----------|---------|
| `docs` | — | Doc tree, path resolution, language layout (always on) |
| `comments` | `docs` | `comments/` threads, resolve-comments skill, comment MCP tools |
| `review` | `docs` | Review queue, vote flow, review MCP tools |
| `translate` | `docs`, `index` | Translation queue, lang-status, resolve-translation |
| `prototype` | `docs` | Prototype preview/generation |
| `index` | `docs` | Fingerprinting, translation queue reconciliation |
| `graph` | `index` | Traceability graph, impact, validate, search |
| `analyze` | `graph` | Data-source → knowledge.json pipeline |
| `generate-srs` | `graph` | Full SRS generation workflow |
| `generate-basic-design` | `generate-srs` | Basic design generation |
| `generate-detail-design` | `generate-basic-design` | Detail design generation |
| `resolve-task` | `graph` | Incremental change workflow |
| `sync-audit` | `graph` | Layer sync audit |
| `template-import` | `docs` | Custom template pack import |
| `adopt` | `docs`, `index` | Migrate legacy doc layout |
| `search` | `graph` | CocoIndex semantic search (also needs cocoindex setup) |

**Always implicit:** `docs` is injected by resolver if missing from `enabled`.

### Presets

| Preset | `enabled` plugins |
|--------|-------------------|
| `full` | All plugins (default for existing projects) |
| `collaboration` | `docs`, `comments`, `review`, `translate`, `index`, `prototype` |
| `generation` | `docs`, `index`, `graph`, `analyze`, `generate-srs`, `generate-basic-design`, `generate-detail-design`, `resolve-task`, `template-import` |
| `custom` | User picks; `preset` field records `custom` |

Example — client with external SRS, uses comments + prototype + translate:

```json
{
  "plugins": {
    "preset": "collaboration",
    "enabled": ["comments", "review", "prototype", "translate"],
    "resolved": ["docs", "comments", "review", "prototype", "translate", "index"],
    "resolvedAt": "2026-06-19T10:00:00.000Z"
  }
}
```

Note: resolver auto-adds `docs` and `index` (translate requires index).

---

## 4. Config schema

### 4.1 Project config — extend `docflow.config.json`

```json
{
  "version": 1,
  "languages": [ ... ],
  "clientLanguage": "vi",
  "plugins": {
    "preset": "collaboration",
    "enabled": ["comments", "review", "prototype", "translate"],
    "resolved": ["docs", "comments", "review", "prototype", "translate", "index"],
    "resolvedAt": "2026-06-19T10:00:00.000Z"
  },
  "paths": { ... },
  "packs": { ... }
}
```

| Field | Type | Written by | Read by |
|-------|------|------------|---------|
| `preset` | `"full"` \| `"collaboration"` \| `"generation"` \| `"custom"` | setup / user | UX display |
| `enabled` | `string[]` | user / setup | resolver input |
| `resolved` | `string[]` | resolver (`plugins resolve`) | **all consumers** |
| `resolvedAt` | ISO string | resolver | audit / upgrade drift |

TypeScript (`src/core/config/types.ts`):

```typescript
export type PluginPreset = "full" | "collaboration" | "generation" | "custom";

export interface PluginsConfig {
  preset?: PluginPreset;
  enabled: string[];
  resolved: string[];
  resolvedAt?: string;
}
```

### 4.2 Bundled registry

**Path:** `.ai-spector/.docflow/config/plugins/registry.json` (bundled in scaffold; projects may override)

```json
{
  "version": 1,
  "plugins": {
    "docs": {
      "label": "Document browser",
      "description": "Markdown doc tree and language path resolution",
      "requires": [],
      "provides": {
        "web": { "modules": ["docs"], "artifacts": ["docs/**"] },
        "agent": { "skills": [] },
        "cli": { "checkRules": ["STRUCT-001", "STRUCT-002", "STRUCT-003", "STRUCT-004", "CFG-001"] }
      }
    },
    "comments": {
      "label": "Review comments",
      "requires": ["docs"],
      "provides": {
        "web": { "modules": ["comments"], "artifacts": ["comments/**"] },
        "agent": { "skills": ["ai-spector-resolve-comments", "ai-spector-resolve-prototype-comments"] },
        "cli": { "checkRules": [] }
      }
    }
  },
  "presets": {
    "full": { "enabled": ["comments", "review", "translate", "prototype", "index", "graph", "analyze", "generate-srs", "generate-basic-design", "generate-detail-design", "resolve-task", "sync-audit", "template-import", "adopt", "search"] },
    "collaboration": { "enabled": ["comments", "review", "translate", "prototype"] },
    "generation": { "enabled": ["index", "graph", "analyze", "generate-srs", "generate-basic-design", "generate-detail-design", "resolve-task", "template-import"] }
  }
}
```

Full registry entries for all v1 plugins are maintained in implementation; the schema above is canonical.

---

## 5. Resolver

**Module:** `src/core/plugins/resolve.ts`

**Algorithm:**

1. Load registry + user `enabled[]` (or expand preset → `enabled`).
2. Inject `docs` if absent.
3. Topological expand: for each enabled plugin, recursively add `requires`.
4. Detect unknown ids → throw with list of valid plugins.
5. Detect cycles → throw (registry must be acyclic; validated in tests).
6. Write `resolved[]` + `resolvedAt` back to `docflow.config.json`.

**CLI:**

```bash
npx ai-spector plugins list          # registry + current resolved
npx ai-spector plugins resolve       # recompute resolved from enabled
npx ai-spector plugins set collaboration   # apply preset
npx ai-spector plugins enable prototype    # add one plugin + resolve
npx ai-spector plugins disable graph       # remove + resolve (fail if others depend)
```

**Setup integration:** `npx ai-spector setup --plugins collaboration` writes initial block.

**Public API:**

```typescript
export async function loadResolvedPlugins(root?: string): Promise<Set<string>>;
export function isPluginEnabled(resolved: Set<string>, id: string): boolean;
export async function assertPluginEnabled(root: string, id: string): Promise<void>;
```

---

## 6. Consumer gating

### 6.1 Web app

New handover: `docs/plan/plugin-features-web-handover.md`.

```typescript
function isModuleEnabled(config: DocflowConfig, module: string): boolean {
  const resolved = config.plugins?.resolved ?? FULL_PRESET_RESOLVED;
  const registry = loadRegistry(); // mirror bundled JSON in web repo
  return resolved.some((id) => registry.plugins[id]?.provides.web.modules.includes(module));
}
```

| Web module | Plugin | When disabled |
|------------|--------|---------------|
| Doc browser | `docs` | N/A (always on) |
| Comments panel | `comments` | Hide; no fetch `comments/` |
| Review queue | `review` | Hide; no fetch review-queue |
| Translation badges | `translate` | Hide stale-lang UI |
| Prototype tab | `prototype` | Hide prototype routes |
| Graph / impact | `graph` | Hide entirely |

Missing artifact files for **disabled** modules → no error UI. Missing files for **enabled** modules → existing error behavior.

### 6.2 CLI `check`

Before evaluating rule `RULE-ID`, compute union of `checkRules` from all resolved plugins. Rules not in union are skipped (same as `enabled: false` in `rules.json`).

| Rule | Plugin |
|------|--------|
| STRUCT-*, CFG-001 | `docs` |
| GRAPH-001 | `graph` |
| TASK-002, TASK-003, TASK-004 | `generate-*` (any resolved generate plugin) |
| READY-* | `generate-srs` |
| PACK-001 | `template-import` |
| ADOPT-001 | `adopt` |
| SYNC-001 | `sync-audit` |
| DERIVE-001-* | `generate-srs` (derive mode) |

Core plugins `ai-spector-setup`, `ai-spector-upgrade`, `ai-spector-check`, `ai-spector-course` remain routable regardless (meta tooling).

### 6.3 Pre-commit hook (`hooks.ts`)

| Step | Gate |
|------|------|
| `runCheck` structural errors | Always (docs plugin rules only) |
| `graph validate` | `graph` resolved |
| Translation queue warn | `translate` resolved |
| Graph impact warn | `graph` resolved |

### 6.4 MCP tools

Shared guard at handler entry:

```typescript
async function requirePlugins(root: string, ...ids: string[]): Promise<void> {
  const resolved = await loadResolvedPlugins(root);
  for (const id of ids) {
    if (!resolved.has(id)) {
      throw pluginDisabledError(id); // code: PLUGIN_DISABLED
    }
  }
}
```

| Tool group | Required plugin |
|------------|-----------------|
| `graph_*`, `knowledge_*` | `graph` (analyze tools also need `analyze`) |
| `index` | `index` |
| `comments_*` | `comments` |
| `lang_queue` | `translate` |
| `review_*` | `review` |
| `sync_audit`, `sync_snapshot` | `sync-audit` |
| `resolve_task` | `resolve-task` |
| `readiness_*` (generate) | matching `generate-*` |
| `adopt_*` | `adopt` |
| `template_*` | `template-import` |
| `docs_search`, `graph_query_fuzzy`, `cocoindex_*` | `search` |
| `workspace_check`, `context_*`, `task_*`, `workflow_*` | Always (meta) |

New tools: `plugins_list`, `plugins_config` (read resolved + registry labels).

### 6.5 Workflow dependencies

`evaluateWorkflowStep(stepId)` returns `{ ok: true, skipped: true }` when the step's plugin is not in `resolved`. Step → plugin map mirrors CLI workflow ids (`generate-srs` → `generate-srs`, etc.).

### 6.6 Agent (Option B — v1)

**New always-apply rule:** `ai-spector-plugins.mdc`

- On session start or before gated workflow: read `plugins.resolved` via MCP `plugins_config` or `docflow.config.json`.
- Do not invoke skills, MCP tools, or CLI commands for disabled plugins.
- If user asks for disabled feature: explain which plugin is off and how to enable (`npx ai-spector plugins enable …`).

**Skill frontmatter** (add to each skill):

```yaml
plugins:
  - graph
```

**Router update (`_skill-router.md`):** Before matching skill, verify at least one listed plugin is in `resolved`. Skills with empty/missing `plugins` key = meta skills (setup, upgrade, check, course).

**Conditional rule behavior:** `ai-spector-after-doc-edit.mdc` — agent reads plugins; skip impact/index sections when `graph` / `index` / `translate` off.

Future (v2): filtered scaffold sync omits disabled rule sections entirely.

---

## 7. Refactor scope

| Area | Change type |
|------|-------------|
| `src/core/plugins/*` | **New module** |
| `docflow.config.json` schema | **Extend** |
| `check.ts`, `hooks.ts`, MCP server | **Surgical guards** |
| Agent scaffold rules + skills | **Add meta-rule + frontmatter** |
| Graph, index, comments internals | **No change** |
| Web app | **Separate repo** — handover doc only |

**Not a big-bang refactor.** ~1 new module + ~15 integration touchpoints.

---

## 8. Migration

| Project state | Behavior |
|---------------|----------|
| No `plugins` block | Treat as `preset: full`; resolver writes block on first `plugins resolve` or upgrade |
| `readiness.docTypes.*.enabled: false` | Unchanged; orthogonal to plugins |
| Upgrade checklist | New item: "Run `plugins resolve` after config schema bump" |

---

## 9. Testing

| Test | Assert |
|------|--------|
| Resolver expands `translate` → includes `index`, `docs` | Unit |
| Unknown plugin id throws | Unit |
| `check` skips GRAPH-001 when `graph` off | Integration |
| Pre-commit skips validate when `graph` off | Integration |
| MCP `graph_validate` → `PLUGIN_DISABLED` | Integration |
| Default config (no block) = all plugins resolved | Unit |
| Preset `collaboration` matches expected set | Unit |
| Disable `graph` while `generate-srs` enabled → resolve fails | Unit |

---

## 10. Implementation phases

| Phase | Deliverable |
|-------|-------------|
| **P1** | Registry JSON, types, resolver, CLI `plugins *`, default `full` migration |
| **P2** | `check` + hooks gating |
| **P3** | MCP guards + `plugins_config` |
| **P4** | Agent meta-rule, skill frontmatter, router update |
| **P5** | Setup `--plugins`, web handover doc |

---

## 11. Open questions (deferred)

- Should `review` require `index` for hash invalidation? **v1: no** — review reads registry hashes written by ops pipeline.
- Should disabling `index` auto-disable `translate`? **Yes** — hard dependency in registry.
- CocoIndex / `search` plugin separate from `graph`? **Yes** — collaboration preset excludes both.