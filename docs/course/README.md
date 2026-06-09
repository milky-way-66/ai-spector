# AI Spector Course

Step-by-step guides for setting up and using AI Spector in **Cursor** or **Claude Code**. After the first CLI command, most work happens in chat.

Start with the [Course Overview](00-overview.md), then follow the works in order — **basic setup → core pipeline → documents & prototype → maintenance → advanced options**.

---

## Works

### Setup (01–04)

| # | Work | Summary |
|---|------|---------|
| — | [Overview](00-overview.md) | What the course covers and how to read these docs |
| 01 | [Prerequisites](01-prerequisites.md) | Install Node, Git, and your editor |
| 02 | [Initialize a Project](02-initialize-project.md) | Run the one `npx` command that scaffolds the workspace |
| 03 | [Finish Setup in Chat](03-finish-setup-in-chat.md) | Tell the agent to complete the setup |
| 04 | [Enable Agent Skills](04-enable-agent-skills.md) | Turn on skill routing in your editor |

### Core pipeline (05–09)

| # | Work | Summary |
|---|------|---------|
| 05 | [Add Source Material](05-add-source-material.md) | Drop requirements docs into the input folder |
| 06 | [Analyze Data Source](06-analyze-data-source.md) | Ask the agent to read and extract your requirements |
| 07 | [Validate the Graph](07-validate-the-graph.md) | Ask the agent to check the traceability graph |
| 08 | [Generate SRS](08-generate-srs.md) | Ask the agent to write the Software Requirements Specification |
| 09 | [Index the Project](09-index-the-project.md) | Ask the agent to rebuild the search index |

### Extend documents (10–13)

| # | Work | Summary |
|---|------|---------|
| 10 | [Multi-language Documentation](10-multi-language.md) | Add languages and sync translations across `docs/{type}/{lang}/` |
| 11 | [Generate Basic Design](11-generate-basic-design.md) | Ask the agent to produce the basic (high-level) design doc |
| 12 | [Pick a Prototype Theme](12-pick-prototype-theme.md) | Browse and choose a visual theme for the prototype |
| 13 | [Generate Prototype](13-generate-prototype.md) | Build a clickable prototype (static HTML or SPA static build) |

### Maintain & explore (14–16)

| # | Work | Summary |
|---|------|---------|
| 14 | [Impact Analysis](14-impact-analysis.md) | Ask the agent what needs updating after a change |
| 15 | [Resolve Comments](15-resolve-comments.md) | Work through inline doc review comments |
| 16 | [Visualize the Graph](16-visualize-the-graph.md) | Open an interactive graph in the browser |

### Advanced / optional (17–19)

| # | Work | Summary |
|---|------|---------|
| 17 | [Custom Template Packs](17-custom-template-packs.md) | Import team templates and switch the active pack |
| 18 | [Enable CocoIndex](18-enable-cocoindex.md) | Add semantic search to your workflow |
| 19 | [Add Another Editor](19-add-another-editor.md) | Add Cursor or Claude Code support later |

---

## Suggested paths

**Minimum (builtin SRS, one language):** 01 → 02 → 03 → 04 → 05 → 06 → 07 → 08 → 09

**Standard project:** continue 11 → 12 → 13 → 14

**Multi-language project:** 01–09 → **10** → 11 (then `resolve translations` whenever primary docs change)

**Custom SRS layout from day one:** 01–04 → **17** (install pack) → 05–09 using `generate <pack-name>`

**Power-user add-ons:** 16 (graph browser), 18 (semantic search), 19 (second editor)

---

## Related docs

- [Multi-template pack structure](../multi-template-structure.md) — custom template packs and project layout
- [SDK reference](../sdk.md) — programmatic API for integrations
