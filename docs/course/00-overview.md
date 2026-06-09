# AI Spector — Course Overview

AI Spector is a documentation workflow tool for software projects. It runs inside **Cursor** or **Claude Code** and helps you produce SRS, basic design, UI prototypes (static HTML or SPA), and traceability graphs by talking to an AI agent in chat.

**You rarely touch the terminal.** After the first setup command, everything is done in chat.

**Index:** [Course README](README.md) — linked list of all works, grouped basic → advanced.

---

## What You Will Learn

### Setup

| # | Work | What You Do |
|---|------|-------------|
| 01 | [Prerequisites](01-prerequisites.md) | Install Node, Git, and your editor |
| 02 | [Initialize a Project](02-initialize-project.md) | Run the one `npx` command that scaffolds the workspace |
| 03 | [Finish Setup in Chat](03-finish-setup-in-chat.md) | Tell the agent to complete the setup |
| 04 | [Enable Agent Skills](04-enable-agent-skills.md) | Turn on skill routing in your editor |

### Core pipeline

| # | Work | What You Do |
|---|------|-------------|
| 05 | [Add Source Material](05-add-source-material.md) | Drop requirements docs into the input folder |
| 06 | [Analyze Data Source](06-analyze-data-source.md) | Ask the agent to read and extract your requirements |
| 07 | [Validate the Graph](07-validate-the-graph.md) | Ask the agent to check the traceability graph |
| 08 | [Generate SRS](08-generate-srs.md) | Ask the agent to write the Software Requirements Specification |
| 09 | [Index the Project](09-index-the-project.md) | Ask the agent to rebuild the search index |

### Extend documents

| # | Work | What You Do |
|---|------|-------------|
| 10 | [Multi-language Documentation](10-multi-language.md) | Add languages and keep translated docs in sync |
| 11 | [Generate Basic Design](11-generate-basic-design.md) | Ask the agent to produce the basic (high-level) design doc |
| 12 | [Pick a Prototype Theme](12-pick-prototype-theme.md) | Browse and choose a visual theme for the prototype |
| 13 | [Generate Prototype](13-generate-prototype.md) | Ask the agent to build a clickable prototype |

### Maintain & explore

| # | Work | What You Do |
|---|------|-------------|
| 14 | [Impact Analysis](14-impact-analysis.md) | Ask the agent what needs to be updated after a change |
| 15 | [Resolve Comments](15-resolve-comments.md) | Work through inline doc review comments |
| 16 | [Visualize the Graph](16-visualize-the-graph.md) | Open an interactive graph in the browser |

### Advanced / optional

| # | Work | What You Do |
|---|------|-------------|
| 17 | [Custom Template Packs](17-custom-template-packs.md) | Import team templates and switch the active pack |
| 18 | [Enable CocoIndex](18-enable-cocoindex.md) | Add semantic search to your workflow |
| 19 | [Add Another Editor](19-add-another-editor.md) | Add Cursor or Claude Code support later |

---

## How to Read These Docs

Each file is **one work** — a single task you complete in one sitting. Every work has:

- **Goal** — what you will have when you finish
- **Before you start** — which earlier works must be done first
- **Steps** — exactly what to do
- **Check** — how you know it worked
- **Troubleshooting** — what to do if something goes wrong

Works **01–09** are the foundation. Works **10–16** extend and maintain your docs. Works **17–19** are optional power features — skip them until you need them.
