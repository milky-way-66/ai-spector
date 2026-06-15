# Prerequisites & initialize

**Section:** [Get started](README.md) · **Course:** [Home](../README.md)  
**Time:** ~10 min

**Goal:** Confirm your environment, install AI Spector, and scaffold the project.

---

## Prerequisites

| Requirement | Command | Need |
|-------------|---------|------|
| Node.js ≥ 20 | `node --version` | Required |
| Git | `git --version` | Required |
| Cursor or Claude Code | open editor | Required |
| Python ≥ 3.11 | `python3 --version` | Optional (semantic search later) |

AI Spector must run inside a Git repo:

```bash
cd /path/to/your/project
git status   # or: git init && git commit -m "initial commit"
```

If you have no `package.json` yet: `npm init -y`

---

## Install & init

**Two steps** — install the package first, then run the wizard.

**Internal registry** (no `npm login`):

```bash
npm install ai-spector --registry http://10.101.0.239:4873
npx ai-spector init
```

**Public npm:**

```bash
npm install ai-spector
npx ai-spector init
```

Wizard: **editor** (Cursor / Claude / both), **languages**, **git hook** (yes), **CocoIndex** (no for now).

| Created | Purpose |
|---------|---------|
| `.ai-spector/` | Config, graph, templates |
| `docs/data-source/` | Input requirements |
| `docs/srs/`, `docs/basic-design/` | Generated output |
| `.cursor/` or `.claude/skills/` | Agent skills + MCP |

---

## What you should see

- Wizard completes without errors.
- `ls .ai-spector/` and `docs/data-source/` exist.
- `node_modules/ai-spector` present after install.

---

## Check

```bash
ls .ai-spector/ docs/data-source/
ls node_modules/ai-spector   # package installed locally
```

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| `npx ai-spector init` not found | Run `npm install ai-spector` first |
| Registry error on install | Check VPN / company network |
| Not a git repo | `git init` and initial commit |

---

## Next

[Setup in chat & enable skills](02-setup-and-skills.md)
