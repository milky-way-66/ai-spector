# Work 02 — Initialize a Project

**Course:** [Index](README.md) · [Overview](00-overview.md) · [Previous](01-prerequisites.md)

**Goal:** Run the one terminal command that creates all AI Spector folders, config files, and agent skill files inside your project.

**Before you start:** Work 01 (Prerequisites).

---

## What This Does

The `init` command is a setup wizard. It asks you a few questions and then generates:

| Created | Purpose |
|---------|---------|
| `.ai-spector/` | Config, traceability graph, templates, rules |
| `docs/data-source/` | Where you put your input requirements |
| `docs/srs/` | Where the SRS will be written |
| `docs/basic-design/` | Where the basic design will be written |
| `.cursor/` | Cursor skills, rules, and MCP config *(if you chose Cursor)* |
| `CLAUDE.md` + `.claude/skills/` + `.mcp.json` | Claude Code config *(if you chose Claude Code)* |
| `.git/hooks/pre-commit` | Auto-validate graph before every commit *(if you have Git)* |

---

## Steps

### 1. Open a terminal at your project root

```bash
cd /path/to/your/project
```

### 2. Run the init command

```bash
npx ai-spector@latest init --registry http://10.101.0.239:4873
```

> The `--registry` flag is required on the first run so `npx` can download the package from the internal registry. You do not need `npm login`.

---

### 3. Answer the wizard questions

The wizard will ask:

**Which editor?**
- `Cursor` — generates `.cursor/` folder with skills and `mcp.json`
- `Claude Code` — generates `CLAUDE.md`, `.claude/skills/`, and `.mcp.json`
- `Both` — generates config for both editors

Choose based on which editor you use. Both is fine if your team uses different editors.

---

**Which languages?**

Choose the languages for your documentation output (e.g. `en`, `vi`). The **first** code is the **primary** language — the agent generates SRS and basic design in that language from the graph. Other languages are filled by **translation** from primary files, not separate generation.

You can start with one language and add more later (see [Work 10 — Multi-language](10-multi-language.md)).

---

**Install git hook?**

Choose `yes` if you want the graph to be validated automatically every time you commit. Recommended.

---

**Enable CocoIndex?**

Choose `no` for now if you haven't set up Python 3.11 and a database. You can enable it later in Work 18.

---

### 4. Confirm the output

You should see a success summary listing all created files. If there are any errors, see Troubleshooting below.

---

## Check

Run:

```bash
ls .ai-spector/
```

You should see folders and files like `config.json`, `traceability.graph.json`, `rules/`, `templates/`.

Also check:

```bash
ls docs/
```

You should see `data-source/`, `srs/`, `basic-design/`.

---

## Troubleshooting

**"Cannot find package" or registry error**

The internal registry might be unreachable. Check you are on the company network (or VPN). Then retry:

```bash
npx ai-spector@latest init --registry http://10.101.0.239:4873
```

**"Already initialized" warning**

The `.ai-spector/` folder already exists. Running init again is safe — it will not overwrite your existing graph or config. It will only add missing files.

**Git hook not created**

If `git status` shows `not a git repository`, init skips the hook. Run `git init` first, then run init again.

---

## Next

Go to [Work 03 — Finish Setup in Chat](03-finish-setup-in-chat.md).
