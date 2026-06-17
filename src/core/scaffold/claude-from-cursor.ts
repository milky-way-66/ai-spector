import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { scaffoldClaudeBundleRoot, scaffoldCursorBundleRoot } from "../config/load.js";
import { pathExists } from "../util/fs.js";

/** Rewrite Cursor-specific paths for Claude Code scaffold. */
export function transformCursorPaths(text: string): string {
  return text
    .replace(/\.cursor\//g, ".claude/")
    .replace(/\bSKILL\.md\b/g, "skill.md")
    .replace(/ai-spector-routing\.mdc/g, "_skill-router.md")
    .replace(/\[_skill-router\.md\]\(\.\.\/\.\.\/_skill-router\.md\)/g, "[_skill-router.md](./_skill-router.md)")
    .replace(/\[(\.\.\/)+WORKFLOW\.md\]\(\.\.\/WORKFLOW\.md\)/g, "[WORKFLOW.md](../WORKFLOW.md)")
    .replace(/\[(\.\.\/)+rules\//g, "[../.claude/rules/");
}

const CLAUDE_ROUTING_OVERRIDE = `## Workflow triggers (override)

When the user says \`workflow: <name>\` (e.g. \`workflow: generate-detail-design\`, \`workflow: resolve-task\`, \`workflow: review\`), read \`.claude/workflows/<name>.md\` and activate the skill named there. **Do not** re-route via natural-language priority below.

`;

const CLAUDE_WORKFLOW_OVERRIDE_SECTION = `### When routing picks the wrong workflow

Say a **workflow trigger** — it **overrides** skill matching for that turn. See [.claude/workflows/README.md](./.claude/workflows/README.md).

| Wrong route? | Say |
|--------------|-----|
| "generate detail design" → resolve-task | \`workflow: generate-detail-design\` |
| incremental add → generate | \`workflow: resolve-task\` |
| document sign-off → task approve | \`workflow: review\` |
| resume stuck task | \`workflow: task\` |

`;

/** Full transform for files copied into scaffold/claude/ (skills, rules, workflows, WORKFLOW). */
export function transformForClaudeBundle(text: string): string {
  const protectedCommands = text.replace(/\.cursor\/commands\//g, "__COMMANDS__");
  let out = transformCursorPaths(protectedCommands).replace(/__COMMANDS__/g, ".claude/workflows/");
  out = out.replace(/\.\/commands\//g, "./.claude/workflows/");
  out = out.replace(
    /### When routing picks the wrong workflow[\s\S]*?(?=\n## )/,
    CLAUDE_WORKFLOW_OVERRIDE_SECTION,
  );
  out = out.replace(
    /## Slash commands \(override\)[\s\S]*?(?=\n## )/,
    CLAUDE_ROUTING_OVERRIDE,
  );
  out = out.replace(
    /Enable all skills under `\.claude\/skills\/` \(see \[skills\/README\.md\]\(\.\/skills\/README\.md\)\)/,
    "Skills load from `.claude/skills/` (see [.claude/skills/README.md](./.claude/skills/README.md))",
  );
  out = out.replace(/Cursor picks/g, "Claude Code picks");
  out = out.replace(
    /\*\*Routing override:\*\* slash commands in \[(\.\.\/)?commands\/README\.md\]/,
    "**Routing override:** workflow triggers in [../workflows/README.md]",
  );
  out = out.replace(
    /\[cli-failures\]\(\.\/skills\//g,
    "[cli-failures](./.claude/skills/",
  );
  return out;
}

function transformWorkflowDocForClaude(text: string): string {
  let out = transformForClaudeBundle(text)
    .replace(/^# Slash commands/m, "# Workflow triggers")
    .replace(/\*\*Routing override:\*\*/g, "**Workflow trigger:**")
    .replace(/slash command/gi, "workflow trigger")
    .replace(/`\/([a-z][a-z0-9-]*)`/g, "`workflow: $1`")
    .replace(
      /Natural language usually works[\s\S]*?`sync-claude`\./,
      "Natural language usually works — Claude Code matches skill `description` and [_skill-router.md](../skills/_skill-router.md).\n\nWhen routing picks the **wrong workflow**, say `workflow: <name>`. **The trigger wins** over skill matching for that turn.",
    )
    .replace(/\| Command \| Skill \|/g, "| Say | Skill |")
    .replace(
      /Pipeline overview: \[WORKFLOW\.md\]\(\.\.\/WORKFLOW\.md\)/,
      "Pipeline overview: [WORKFLOW.md](../../WORKFLOW.md)",
    );
  return out;
}

/** Strip Cursor-only `paths:` frontmatter block from skill files. */
export function stripPathsFrontmatter(content: string): string {
  if (!content.startsWith("---\n")) {
    return content;
  }
  const end = content.indexOf("\n---\n", 4);
  if (end === -1) {
    return content;
  }
  const frontmatter = content.slice(4, end);
  const body = content.slice(end + 5);
  const cleaned = frontmatter.replace(/\npaths:\n(?:  - .+(?:\n|$))+/m, "").trimEnd();
  return `---\n${cleaned}\n---\n${body}`;
}

export function cursorSkillToClaudeSkill(content: string): string {
  return transformCursorPaths(stripPathsFrontmatter(content));
}

function stripMdcFrontmatter(content: string): string {
  if (!content.startsWith("---\n")) {
    return content;
  }
  const end = content.indexOf("\n---\n", 4);
  if (end === -1) {
    return content;
  }
  return content.slice(end + 5).trimStart();
}

async function writeTransformed(path: string, content: string): Promise<void> {
  await mkdir(join(path, ".."), { recursive: true });
  await writeFile(path, transformForClaudeBundle(content), "utf8");
}

async function copyMarkdownTree(srcDir: string, destDir: string): Promise<void> {
  if (!(await pathExists(srcDir))) {
    return;
  }
  const entries = await readdir(srcDir, { withFileTypes: true });
  await mkdir(destDir, { recursive: true });
  for (const ent of entries) {
    const srcPath = join(srcDir, ent.name);
    const destPath = join(destDir, ent.name);
    if (ent.isDirectory()) {
      await copyMarkdownTree(srcPath, destPath);
      continue;
    }
    if (!ent.isFile() || !ent.name.endsWith(".md")) {
      continue;
    }
    const raw = await readFile(srcPath, "utf8");
    await writeFile(destPath, transformForClaudeBundle(raw), "utf8");
  }
}

async function copyRuleFiles(cursorRoot: string, claudeRoot: string): Promise<void> {
  const rulesSrc = join(cursorRoot, "rules");
  const rulesDest = join(claudeRoot, ".claude", "rules");
  if (!(await pathExists(rulesSrc))) {
    return;
  }
  const entries = await readdir(rulesSrc, { withFileTypes: true });
  await mkdir(rulesDest, { recursive: true });
  for (const ent of entries) {
    if (!ent.isFile() || !ent.name.endsWith(".mdc")) {
      continue;
    }
    const raw = await readFile(join(rulesSrc, ent.name), "utf8");
    await writeFile(join(rulesDest, ent.name), transformForClaudeBundle(raw), "utf8");
  }
}

async function buildSkill(cursorSkillsRoot: string, claudeSkillsRoot: string, name: string): Promise<void> {
  const srcDir = join(cursorSkillsRoot, name);
  const destDir = join(claudeSkillsRoot, name);
  const skillSrc = join(srcDir, "SKILL.md");
  if (!(await pathExists(skillSrc))) {
    return;
  }
  const raw = await readFile(skillSrc, "utf8");
  await mkdir(destDir, { recursive: true });
  await writeFile(join(destDir, "skill.md"), cursorSkillToClaudeSkill(raw), "utf8");
  await copyMarkdownTree(join(srcDir, "references"), join(destDir, "references"));
}

async function buildSkillsReadme(cursorSkillsRoot: string, claudeSkillsRoot: string): Promise<void> {
  const src = join(cursorSkillsRoot, "README.md");
  if (!(await pathExists(src))) {
    return;
  }
  const raw = await readFile(src, "utf8");
  await writeTransformed(join(claudeSkillsRoot, "README.md"), raw);
}

async function buildRouter(cursorSkillsRoot: string, claudeSkillsRoot: string): Promise<void> {
  const src = join(cursorSkillsRoot, "_skill-router.md");
  if (!(await pathExists(src))) {
    return;
  }
  const raw = await readFile(src, "utf8");
  await writeTransformed(join(claudeSkillsRoot, "_skill-router.md"), raw);
}

async function buildWorkflowsFromCommands(cursorRoot: string, claudeRoot: string): Promise<void> {
  const commandsSrc = join(cursorRoot, "commands");
  const workflowsDest = join(claudeRoot, ".claude", "workflows");
  if (!(await pathExists(commandsSrc))) {
    return;
  }
  const entries = await readdir(commandsSrc, { withFileTypes: true });
  await mkdir(workflowsDest, { recursive: true });
  for (const ent of entries) {
    if (!ent.isFile() || !ent.name.endsWith(".md")) {
      continue;
    }
    const raw = await readFile(join(commandsSrc, ent.name), "utf8");
    await writeFile(join(workflowsDest, ent.name), transformWorkflowDocForClaude(raw), "utf8");
  }
}

async function buildWorkflow(cursorRoot: string, claudeRoot: string): Promise<void> {
  const src = join(cursorRoot, "WORKFLOW.md");
  if (!(await pathExists(src))) {
    return;
  }
  const raw = await readFile(src, "utf8");
  await writeFile(join(claudeRoot, "WORKFLOW.md"), transformForClaudeBundle(raw), "utf8");
}

async function readRule(name: string): Promise<string> {
  const path = join(scaffoldCursorBundleRoot(), "rules", name);
  if (!(await pathExists(path))) {
    return "";
  }
  const raw = await readFile(path, "utf8");
  return stripMdcFrontmatter(raw);
}

async function buildClaudeMd(claudeRoot: string): Promise<void> {
  const routing = await readRule("ai-spector-routing.mdc");
  const planGate = await readRule("ai-spector-plan-gate.mdc");
  const afterDocEdit = await readRule("ai-spector-after-doc-edit.mdc");
  const cliRule = await readRule("ai-spector-cli.mdc");

  const body = `# AI Spector — Claude Agent Rules

You are working in an **AI Spector** managed project. The agent workflow is: read skills, call **MCP tools** (preferred) or \`npx ai-spector\` CLI (fallback), report results. You do not write doc content from scratch — MCP tools / CLI + skills do the work.

Skills load automatically from \`.claude/skills/\` (see [.claude/skills/README.md](./.claude/skills/README.md)). User guide: [WORKFLOW.md](./WORKFLOW.md). Workflow triggers: [.claude/workflows/README.md](./.claude/workflows/README.md). Full router: [.claude/skills/_skill-router.md](./.claude/skills/_skill-router.md). Rules: [.claude/rules/](./.claude/rules/).

## CLI invocation

${cliRule || "Always run the CLI as `npx ai-spector …`, not bare `ai-spector`."}

## Mandatory Rules

### 1. MCP first, CLI fallback

When the \`ai-spector\` MCP server is available, **call the MCP tool** instead of shelling out to \`npx ai-spector\`.

| Operation | MCP tool | CLI fallback |
|-----------|----------|--------------|
| Re-index project | \`index({})\` | \`npx ai-spector index\` |
| Merge knowledge → graph | \`graph_merge({ fromKnowledge: true })\` | \`npx ai-spector graph merge --from-knowledge\` |
| Validate graph | \`graph_validate({})\` | \`npx ai-spector graph validate\` |
| Impact analysis | \`graph_impact({ originId, change })\` | \`npx ai-spector graph impact …\` |
| Walk graph from node | \`graph_query({ id })\` | \`npx ai-spector graph query <id> --json\` |
| **Analyze data-source** | *(agent step — read \`docs/data-source/\`, write \`analysis/knowledge.json\`, then \`index({})\`)* | — |

### 2. Refresh index before any staleness check

Before checking translation status, pending queue, or "what's outdated":

\`\`\`
index({})                    # MCP preferred
npx ai-spector index         # CLI fallback
\`\`\`

Then read the queue. **Never read \`.ai-spector/.docflow/translation-queue/pending.json\` without running index first** — the queue is only accurate after indexing.

### 3. Check impact and refresh embeddings after any doc edit

After editing any file under \`docs/srs/\`, \`docs/basic-design/\`, or \`docs/detail-design/\`:

**a) Impact:**
\`\`\`
graph_impact({ git: true, change: "content_change" })   # MCP preferred
npx ai-spector graph impact --git --change content_change --json  # CLI fallback
\`\`\`

**b) Re-index + embeddings (mandatory when CocoIndex is configured):**
\`\`\`
index({ cocoindexSync: true })    # preferred — refreshes graph + embeddings in one call
\`\`\`

Skip impact/index only when the user explicitly says it was a typo-only fix with no traceability concern. **Never skip \`cocoindexSync\` when CocoIndex is configured** — semantic search goes stale silently.

### 4. Use MCP/graph — not file search

| Need | MCP (preferred) | CLI fallback |
|------|-----------------|--------------|
| Prepare graph scaffold | \`index({})\` | \`npx ai-spector index\` |
| Check knowledge.json before merge | \`knowledge_status({})\` · \`knowledge_validate({})\` | *(no CLI)* |
| Merge knowledge → graph | \`graph_merge({ fromKnowledge: true })\` | \`npx ai-spector graph merge --from-knowledge\` |
| Find what needs regeneration | \`graph_impact({ git: true, change: "content_change" })\` | \`npx ai-spector graph impact --git --json\` |
| Find node by exact ID | \`graph_query({ seedId: "…" })\` | \`npx ai-spector graph query <id> --json\` |
| Find node by concept | \`graph_query_fuzzy({ query: "…" })\` — requires CocoIndex | — |
| Search docs by meaning | \`docs_search({ query: "…" })\` — requires CocoIndex | — |
| Check graph health | \`graph_validate({})\` · \`graph_report({})\` | \`npx ai-spector graph validate\` |
| Translation queue | \`lang_queue({})\` | \`npx ai-spector lang queue pending --json\` (after index) |
| CocoIndex readiness | \`cocoindex_status({})\` | \`npx ai-spector setup --check\` |
| Rebuild embeddings | \`cocoindex_index({})\` or \`index({ cocoindexSync: true })\` | \`npx ai-spector cocoindex index\` |
| Route ambiguous intent | \`workflow_route({ message })\` | follow \`_skill-router.md\` |

**Only fall back to \`grep\` or \`Read\` when the tool returns no results or you need raw file content for editing.**

## Routing

${routing}

### Workflow triggers (Claude Code)

When routing is wrong, the user can say \`workflow: <name>\` (e.g. \`workflow: generate-detail-design\`). Read \`.claude/workflows/<name>.md\` and follow it — same content as Cursor slash commands.

## Plan approval gate

${planGate}

## After doc edits

${afterDocEdit}

## Skill → task mapping

| You want to… | Skill |
|-------------|-------|
| Analyze data source / build graph | \`ai-spector-graph\` |
| Check impact of changes | \`ai-spector-graph\` |
| Semantic search / fuzzy graph lookup | \`ai-spector-search\` |
| Import / set up custom template pack | \`ai-spector-template-import\` |
| Generate documents (check active packs first) | \`ai-spector-generate\` |
| HTML prototype | \`ai-spector-generate-prototype\` |
| Translation status | \`ai-spector-lang-status\` |
| Resolve translations | \`ai-spector-resolve-translation\` |
| Resolve comments | \`ai-spector-resolve-comments\` |
| **Review / approve documents** | \`ai-spector-review\` |
| Resume / active tasks / pause task | \`ai-spector-task\` |
| Add/update feature or section ("I want to add…") | \`ai-spector-resolve-task\` |
| Generate SRS / basic design (full chapter) | \`ai-spector-generate-srs\` / \`ai-spector-generate-basic-design\` |
| Check workspace / clarifications | \`ai-spector-check\` |
| Setup / bootstrap project | \`ai-spector-setup\` |
| Learn / open course | \`ai-spector-course\` |

## Quick reference — MCP tools

| Tool | Purpose |
|------|---------|
| \`workflow_route({ message })\` | Route ambiguous intent to the correct skill |
| \`knowledge_status({})\` | Check knowledge.json entity counts |
| \`knowledge_validate({})\` | Validate knowledge.json schema |
| \`graph_merge({ fromKnowledge: true })\` | Merge knowledge.json into graph |
| \`graph_validate({})\` | Check graph integrity |
| \`graph_report({})\` | Graph layer health audit |
| \`graph_impact({ git: true, change: "…" })\` | Impact of current git diff |
| \`graph_query({ seedId: "…" })\` | Walk graph from a node |
| \`index({})\` | Full index pipeline |
| \`index({ cocoindexSync: true })\` | Refresh graph + translation queue + embeddings |
| \`lang_queue({})\` | Translation queue status |
| \`cocoindex_status({})\` | CocoIndex readiness check |
| \`cocoindex_index({})\` | Rebuild semantic embeddings |
| \`docs_search({ query })\` | Semantic doc search (CocoIndex) |
| \`graph_query_fuzzy({ query })\` | Natural language graph lookup (CocoIndex) |
| \`resolve_task({ taskId })\` | Execute approved resolve plan |
| \`task_create\` / \`task_list\` / \`task_get\` / \`task_update\` / \`task_approve_plan\` | Workflow task state |
| \`task_pause\` / \`task_resume\` / \`task_record_wave\` / \`task_complete\` | Pause, resume, record generate wave, finish |
| \`workspace_check({ fix? })\` | Structural workspace check |
| \`context_list\` / \`context_record\` / \`context_resolve\` | Clarification store |
| \`spec_list\` / \`spec_record\` / \`spec_approve\` / \`spec_reject\` | Extracted-spec review queue |
| \`review_begin\` / \`review_check\` / \`review_queue\` / \`review_status\` | Document review workflow (votes + quorum in status) |
| \`review_session_ack_review\` | Ack review summary written (unlocks approve gate) |
| \`review_approve\` / \`review_decline\` / \`review_close\` / \`review_reject\` | Cast approve/decline vote, close without quorum, or dismiss re-review |
| \`review_list\` | List all docs with review status |

### CLI (fallback)

\`\`\`bash
npx ai-spector index
npx ai-spector graph validate
npx ai-spector graph impact --git --json
npx ai-spector lang queue pending --json
npx ai-spector setup --check
npx ai-spector sync-claude          # refresh Claude skills after package upgrade
npx ai-spector resolve-task plan.json
\`\`\`

On MCP tool or CLI failure: show the output, offer fix / workaround / pause. Do not invent results.

## Pipeline order

\`\`\`
index → analyze (if needed) → generate SRS (gated) → index → spec review
  → generate basic design (gated) → index → detail design → prototype
\`\`\`

### Gated generation (mandatory for every generate run)

\`\`\`
1. CHECK     workspace_check({}) — stop on errors
2. CLARIFY   resolve ALL missing info
3. BRIEFING  sources, graph nodes, Q-xxx answers → user confirms
4. PLAN      plan table → explicit "yes" before any write
5. GENERATE  DAG waves
6. EXTRACT   key specs → spec_record → human review queue
\`\`\`

No auto-confirm: generation never starts while a clarification gap is unanswered and never before the user approves the plan.
`;

  await writeFile(join(claudeRoot, "CLAUDE.md"), body, "utf8");
}

export interface BuildClaudeScaffoldOptions {
  cursorRoot?: string;
  claudeRoot?: string;
}

export interface BuildClaudeScaffoldResult {
  cursorRoot: string;
  claudeRoot: string;
  skillCount: number;
}

/** Regenerate scaffold/claude/ from scaffold/cursor/ (single source of truth). */
export async function buildClaudeScaffoldFromCursor(
  opts: BuildClaudeScaffoldOptions = {},
): Promise<BuildClaudeScaffoldResult> {
  const cursorRoot = opts.cursorRoot ?? scaffoldCursorBundleRoot();
  const claudeRoot = opts.claudeRoot ?? scaffoldClaudeBundleRoot();
  const cursorSkillsRoot = join(cursorRoot, "skills");
  const claudeSkillsRoot = join(claudeRoot, ".claude", "skills");

  if (await pathExists(claudeSkillsRoot)) {
    await rm(claudeSkillsRoot, { recursive: true, force: true });
  }
  await mkdir(claudeSkillsRoot, { recursive: true });

  const entries = await readdir(cursorSkillsRoot, { withFileTypes: true });
  let skillCount = 0;
  for (const ent of entries) {
    if (!ent.isDirectory()) {
      continue;
    }
    await buildSkill(cursorSkillsRoot, claudeSkillsRoot, ent.name);
    skillCount += 1;
  }

  await buildRouter(cursorSkillsRoot, claudeSkillsRoot);
  await buildSkillsReadme(cursorSkillsRoot, claudeSkillsRoot);
  await buildWorkflowsFromCommands(cursorRoot, claudeRoot);
  await buildWorkflow(cursorRoot, claudeRoot);
  await copyRuleFiles(cursorRoot, claudeRoot);
  await buildClaudeMd(claudeRoot);

  return { cursorRoot, claudeRoot, skillCount };
}
