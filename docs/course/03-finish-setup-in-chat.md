# Work 03 — Finish Setup in Chat

**Course:** [Index](README.md) · [Overview](00-overview.md) · [Previous](02-initialize-project.md)

**Goal:** Let the AI agent verify and complete the setup inside your editor, so you don't have to configure npm or MCP manually.

**Before you start:** Work 02 (Initialize a Project).

---

## Why This Step Exists

The `init` command creates files but does not install the npm dependency or verify that the MCP server can start. The agent does that for you when you say the magic phrase.

---

## Steps

### 1. Open the project in your editor

**Cursor** — File → Open Folder → select your project root.

**Claude Code** — in terminal, `cd` to your project root, then run:

```bash
claude
```

---

### 2. Open a chat window

**Cursor** — press `Cmd+L` (Mac) or `Ctrl+L` (Windows/Linux) to open the AI chat panel.

**Claude Code** — the terminal prompt is the chat.

---

### 3. Type exactly this

```
setup ai-spector project
```

Press Enter.

---

### 4. Watch what the agent does

The agent will:

1. Check if `ai-spector` is installed in `node_modules/`
2. Install it if missing (`npm install ai-spector`)
3. Verify the `.ai-spector/` folder and key config files exist
4. Check whether the MCP server binary is accessible
5. Ask if you want to enable CocoIndex *(say "no" for now if you skipped it in Work 02)*
6. Print a checklist of what is ready and what still needs manual action

---

### 5. Complete any manual steps the agent lists

The agent will tell you if anything still needs to be done by hand (for example, enabling skills in Cursor settings). Follow its instructions.

---

## Check

After the agent finishes, ask:

```
check ai-spector setup
```

You should see all items marked as ready. If anything is still missing, the agent will tell you what to fix.

---

## Troubleshooting

**Agent doesn't respond or skill doesn't trigger**

The skills might not be enabled yet. That is the job of Work 04. For now, if the agent responds generically and doesn't run any setup logic, continue to Work 04 first, then come back and retry this step.

**"npm install failed"**

Check that you are on the network that can reach the internal registry, or that the package is available on the public npm registry. You can also install manually:

```bash
npm install ai-spector --registry http://10.101.0.239:4873
```

Then run `setup ai-spector project` again.

**MCP server not found**

Ask the agent:

```
install ai-spector git hook
```

Or reload MCP in your editor (see Work 04).

---

## Next

Go to [Work 04 — Enable Agent Skills](04-enable-agent-skills.md).
