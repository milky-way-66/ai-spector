# Course guide — for agents

Help users **learn** AI Spector. Open the browser course and deep-link to the right lesson.

## Open course

```bash
npx ai-spector course serve --open
```

- **Home:** `http://127.0.0.1:4177/course/index`
- **Lesson:** `http://127.0.0.1:4177/course/<slug>`

If port 4177 is busy, the command may fail — retry or suggest the user close the other instance.

## Intent → lesson map

| User asks about… | Open lesson (slug) | Then suggest in chat |
|------------------|-------------------|----------------------|
| Install, init, prerequisites | `01-get-started/01-prerequisites-and-init` | `setup ai-spector project` |
| Enable skills, finish setup | `01-get-started/02-setup-and-skills` | `check my workspace` |
| How chat / routing works | `02-chat-basics/01-how-chat-works` | `help me approve` |
| Workspace, tasks, resume | `02-chat-basics/02-workspace-and-tasks` | `active tasks` |
| Add one feature / section | `02-chat-basics/03-incremental-changes` | `I want to add login with Google` |
| Data source, analyze | `03-graph/01-sources-and-analyze` | `analyze my data source` |
| Validate graph, explore | `03-graph/02-validate-index-explore` | `validate the graph` |
| Generate SRS (gated flow) | `04-generate/01-generate-srs` | `generate the SRS` |
| Basic design | `04-generate/02-basic-design` | `generate basic design` |
| Translations / multi-language | `05-prototype/01-translations` | `add language vi` |
| HTML / SPA prototype | `05-prototype/02-build-prototype` | `generate prototype` |
| Hosted prototype URL map | `05-prototype/03-external-prototype-map` | `map external prototype URLs` |
| Document sign-off / review | `06-review/01-document-review` | `review documents` |
| Comment threads | `06-review/02-comment-threads` | `resolve comments` |
| Custom templates | `07-advanced/01-custom-templates` | `set up template pack` |
| Semantic search, editors | `07-advanced/02-search-and-editors` | `find mentions of rate limiting` |
| General onboarding / "where do I start" | `index` → `01-get-started` | `open the course` or setup |

## Section index (quick links)

| Section | Slug prefix | Lessons |
|---------|-------------|---------|
| Get started | `01-get-started` | prerequisites, setup & skills |
| Chat basics | `02-chat-basics` | how chat works, workspace & tasks, incremental changes |
| Graph & sources | `03-graph` | sources & analyze, validate & explore |
| Generate documents | `04-generate` | SRS, basic design |
| Design & prototype | `05-prototype` | translations, build prototype, external URL map |
| Review & changes | `06-review` | quorum document review, comment threads |
| Advanced | `07-advanced` | custom templates, search & editors |

## Agent response template

1. One sentence: what this lesson covers.
2. Link: `http://127.0.0.1:4177/course/<slug>` (run serve first if needed).
3. Three bullet summary from the markdown file.
4. One suggested chat command for the next step.

## Learning vs doing

- **Learning** ("how does X work?", "show me the course") → this guide + `course serve --open`.
- **Doing** ("setup project", "generate SRS") → task skill, not the course server.

When both apply (new user says "get started"), open the **Get started** lesson **and** offer to run `ai-spector-setup`.
