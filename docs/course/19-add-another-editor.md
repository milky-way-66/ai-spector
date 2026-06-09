# Work 19 — Add Another Editor (Optional)

**Course:** [Index](README.md) · [Overview](00-overview.md) · [Previous](18-enable-cocoindex.md)

**Goal:** Add support for a second editor (Cursor or Claude Code) to a project that was initialized with only one.

**Before you start:** Work 02 (Initialize a Project) with at least one editor already configured.

---

## When You Need This

- You initialized with Cursor only, but now want to use Claude Code too
- A new team member uses a different editor
- You upgraded `ai-spector` and need to sync the latest skill files

---

## Adding Claude Code Support (to a Cursor project)

### 1. Open chat in Cursor

### 2. Type this

```
add Claude Code support to ai-spector
```

The agent generates:
- `CLAUDE.md` at the project root
- `.claude/skills/` folder with all skill files
- `.mcp.json` at the project root

---

## Adding Cursor Support (to a Claude Code project)

### 1. Open chat in Claude Code

### 2. Type this

```
add Cursor support to ai-spector
```

The agent generates:
- `.cursor/skills/` folder with all skill files
- `.cursor/mcp.json`
- `.cursor/rules/` if needed

---

## Syncing Skills After an Upgrade

When `ai-spector` is updated to a new version, the skill files may have changed. Sync them in chat:

```
sync ai-spector cursor skills
```

or

```
sync ai-spector claude skills
```

The agent overwrites the skill files with the latest version from the installed package. Your custom edits to `CLAUDE.md` are preserved — only the skill instruction files are updated.

---

## Check

After adding the editor, open the project in the new editor and type:

```
validate the graph
```

The agent should respond with a graph validation result (not a generic "I don't know what that is" response).

---

## Troubleshooting

**"CLAUDE.md already exists"**

The agent will ask before overwriting. Answer `yes` to replace with the latest version, or `no` to keep your custom version.

**Skills not triggering in the new editor**

Enable skills manually:
- **Cursor:** Settings → Rules → Agent Skills → enable all folders under `.cursor/skills/`
- **Claude Code:** Restart Claude Code — skills load automatically from `.claude/skills/`

**MCP not working in the new editor**

Check that the MCP config file exists:
- Cursor: `.cursor/mcp.json`
- Claude Code: `.mcp.json`

Then reload MCP in your editor settings.

---

## Next

You have completed all works. Return to the [Course index](README.md) or [Overview](00-overview.md).
