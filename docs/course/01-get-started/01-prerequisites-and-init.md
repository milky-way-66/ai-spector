# Prerequisites & initialize

**Section:** [Get started](README.md) · **Course:** [Home](../README.md)  
**Time:** ~10 min

**Goal:** Confirm your environment and scaffold the project with one command.

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

---

## Initialize

```bash
npx ai-spector@latest init --registry http://10.101.0.239:4873
```

Wizard: **editor** (Cursor / Claude / both), **languages**, **git hook** (yes), **CocoIndex** (no for now).

| Created | Purpose |
|---------|---------|
| `.ai-spector/` | Config, graph, templates |
| `docs/data-source/` | Input requirements |
| `docs/srs/`, `docs/basic-design/` | Generated output |
| `.cursor/` or `.claude/skills/` | Agent skills + MCP |

---

## Check

```bash
ls .ai-spector/ docs/data-source/
```

Both exist.

---

## Next

[Setup in chat & enable skills](02-setup-and-skills.md)
