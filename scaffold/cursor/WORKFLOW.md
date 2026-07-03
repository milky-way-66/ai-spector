# AI Spector workflow

**You describe what you need in chat.** Cursor picks the right **skill**; the agent calls **MCP tools** (when `ai-spector` server is configured) or falls back to **`npx ai-spector`** CLI.

Enable all 4 skills under `.cursor/skills/` (see [skills/README.md](./skills/README.md)). On CLI or tool failure: agent pauses, shows output, and offers fix / workaround / pause — [cli-failures](./skills/ai-spector/references/cli-failures.md).

**Path semantics:** skills and runbooks reference `kari-writer/contracts/CONTRACT.md` — agents do not load or link to `.docops/guide/`.

## One-time setup

**In chat (easiest):** say **"setup ai-spector project"** — agent uses the `ai-spector` skill.

**CLI (guided):**

```bash
npm install -D ai-spector --registry http://10.101.0.239:4873
npx ai-spector setup              # interactive wizard
npx ai-spector setup -y -l en,jp  # non-interactive
npx ai-spector setup --check      # audit only
```

Then: add files under `docs/data-source/`, enable **all** skills under `.cursor/skills/`, reload MCP.

> **After upgrading ai-spector** (`npm install -D ai-spector@latest --registry http://10.101.0.239:4873`): reload the MCP server in Cursor (Cmd+Shift+P → "Reload MCP Servers") so new tools are picked up.

## What to say → skill → agent does

| You want to… | Say (examples) | Skill | Agent runs (MCP preferred) |
|--------------|----------------|-------|---------------------------|
| **Setup project** | "setup ai-spector", "initialize project", "bootstrap project" | `ai-spector` | `setup --check` → `setup -y` → enable skills checklist |
| **Upgrade** | "upgrade ai-spector", "sync after update", "stale scaffold" | `ai-spector` | `upgrade scan` → install → `sync-cursor` → `upgrade apply` |
| **Align legacy docs** | "migrate existing SRS", "wrong SRS folder", "continue adopt" | `ai-spector` | `work_create` (adopt) → gated scan → `work_approve_plan` → apply → bootstrap → validate |
| **Check workspace** | "check my workspace", "why did pre-commit block me", "stale clarifications" | `ai-spector` | `workspace_check({})` → findings table → optional `fix: true` |
| **Docops / Writer contract** | "docops init", "migrate from docflow", "fix Writer templates" | `ai-spector` | `docops status` → `docops init` or `docops migrate --from-docflow` |
| **Resume / manage work** | "resume my SRS", "continue generation", "active tasks", "pause work" | `ai-spector` | `work_list` → `work_resume` → route to generate or stay in core |
| **Learn / open course** | "open the course", "learn ai-spector" | `ai-spector` | `course serve --open` → link lesson |
| Ingest sources | "analyze my data source", "build the knowledge graph" | `ai-spector-graph` | `index({})` → `knowledge_validate` → `graph_merge` → `graph_validate` |
| Check graph health | "validate the graph", "graph errors", "graph report" | `ai-spector-graph` | `graph_validate({})` · `graph_report({})` |
| Refresh after edits | "re-index", "sync the graph" | `ai-spector-graph` | `index({ cocoindexSync: true })` |
| Find docs by concept | "find all mentions of rate limiting", "which docs describe login?" | `ai-spector-graph` | `docs_search({ query })` MCP |
| Find graph node by name | "show graph for user login" (node ID unknown) | `ai-spector-graph` | `graph_query_fuzzy({ query })` MCP |
| What to redo | "what's impacted", "what should I regenerate" | `ai-spector-graph` | `graph_impact({ git: true, change: "…" })` |
| Sync audit / doc drift | "sync audit", "what changed since baseline", "layer sync" | `ai-spector-graph` | `sync_audit({})` → drift tables → offer remediation |
| Explore graph | "show the graph" | `ai-spector-graph` | `npx ai-spector graph visualize --open` |
| Write SRS | "generate SRS", "write use cases", "write chapter N" | `ai-spector-generate` | `work_list` bootstrap → **gated**: check → clarify → briefing + plan → `work_approve_plan` → waves → `spec_record` → `work_complete` |
| **Backfill SRS** | "generate SRS from basic design", "backfill SRS" | `ai-spector-generate` | same gates with `sourceMode: derive-downstream` |
| Basic design | "screen list", "API design", "wireframes" | `ai-spector-generate` | same gated flow → `docs/basic-design` → index each wave |
| Detail design | "generate detail design", "feature-level design" | `ai-spector-generate` | **gated generate**: check → clarify → briefing → plan → `work_approve_plan` → waves → index each wave |
| HTML prototype | "HTML mockup", "prototype with stripe theme" | `ai-spector-generate` | auth picker → theme picker → setup → HTML → validate |
| Add/update one feature or section | "I want to add login with Google", "update auth section" | `ai-spector-generate` | tier confirm → clarify → plan → `work_approve_plan` → execute → verify → `work_complete` |
| Template pack import | "set up template pack", "import my template" | `ai-spector-generate` | `template_scan` → `template_infer` → gated clarify → plan → `work_approve_plan` → `template_install` |
| Review extracted specs | "pending specs", "approve SPEC-001" | `ai-spector-generate` (stage 6) | `spec_list` → `spec_approve` (merges to graph) / `spec_reject` |
| Answer clarifications | "open questions", "what did I answer about auth" | `ai-spector` | `context_list` → `context_resolve` |
| **Review documents** | "review docs", "approve SRS", "approve srs/01-overview", "pending review", "what changed since approval" | `ai-spector-contract` | `review_begin` → queue → pick → `review_status` (readiness + quorum) → read doc → `graph_impact` → **write review** → user decision → `contract_review` (approve/decline/close/reject) |
| Review comments | "resolve comments", "fix C-001" | `ai-spector-contract` | inbox → plan → edit → commit (doc + comment meta in one amend commit) |
| Prototype comments | "resolve login screen comments", "B-001" | `ai-spector-contract` | batch-plan → clarify → approaches → yes gate → implement → batch-resolve |
| Translation status | "what's stale in JP", "pending translations" | `ai-spector-contract` | `lang_queue({})` → render pending table |
| Sync translations | "resolve translations", "update JP from EN" | `ai-spector-contract` | load queue → write targets → `index({})` |

