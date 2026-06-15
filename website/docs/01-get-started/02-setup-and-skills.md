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

Routing files (after init): `.cursor/skills/_skill-router.md`, `.cursor/WORKFLOW.md`, and always-on rule `.cursor/rules/ai-spector-routing.mdc`.

---

## What you should see

- Setup checklist with pass/fail items.
- All skills enabled in Cursor settings.
- MCP server `ai-spector` connected (reload if tools missing).

---

## Check

```
validate the graph
```

The agent invokes a graph tool (empty graph is fine) — not a generic refusal.

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Agent doesn't know ai-spector | Enable all skills; reload MCP |
| MCP tools missing | Cmd+Shift+P → Reload MCP Servers |
| Skills routing wrong | Re-enable every folder under `.cursor/skills/` |

---

## Next section

[Chat basics — How chat works](../02-chat-basics/01-how-chat-works.md)
