# AI Spector

Documentation workflow in **Cursor** or **Claude Code**: traceability graph, SRS, basic/detail design, prototypes. **Say what you need in chat** — the agent picks one of **4 skills** and runs MCP tools. You rarely touch the terminal.

**Needs:** Node 20+, Git, Cursor and/or Claude Code · Python 3.11+ optional (CocoIndex search)

**Learn:** `npx ai-spector course serve --open` · [Course](website/docs/en/README.md) · [Tiếng Việt](README.vi.md)

---

## Quick start

**1. Install once** (project root):

```bash
npm install ai-spector --registry http://10.101.0.239:4873
npx ai-spector init
```

Public npm: drop `--registry …`.

**2. Finish in chat:**

```text
setup ai-spector project
```

**3. Enable skills** (one-time): Settings → Agent Skills → turn on all four folders under `.cursor/skills/` (or `.claude/skills/`). Reload MCP.

**4. Add sources** to `docs/data-source/`, then:

```text
analyze my data source
```

Full routing map lives in `.cursor/WORKFLOW.md` or `CLAUDE.md` after init.

---

## What to say

Four skills — say the goal; the agent reads the runbook and calls tools.

| Skill | You want to… | Say (examples) |
|-------|----------------|----------------|
| **ai-spector** | Setup, upgrade, adopt, check, docops, work sessions | `setup ai-spector project` · `upgrade ai-spector` · `check my workspace` · `migrate existing docs to docops` · `resume my SRS` |
| **ai-spector-generate** | SRS, design, prototype, one feature/section | `generate the SRS` · `generate basic design` · `generate prototype with Vue` · `I want to add login with Google` |
| **ai-spector-graph** | Index, validate, impact, search, drift | `validate the graph` · `re-index the graph` · `what's the impact of my changes` · `find mentions of rate limiting` |
| **ai-spector-contract** | Review, comments, translation | `review documents` · `approve srs/01-overview` · `resolve comments` · `add language vi` |

**Approve** is ambiguous (document sign-off vs plan vs comment). The agent asks once if unclear.

### Typical first run

```text
analyze the data source
validate the graph
generate the SRS
```

Generation is gated: clarify → plan table → your **yes, go ahead** → writing waves → optional spec approval → index.

Then as needed:

```text
generate basic design
generate prototype
review documents
```

### Day to day

| When | Say |
|------|-----|
| New or changed sources | `analyze data source` |
| After editing docs | `re-index the graph` |
| One section / feature | `update the auth section` · `I want to add …` |
| Stuck on setup | `check ai-spector setup` · `help` |
| Stale skills after upgrade | `upgrade ai-spector` |
| Optional semantic search | `enable CocoIndex for this project` |

---

## When chat is not enough

| Situation | Prompt first | CLI fallback |
|-----------|--------------|----------------|
| Audit setup | `check ai-spector setup` | `npx ai-spector setup --check` |
| Writer contract only | `docops status` | `npx ai-spector docops status --json` |
| Open course | `open the ai-spector course` | `npx ai-spector course serve --open` |
| Graph in browser | `show the graph` | `npx ai-spector graph visualize --open` |

Command reference: `npx ai-spector --help` · [cli-reference](scaffold/cursor/skills/ai-spector/references/cli-reference.md)

---

## If something breaks

| Issue | Say in chat |
|-------|-------------|
| MCP tools missing | Reload MCP; confirm `ai-spector` server in `.cursor/mcp.json` or `.mcp.json` |
| Setup incomplete | `check ai-spector setup` |
| Skills not routing | Re-enable all **4** skill folders |
| Validate errors after edits | `re-index the graph` |
| CLI errors | Agent uses [cli-failures](scaffold/cursor/skills/ai-spector/references/cli-failures.md) |

---

## More

| Topic | Doc |
|-------|-----|
| Config (`.docops/` + `.ai-spector/`) | [CONTRACT.md](../kari-writer/contracts/CONTRACT.md) |
| Legacy migration | [MIGRATION.md](../kari-writer/contracts/MIGRATION.md) |
| Node SDK (scripts / CI) | [docs/plan/sdk.md](docs/plan/sdk.md) |
| Browser graph UI | [docs/ai-spector-graph-integration-guide.md](docs/ai-spector-graph-integration-guide.md) |
| CocoIndex setup | [docs/setup-guide.md](docs/setup-guide.md) |
| Contribute / publish | `npm install && npm run build && npm test` · `npm run deploy` (internal) · `npm run deploy:npm` (public) |

MIT — [LICENSE](LICENSE).
