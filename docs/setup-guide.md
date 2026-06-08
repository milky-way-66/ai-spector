# ai-spector — Setup Guide

Two ways to set up a new project: **ask the AI** (recommended for first-timers)
or **run the CLI yourself** (faster for experienced users or CI). Both paths
produce the same result.

---

## Prerequisites

| Requirement | Check |
|-------------|-------|
| Node.js ≥ 20 | `node --version` |
| Git repository | `git status` |
| Cursor or Claude Code | IDE open in project root |
| Python ≥ 3.11 *(optional)* | only needed for CocoIndex semantic search |

---

## Path A — Ask the AI

Open Cursor (or Claude Code) in your project folder and type:

```
setup ai-spector
```

The agent runs the `ai-spector-setup` skill and handles everything automatically:

1. Audits what's missing (`setup --check`)
2. Installs the npm dependency if `package.json` exists
3. Asks which languages you need (e.g. `en`, `en,jp,vi`)
4. Scaffolds the project (`setup --yes --languages <codes>`)
5. Installs the pre-commit git hook
6. Tells you what to do next in Cursor

**What the agent cannot do for you (manual steps):**
- Enable skills in Cursor: **Settings → Rules → Agent Skills → enable all folders under `.cursor/skills/`**
- Add source material to `docs/data-source/`

Once those are done, type:
```
analyze my data source
```

---

## Path B — CLI

### Step 1 — Audit

```bash
npx ai-spector setup --check
```

Read the checklist. All `✗ missing` items under `node`, `init`, and
`cursor-skills` must be fixed.

---

### Step 2 — Install (if package.json exists)

```bash
npm install -D ai-spector
```

Skip if you prefer global `npx` invocations without a local install.

---

### Step 3 — Scaffold

Single command — replace `en` with your language codes:

```bash
npx ai-spector setup --yes --languages en --install-dep
```

Multi-language example:
```bash
npx ai-spector setup --yes --languages en,jp,vi --install-dep
```

This command:
- Runs `init` (creates `.ai-spector/`, `.cursor/skills/`, `docs/`)
- Creates per-language `docs/srs/` and `docs/basic-design/` directories
- Installs the pre-commit hook
- Copies all agent skills to `.cursor/skills/`

---

### Step 4 — Verify

```bash
npx ai-spector setup --check
```

All three required steps must show `✓`:

```
  ✓ Node.js 20+
  ✓ AI Spector project scaffold
  ✓ Cursor agent skills
```

---

### Step 5 — Enable skills in Cursor

1. Open the project in Cursor
2. **Settings → Rules → Agent Skills**
3. Enable **all folders** under `.cursor/skills/`
4. If `.cursor/mcp.json` is present: reload MCP server

---

### Step 6 — Add source material

Drop your requirements docs, meeting notes, user stories, or any input
material into `docs/data-source/`. Supported formats: `.md`, `.txt`, `.pdf`.

---

### Step 7 — Start the pipeline

```bash
# In Cursor chat:
analyze my data source
```

Or directly:
```bash
npx ai-spector analyze
npx ai-spector graph validate
npx ai-spector index
```

---

## Optional — CocoIndex semantic search

Enables `docs_search`, `graph_query_fuzzy`, and semantic suggestions in
`graph_impact`. Requires Python ≥ 3.11.

### Via AI

```
enable CocoIndex for this project
```

The agent runs `ai-spector-setup` → offers CocoIndex opt-in automatically.

### Via CLI

```bash
# Scaffold the pipeline
npx ai-spector cocoindex setup

# Install Python deps
cd .ai-spector/.docflow/cocoindex
pip install -r requirements.txt

# (Optional) configure storage / model
cp .env.example .env
# edit .env if you want Postgres or OpenAI embeddings

# Run first index
python pipeline.py cocoindex update
```

Default: **LanceDB** (file-based, no server). Set `COCOINDEX_DB_URL` for Postgres.
Default model: **all-MiniLM-L6-v2** (local, ~80 MB download). Set
`OPENAI_API_KEY + COCOINDEX_EMBED_MODEL=openai:text-embedding-3-small` for
better quality.

Keep embeddings fresh:
```bash
# After editing docs, run index + CocoIndex together:
npx ai-spector index --cocoindex-sync

# Or separately:
npx ai-spector index
python .ai-spector/.docflow/cocoindex/pipeline.py cocoindex update
```

---

## Optional — Add a language later

```bash
npx ai-spector lang add jp
npx ai-spector index
```

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| `setup --check` shows `✗ init` | Run `npx ai-spector setup --yes --languages en` |
| `setup --check` shows `✗ cursor-skills` | Run `npx ai-spector sync-cursor` |
| Skills not routing correctly in Cursor | Re-enable all folders under `.cursor/skills/` in Settings → Rules |
| Pre-commit hook not firing | Run `npx ai-spector hooks install` |
| `analyze` fails | Check `docs/data-source/` has files; run `setup --check` first |
| `graph validate` errors | Run `npx ai-spector index`, then validate again |
| CocoIndex search returns nothing | Run `python pipeline.py cocoindex update` to (re)build embeddings |
| `python pipeline.py` not found | Run `npx ai-spector cocoindex setup` first |

Full CLI failure guide: `.cursor/skills/ai-spector/references/cli-failures.md`

---

## What gets created

```
your-project/
├── .ai-spector/
│   ├── docflow.config.json       ← project config (languages, paths)
│   └── .docflow/
│       ├── graph/
│       │   └── traceability.graph.json
│       ├── config/
│       │   └── index.docs.json
│       └── cocoindex/            ← only if CocoIndex enabled
│           ├── pipeline.py
│           ├── requirements.txt
│           └── .env.example
├── .cursor/
│   └── skills/                   ← agent skill files (auto-updated by sync-cursor)
├── docs/
│   ├── data-source/              ← drop your input material here
│   ├── srs/
│   │   └── en/                   ← one folder per language
│   └── basic-design/
│       └── en/
└── .git/hooks/pre-commit         ← validates graph + checks translations
```

---

## Next steps after setup

```
analyze my data source   → build the traceability graph
generate SRS             → write requirements docs
generate basic design    → screen list, API list, DB design
```

Full workflow: `.cursor/WORKFLOW.md`
