# Setup in chat & enable skills

**Section:** [Get started](README.md) · **Course:** [Home](../README.md)  
**Time:** ~10 min · **Before:** [Prerequisites & init](01-prerequisites-and-init.md)

**Goal:** Finish npm/MCP setup in chat and turn on skill routing.

---

## Finish setup in chat

Open the project in Cursor or Claude Code, then say:

```
setup ai-spector project
```

The agent installs `ai-spector`, verifies config, and prints a checklist. Confirm with:

```
check ai-spector setup
```

Browse the course while you wait: `npx ai-spector course serve --open`

---

## Enable skills

**Cursor:** Settings → Rules → **Agent Skills** → enable every folder under `.cursor/skills/`. Reload MCP.

**Claude Code:** Skills load from `.claude/skills/` automatically. Reload MCP via restart or `/mcp`.

Key skills: `ai-spector`, `ai-spector-review`, `ai-spector-graph`, `ai-spector-generate-srs`.

---

## Check

```
validate the graph
```

The agent invokes a graph tool (empty graph is fine) — not a generic refusal.

---

## Next section

[Chat basics — How chat works](../02-chat-basics/01-how-chat-works.md)
