# Setup via chat

**Section:** [Get started](README.md) · **Course:** [Home](../README.md)  
**Time:** ~10 min

**Goal:** Get your project ready by asking the agent — no terminal commands required.

---

## In plain terms

Before you generate documents, the project needs a one-time setup: folders, agent skills, and configuration. **Ask the agent to set it up for you.**

You need:
- A Git repository (your project folder)
- Cursor or Claude Code with AI Spector installed in the project

---

## You say → Agent does → You see

**You say:** *"setup ai-spector project"*

**Agent does:** Runs the setup workflow — checks the workspace, installs scaffolding, and lists what you should enable.

**You see:**
- A checklist of created folders (`docs/data-source/`, `.ai-spector/`, skills)
- Reminder to enable skills under `.cursor/skills/`
- Option to run *"check my workspace"* when done

---

:::exercise
**Paste in chat:**

```
setup ai-spector project
```

**You should see:**
- Agent walks through setup (not silent file writes)
- `docs/data-source/` mentioned as where your inputs go
- No errors at the end of setup
:::

:::roletip
**Developer** — you can watch the agent run CLI commands; you do not need to type them yourself.
:::

:::behind
Developers may also run `npx ai-spector setup -y` from the terminal. Daily work still happens in chat.
:::

## If something goes wrong

| Symptom | Say in chat |
|---------|-------------|
| Not a git repo | Ask your developer to run `git init`, or say *"initialize git repo"* |
| Package not installed | *"install ai-spector in this project"* |
| Skills not routing | *"check my workspace"* — agent lists missing skills |

---

## Next

[How chat works](../03-chat-basics/01-how-chat-works.md)
