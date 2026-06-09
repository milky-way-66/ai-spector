# Work 01 — Prerequisites

**Course:** [Index](README.md) · [Overview](00-overview.md)

**Goal:** Confirm your machine has everything AI Spector needs before you touch any project.

**Before you start:** Nothing. This is the first work.

---

## What You Need

| Requirement | Why | Minimum version |
|-------------|-----|-----------------|
| Node.js | Runs the AI Spector CLI and MCP server | 20 |
| Git | Required for the project repo and pre-commit hooks | any recent |
| Cursor or Claude Code | The editor where the AI agent runs | latest |
| Python *(optional)* | Only needed if you want CocoIndex semantic search | 3.11 |

---

## Steps

### 1. Check Node.js

```bash
node --version
```

You should see `v20.x.x` or higher. If not, install Node from [nodejs.org](https://nodejs.org) (choose the LTS release).

---

### 2. Check Git

```bash
git --version
```

Any output means Git is installed. If the command is not found, install Git from [git-scm.com](https://git-scm.com).

---

### 3. Check your editor

**Cursor** — download from [cursor.com](https://cursor.com). Open a terminal inside Cursor to verify it works.

**Claude Code** — install via npm:

```bash
npm install -g @anthropic-ai/claude-code
```

Then run:

```bash
claude --version
```

You can use both editors on the same project. You don't have to choose just one.

---

### 4. Check Python *(skip if you don't want semantic search)*

```bash
python3 --version
```

You need `3.11` or higher. If not installed, get it from [python.org](https://python.org). You can always skip this and enable CocoIndex later (see Work 18).

---

### 5. Make sure your project is a Git repo

AI Spector must be set up inside a Git repository.

```bash
cd /path/to/your/project
git status
```

If you see `not a git repository`, run:

```bash
git init
git add .
git commit -m "initial commit"
```

---

## Check

Run all four commands and confirm there are no errors:

```bash
node --version   # v20 or higher
git --version    # any version
npx --version    # comes with Node, any version
```

---

## Next

Go to [Work 02 — Initialize a Project](02-initialize-project.md).