Unsure? Say **"help me approve"** or call **`workflow_route`** — the agent uses [skills/_skill-router.md](./skills/_skill-router.md) or asks one clarifying question.

### "Approve" disambiguation

When intent is unclear, the agent asks:

```
Which did you mean?
1. Sign off a document (e.g. srs/01-overview) — formal approval
2. Approve an extracted spec (e.g. SPEC-003) — after generation
3. Go ahead with the plan we discussed — start making changes
4. Mark a comment thread done (e.g. C-012) — feedback addressed
```

| You mean… | Say… | Tool |
|-----------|------|------|
| Sign off a document | "approve srs/01-overview", "review documents" | `contract_review` (`action: "approve"`) via `ai-spector-contract` |
| Approve extracted spec | "approve SPEC-001" | `spec_approve` |
| Approve plan to execute | "yes, go ahead" (after plan table) | `work_approve_plan` |
| Mark comment thread done | "resolve C-012" | `contract_comments` (`action: "resolve"`) |

## Typical first run

```text
npx ai-spector init
docs/data-source/     ← your inputs
"analyze the data source"
"validate the graph"
"generate the SRS"
"refresh the index"
```

## Pipeline order

```text
analyze → validate graph
  → generate SRS         (gated: check → clarify → briefing → plan → waves → extract)
  → index → spec review  (approve → graph merge)
  → generate basic design (same gates) → index
  → generate detail design (same gates) → index each wave
  → prototype setup + generate HTML screens
```

**Every generate run is human-in-the-loop:** workspace check → clarify gaps (answers stored and re-used) → briefing → explicit yes before writing → extract specs for review → only approved specs reach the graph.

## If something fails

| Symptom | What to say / do |
|---------|------------------|
| Analyze failed | Agent offers fix vs workaround; say **1** to retry or "analyze again" after fixing data-source |
| Validate errors | "validate the graph" — agent explains each error |
| Empty SRS | "analyze" then "generate SRS" — not bulk-read all docs |
| Unsure what regen | "what's the impact of my changes" |
| Comments incomplete | "resolve comments" — commit must include doc + `comments/` meta |

References: [cli-failures](./skills/ai-spector/references/cli-failures.md), [graph CLI](./skills/ai-spector/references/graph.md), [prerequisites](./skills/ai-spector/references/prerequisites.md).
