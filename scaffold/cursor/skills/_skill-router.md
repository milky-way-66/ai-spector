# AI Spector skill router

Cursor loads skills by **description** when the user does not use a slash command. Enable **all** skills under `.cursor/skills/` after `init`.

## Skills

| Skill folder | When Cursor should use it |
|--------------|---------------------------|
| `ai-spector` | Any ai-spector / docflow / `.ai-spector` project work; shared CLI rules |
| `ai-spector-graph` | Analyze, index, validate, impact, visualize, Graphify, knowledge.json, regen scope |
| `ai-spector-generate` | Generate or update SRS, basic design, detail design under `docs/` |
| `ai-spector-resolve-comments` | Review comments in `comments/`, resolve threads, C-001 pick list |

## Slash commands (explicit)

When the user runs `/analyze`, `/generate-srs`, `/resolve-comments`, etc., read the matching file in `.cursor/commands/` — skills and commands share the same rules.

## Priority

1. Explicit slash command → `commands/<name>.md`
2. Natural language → task skill above + same command doc when one exists
3. Ambiguous → `ai-spector` core + ask which task (graph vs generate vs comments)
