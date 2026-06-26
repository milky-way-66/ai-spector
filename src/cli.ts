#!/usr/bin/env node
import { Command } from "commander";
import { resolve } from "node:path";
import { createRequire } from "node:module";
import { writeJson, readJson } from "./core/util/fs.js";
import { resolveProjectPaths } from "./core/util/paths.js";
import { buildSectionRegistry } from "./core/registry/build.js";
import { bootstrapFromRegistry } from "./core/operations/bootstrap.js";
import { applyPrimaryLanguageOutputs } from "./core/graph/translation.js";
import { loadDocflowConfig } from "./core/config/load.js";
import { validateGraph, formatIssues } from "./core/operations/validate.js";
import { runInit, type AgentTarget } from "./core/operations/init.js";
import { runDocopsInit, runDocopsMigrate, runDocopsStatus } from "./core/operations/docops.js";
import { runLangAdd, runLangSetClient, runLangSetInternal } from "./core/operations/lang.js";
import {
  runLangQueueFailed,
  runLangQueueFail,
  runLangQueuePending,
  runLangQueueResolved,
  runLangQueueRetry,
  runLangQueueScan,
} from "./core/operations/lang-queue.js";
import { formatPendingTable, formatResolvedTable, formatFailedTable } from "./core/lang/queue.js";
import { runHooksInstall, runHooksPreCommit, formatPreCommitReport } from "./core/operations/hooks.js";
import { runSetup, runSetupCheck } from "./core/operations/setup.js";
import { runCheck } from "./core/operations/check.js";
import { formatCheck } from "./interfaces/cli/format/check.js";
import {
  runContextList,
  runContextRecord,
  runContextResolve,
  type ContextEntrySource,
  type ContextEntryStatus,
} from "./core/operations/context.js";
import {
  formatContextList,
  formatContextRecord,
  formatContextResolve,
} from "./interfaces/cli/format/context.js";
import {
  runSpecList,
  runSpecApprove,
  runSpecReject,
  type SpecStatus,
} from "./core/operations/extracted.js";
import {
  formatSpecList,
  formatSpecApprove,
  formatSpecReject,
} from "./interfaces/cli/format/extracted.js";
import { registerWorkCommands, registerTaskCommands } from "./core/operations/work.js";
import { buildClaudeScaffoldFromCursor } from "./core/scaffold/claude-from-cursor.js";
import { runSyncClaude } from "./core/operations/sync-claude.js";
import { runSyncCursor } from "./core/operations/sync-cursor.js";
import { runGraphQuery } from "./core/operations/graph-query.js";
import { runGraphImpact } from "./core/operations/graph-impact.js";
import { runGraphMerge } from "./core/operations/graph-merge.js";
import { runGraphReport } from "./core/operations/graph-report.js";
import {
  formatGraphQuery,
  formatGraphReport,
  formatGraphMerge,
  formatGraphVisualize,
  formatGraphImpact,
} from "./interfaces/cli/format/graph.js";
import { formatIndexReport } from "./interfaces/cli/format/index-cmd.js";
import {
  formatCommentsList,
  formatCommentsInbox,
  formatCommentsPlan,
  formatCommentsShow,
  formatCommentsResolve,
  formatCommentsFacets,
  formatCommentsBatchPlan,
  formatCommentsBatchResolve,
} from "./interfaces/cli/format/comments.js";
import {
  formatSyncClaude,
  formatSyncCursor,
  formatHooksInstall,
  formatSetupAudit,
  formatLangAdd,
  formatLangSetClient,
  formatLangSetInternal,
  formatQueueScan,
  formatResolveTask,
} from "./interfaces/cli/format/misc.js";
import { ensureHubBundles } from "./core/graph/bundles.js";
import { loadInMemoryGraph } from "./core/graph/loadGraph.js";
import { runGraphVisualize } from "./core/operations/graph-visualize.js";
import { runIndex } from "./core/operations/index.js";
import {
  runCommentsBatchPlan,
  runCommentsBatchResolve,
  runCommentsFacets,
  runCommentsInbox,
  runCommentsList,
  runCommentsPlan,
  runCommentsResolve,
  runCommentsShow,
  type CommentFilterOptions,
} from "./core/operations/comments.js";
import { runProvenanceLink } from "./core/graph/provenance.js";
import {
  runApprove,
  runDecline,
  runClose,
  runReviewStatus,
  runReviewQueue,
  runReviewCheck,
  runReviewBegin,
  runReviewReject,
  runReviewList,
  runReviewMigrate,
  runReviewSessionStart,
  runReviewSessionAckReview,
  runWithdraw,
  runReopen,
  runReviewConfig,
} from "./core/operations/review.js";
import {
  formatApproveResult,
  formatDeclineResult,
  formatCloseResult,
  formatWithdrawResult,
  formatReopenResult,
  formatReviewConfig,
  formatReviewStatus,
  formatReviewQueue,
  formatReviewCheck,
  formatReviewBegin,
  formatReviewReject,
  formatReviewList,
  formatReviewMigrate,
  formatReviewSessionStart,
  formatReviewSessionAckReview,
} from "./interfaces/cli/format/reviews.js";
import { registerTemplateCommand } from "./core/operations/template.js";
import { registerReadinessCommand } from "./core/operations/readiness.js";
import { registerAdoptCommand } from "./core/operations/adopt.js";
import { registerUpgradeCommand } from "./core/operations/upgrade.js";
import { runCocoindexSetup, runCocoindexSearch, runGraphQueryFuzzy } from "./core/operations/cocoindex.js";
import {
  formatCocoindexSetup,
  formatCocoindexSearch,
  formatCocoindexStats,
  formatGraphQueryFuzzy,
} from "./interfaces/cli/format/cocoindex.js";
import {
  runPrototypeInstallPreviews,
  runPrototypeManifest,
  runPrototypeMap,
  runPrototypePreview,
  runPrototypeSetup,
  runPrototypeStack,
  runPrototypeSync,
  runPrototypeThemes,
  runPrototypeValidate,
  runPrototypeAuth,
} from "./core/operations/prototype.js";
import { runCourseServe, formatCourseServeStarted } from "./core/operations/course.js";
import { runSyncSnapshot } from "./core/sync/snapshot.js";
import { runSyncAudit, SyncAuditError } from "./core/sync/audit.js";
import type { SectionRegistry } from "./types.js";

const program = new Command();
const require = createRequire(import.meta.url);
const packageJson = require("../package.json") as { version: string };

program
  .name("ai-spector")
  .description(
    "AI Spector — init project, index, traceability graph, templates, Cursor workflow",
  )
  .version(packageJson.version)
  .option("-r, --root <path>", "Project root (auto-detect via .ai-spector/docflow.config.json)");

program
  .command("version")
  .description("Print ai-spector version")
  .action(() => {
    console.log(packageJson.version);
  });

function projectRootOpt(cmd: Command): string | undefined {
  return (cmd.optsWithGlobals() as { root?: string }).root;
}

async function getPaths(cmd: Command) {
  return resolveProjectPaths(projectRootOpt(cmd));
}

program
  .command("init")
  .description("Interactive wizard: scaffold .ai-spector, agent rules/skills, and docs layout")
  .option("-f, --force", "Overwrite existing scaffold files")
  .option("-y, --yes", "Non-interactive: skip prompts, use defaults or provided flags")
  .option("-C, --cwd <path>", "Target directory", process.cwd())
  .option("-l, --languages <codes>", "Comma-separated language codes (e.g. en,jp,vi)")
  .option("--client-language <code>", "Client-preferred language for document review (must be in --languages)")
  .option("--internal-language <code>", "Internal team language for document review (must be in --languages)")
  .option("--target <agent>", "cursor | claude | both — skip the editor prompt")
  .action(async (opts) => {
    const langCodes = opts.languages
      ? (opts.languages as string).split(",").map((c: string) => c.trim()).filter(Boolean)
      : [];
    const target = opts.target as AgentTarget | undefined;
    await runInit({
      targetDir: resolve(opts.cwd ?? process.cwd()),
      force: opts.force,
      yes: opts.yes,
      languages: langCodes,
      clientLanguage: opts.clientLanguage as string | undefined,
      internalLanguage: opts.internalLanguage as string | undefined,
      target,
    });
  });

program
  .command("setup")
  .description("Guided project setup (or audit with --check)")
  .option("-C, --cwd <path>", "Project root", process.cwd())
  .option("--check", "Audit only — do not change files")
  .option("-l, --languages <codes>", "Comma-separated language codes (e.g. en,jp,vi)")
  .option("-y, --yes", "Non-interactive; use defaults or provided flags")
  .option("-f, --force", "Re-run init (overwrite scaffold)")
  .option("--install-dep", "Run npm install -D ai-spector when package.json exists")
  .option("--json", "JSON output")
  .action(async (opts) => {
    const root = resolve(opts.cwd ?? process.cwd());
    if (opts.check) {
      const audit = await runSetupCheck({ root });
      if (opts.json) console.log(JSON.stringify(audit, null, 2));
      else console.log(formatSetupAudit(audit));
      return;
    }
    const languages = opts.languages
      ? (opts.languages as string).split(",").map((c: string) => c.trim()).filter(Boolean)
      : undefined;
    const audit = await runSetup({
      root,
      languages,
      yes: opts.yes,
      force: opts.force,
      installDep: opts.installDep,
    });
    if (opts.json) console.log(JSON.stringify(audit, null, 2));
    else { console.log(formatSetupAudit(audit, true)); }
  });

program
  .command("check")
  .description("Validate workspace structure & config (warns on drift; non-zero exit on errors)")
  .option("-C, --cwd <path>", "Project root", process.cwd())
  .option("--fix", "Auto-create missing directories where possible")
  .option(
    "-p, --path <paths...>",
    "Validate specific doc output path(s) after writing (repeatable)",
  )
  .option("--workflow <stepId>", "Evaluate workflow.dependencies prerequisites (e.g. generate-srs)")
  .option(
    "--source-mode <mode>",
    "forward or derive-downstream (with --workflow)",
  )
  .option("--json", "JSON output")
  .action(async (opts) => {
    const root = resolve(opts.cwd ?? process.cwd());
    const paths = opts.path as string[] | undefined;
    const sourceMode =
      opts.sourceMode === "derive-downstream" ? "derive-downstream" : opts.sourceMode === "forward" ? "forward" : undefined;
    const result = await runCheck({
      root,
      fix: opts.fix,
      paths,
      workflow: opts.workflow,
      sourceMode,
    });
    if (opts.json) console.log(JSON.stringify(result, null, 2));
    else console.log(formatCheck(result));
    if (!result.ok) process.exitCode = 1;
  });

const context = program
  .command("context")
  .description("Clarification context store (questions answered before generation)");

context
  .command("list")
  .description("List context entries, optionally filtered by doc type / status")
  .option("-C, --cwd <path>", "Project root", process.cwd())
  .option("-t, --doc-type <type>", "Doc type store (e.g. srs)")
  .option("-s, --status <status>", "Filter: open | answered | stale")
  .option("--json", "JSON output")
  .action(async (opts) => {
    const result = await runContextList({
      root: resolve(opts.cwd ?? process.cwd()),
      docType: opts.docType,
      status: opts.status as ContextEntryStatus | undefined,
    });
    if (opts.json) console.log(JSON.stringify(result, null, 2));
    else console.log(formatContextList(result));
  });

context
  .command("record <docType> <question>")
  .description("Record a clarifying question (pass --answer to record it answered)")
  .option("-C, --cwd <path>", "Project root", process.cwd())
  .option("-a, --answer <answer>", "Answer (records entry as answered)")
  .option("--scope <scope>", "DAG node / section this informs (e.g. srs.use-cases)")
  .option("--source <source>", "user | inferred | data-source", "user")
  .option("--refs <paths>", "Comma-separated source files that make this stale on change")
  .option("--by <email>", "Answerer email override (default: git user.email)")
  .option("--username <name>", "Answerer name override (default: git user.name)")
  .option("--role <role>", "Actor role: user | client (default: user)")
  .option("--json", "JSON output")
  .action(async (docType, question, opts) => {
    const result = await runContextRecord({
      root: resolve(opts.cwd ?? process.cwd()),
      docType,
      question,
      answer: opts.answer,
      scope: opts.scope,
      source: opts.source as ContextEntrySource,
      sourceRefs: opts.refs
        ? (opts.refs as string).split(",").map((s: string) => s.trim()).filter(Boolean)
        : undefined,
      answeredBy: opts.by,
      answeredByUsername: opts.username,
      role: opts.role,
    });
    if (opts.json) console.log(JSON.stringify(result, null, 2));
    else console.log(formatContextRecord(result));
  });

context
  .command("resolve <docType> <id> <answer>")
  .description("Answer an open/stale entry by id (e.g. Q-001)")
  .option("-C, --cwd <path>", "Project root", process.cwd())
  .option("--by <email>", "Answerer email override (default: git user.email)")
  .option("--username <name>", "Answerer name override (default: git user.name)")
  .option("--role <role>", "Actor role: user | client (default: user)")
  .option("--json", "JSON output")
  .action(async (docType, id, answer, opts) => {
    const result = await runContextResolve({
      root: resolve(opts.cwd ?? process.cwd()),
      docType,
      id,
      answer,
      answeredBy: opts.by,
      answeredByUsername: opts.username,
      role: opts.role,
    });
    if (opts.json) console.log(JSON.stringify(result, null, 2));
    else console.log(formatContextResolve(result));
  });

const spec = program
  .command("spec")
  .description("Extracted-spec review queue (specs pulled from generated docs, approved before graph merge)");

spec
  .command("list")
  .description("List extracted specs, optionally filtered by doc type / status")
  .option("-C, --cwd <path>", "Project root", process.cwd())
  .option("-t, --doc-type <type>", "Doc type queue (e.g. srs)")
  .option("-s, --status <status>", "Filter: pending | approved | rejected")
  .option("--json", "JSON output")
  .action(async (opts) => {
    const result = await runSpecList({
      root: resolve(opts.cwd ?? process.cwd()),
      docType: opts.docType,
      status: opts.status as SpecStatus | undefined,
    });
    if (opts.json) console.log(JSON.stringify(result, null, 2));
    else console.log(formatSpecList(result));
  });

spec
  .command("approve <docType> <id>")
  .description("Approve a pending spec; merges its graph patch (if any) into the graph")
  .option("-C, --cwd <path>", "Project root", process.cwd())
  .option("--by <email>", "Reviewer email override (default: git user.email)")
  .option("--username <name>", "Reviewer name override (default: git user.name)")
  .option("--role <role>", "Actor role: user | client (default: user)")
  .option("--note <note>", "Review note")
  .option("--skip-merge", "Approve without merging the graph patch")
  .option("--json", "JSON output")
  .action(async (docType, id, opts) => {
    const result = await runSpecApprove({
      root: resolve(opts.cwd ?? process.cwd()),
      docType,
      id,
      by: opts.by,
      username: opts.username,
      role: opts.role,
      note: opts.note,
      skipMerge: opts.skipMerge,
    });
    if (opts.json) console.log(JSON.stringify(result, null, 2));
    else console.log(formatSpecApprove(result));
  });

spec
  .command("reject <docType> <id>")
  .description("Reject a pending spec (kept for audit, never merged)")
  .option("-C, --cwd <path>", "Project root", process.cwd())
  .option("--by <email>", "Reviewer email override (default: git user.email)")
  .option("--username <name>", "Reviewer name override (default: git user.name)")
  .option("--role <role>", "Actor role: user | client (default: user)")
  .option("--note <note>", "Why the spec was rejected")
  .option("--json", "JSON output")
  .action(async (docType, id, opts) => {
    const result = await runSpecReject({
      root: resolve(opts.cwd ?? process.cwd()),
      docType,
      id,
      by: opts.by,
      username: opts.username,
      role: opts.role,
      note: opts.note,
    });
    if (opts.json) console.log(JSON.stringify(result, null, 2));
    else console.log(formatSpecReject(result));
  });

registerWorkCommands(program);
registerTaskCommands(program);

const lang = program.command("lang").description("Manage project languages");

lang
  .command("add <code>")
  .description("Add a language to the project (e.g. jp, vi)")
  .option("-C, --cwd <path>", "Project root", process.cwd())
  .option("--label <label>", "Display name for the language")
  .action(async (code: string, opts) => {
    const result = await runLangAdd(code, { root: resolve(opts.cwd ?? process.cwd()), label: opts.label });
    console.log(formatLangAdd(result));
  });

lang
  .command("set-client <code>")
  .description("Set the client-preferred language for document review (must already be configured)")
  .option("-C, --cwd <path>", "Project root", process.cwd())
  .action(async (code: string, opts) => {
    const result = await runLangSetClient(code, { root: resolve(opts.cwd ?? process.cwd()) });
    console.log(formatLangSetClient(result));
  });

lang
  .command("set-internal <code>")
  .description("Set the internal team language for document review (must already be configured)")
  .option("-C, --cwd <path>", "Project root", process.cwd())
  .action(async (code: string, opts) => {
    const result = await runLangSetInternal(code, { root: resolve(opts.cwd ?? process.cwd()) });
    console.log(formatLangSetInternal(result));
  });

const langQueue = lang.command("queue").description("Translation sync job queue");

langQueue
  .command("pending")
  .description("List pending translation sync jobs")
  .option("-C, --cwd <path>", "Project root", process.cwd())
  .option("--lang <code>", "Filter jobs affecting a language")
  .option("--no-enrich", "Skip git diff and graph impact (fast listing)")
  .option("--json", "JSON output")
  .action(async (opts) => {
    const results = await runLangQueuePending({
      root: resolve(opts.cwd ?? process.cwd()),
      lang: opts.lang,
      enrich: opts.enrich,
    });
    if (opts.json) console.log(JSON.stringify(results, null, 2));
    else console.log(formatPendingTable(results.map((r) => r.job)));
  });

langQueue
  .command("resolved")
  .description("List resolved translation sync jobs")
  .option("-C, --cwd <path>", "Project root", process.cwd())
  .option("--limit <n>", "Max entries to show", (v) => parseInt(v, 10))
  .option("--json", "JSON output")
  .action(async (opts) => {
    const jobs = await runLangQueueResolved({ root: resolve(opts.cwd ?? process.cwd()), limit: opts.limit });
    if (opts.json) console.log(JSON.stringify({ jobs }, null, 2));
    else console.log(formatResolvedTable(jobs as Parameters<typeof formatResolvedTable>[0]));
  });

langQueue
  .command("failed")
  .description("List failed translation sync jobs")
  .option("-C, --cwd <path>", "Project root", process.cwd())
  .option("--limit <n>", "Max entries to show", (v) => parseInt(v, 10))
  .option("--json", "JSON output")
  .action(async (opts) => {
    const jobs = await runLangQueueFailed({ root: resolve(opts.cwd ?? process.cwd()), limit: opts.limit });
    if (opts.json) console.log(JSON.stringify({ jobs }, null, 2));
    else console.log(formatFailedTable(jobs as Parameters<typeof formatFailedTable>[0]));
  });

langQueue
  .command("scan")
  .description("Reconcile translation queue without full index")
  .option("-C, --cwd <path>", "Project root", process.cwd())
  .action(async (opts) => {
    const result = await runLangQueueScan({ root: resolve(opts.cwd ?? process.cwd()) });
    console.log(formatQueueScan(result));
  });

langQueue
  .command("fail <jobId>")
  .description("Move a pending job to failed")
  .option("-C, --cwd <path>", "Project root", process.cwd())
  .option("--reason <reason>", "dismissed | sync_error | timeout", "dismissed")
  .option("--message <text>", "Failure message")
  .action(async (jobId: string, opts) => {
    await runLangQueueFail(jobId, {
      root: resolve(opts.cwd ?? process.cwd()),
      reason: opts.reason,
      message: opts.message,
    });
  });

langQueue
  .command("retry <jobId>")
  .description("Move a failed job back to pending")
  .option("-C, --cwd <path>", "Project root", process.cwd())
  .action(async (jobId: string, opts) => {
    await runLangQueueRetry(jobId, { root: resolve(opts.cwd ?? process.cwd()) });
  });

program
  .command("sync-cursor")
  .description("Refresh .cursor/skills and rules from scaffold/cursor/ (no full re-init)")
  .option("-C, --cwd <path>", "Target directory", process.cwd())
  .action(async (opts) => {
    const result = await runSyncCursor({ targetDir: resolve(opts.cwd ?? process.cwd()) });
    console.log(formatSyncCursor(result));
  });

program
  .command("sync-claude")
  .description("Refresh CLAUDE.md and .claude/skills from scaffold/claude/ (no full re-init)")
  .option("-C, --cwd <path>", "Target directory", process.cwd())
  .action(async (opts) => {
    const result = await runSyncClaude({ targetDir: resolve(opts.cwd ?? process.cwd()) });
    console.log(formatSyncClaude(result));
  });

program
  .command("build-claude-scaffold")
  .description("Regenerate scaffold/claude/ from scaffold/cursor/ (maintainers)")
  .action(async () => {
    const result = await buildClaudeScaffoldFromCursor();
    console.log(
      [
        `Built Claude scaffold from ${result.cursorRoot}`,
        `  → ${result.claudeRoot}`,
        `  skills: ${result.skillCount}`,
      ].join("\n"),
    );
  });

const hooks = program.command("hooks").description("Git hooks for local doc workflow checks");

hooks
  .command("install")
  .description("Install pre-commit hook (graph validate, translation queue, impact warnings)")
  .option("-C, --cwd <path>", "Project root", process.cwd())
  .action(async (opts) => {
    const result = await runHooksInstall({ root: resolve(opts.cwd ?? process.cwd()) });
    console.log(formatHooksInstall(result));
  });

hooks
  .command("pre-commit")
  .description("Run pre-commit checks (used by git hook; also runnable manually)")
  .option("-C, --cwd <path>", "Project root", process.cwd())
  .option("--strict", "Treat warnings as errors")
  .option("--skip-impact", "Skip graph impact advisory")
  .option("--skip-queue", "Skip translation queue check")
  .action(async (opts) => {
    const report = await runHooksPreCommit({
      root: resolve(opts.cwd ?? process.cwd()),
      strict: opts.strict,
      skipImpact: opts.skipImpact,
      skipQueue: opts.skipQueue,
    });
    const text = formatPreCommitReport(report);
    if (text) console.log(text);
    if (!report.skipped && report.errors.length > 0) { process.exitCode = 1; return; }
    if (opts.strict && !report.skipped && report.warnings.length > 0) {
      console.error("Strict mode: warnings block commit. Fix warnings or commit with --no-verify.");
      process.exitCode = 1;
    }
  });

program
  .command("index")
  .description(
    "Refresh graph, knowledge merge, and doc indexes from current project files",
  )
  .option("--graph-only", "Only registry + bootstrap + merge + validate (no doc indexes)")
  .option("--docs-only", "Only rebuild .ai-spector/index/*.md and state hashes")
  .option("--skip-docs", "Skip .ai-spector/index document indexes")
  .option("--skip-merge", "Skip merging knowledge.json into graph")
  .option(
    "--skip-doc-semantics",
    "Skip parsing docs/srs and docs/basic-design for UC/F/actor ids into the graph",
  )
  .option("--skip-validate", "Skip graph validate after refresh")
  .option("--cocoindex-sync", "Run CocoIndex pipeline update after indexing (requires Python)")
  .action(async (opts, cmd) => {
    const report = await runIndex({
      root: projectRootOpt(cmd),
      graphOnly: opts.graphOnly,
      docsOnly: opts.docsOnly,
      skipDocs: opts.skipDocs,
      skipMerge: opts.skipMerge,
      skipDocSemantics: opts.skipDocSemantics,
      skipValidate: opts.skipValidate,
      cocoindexSync: opts.cocoindexSync,
    });
    console.log(formatIndexReport(report));
    if (report.failed) {
      process.exitCode = 1;
    }
  });

const syncCmd = program.command("sync").description("Design layer sync baseline and audit");

syncCmd
  .command("snapshot")
  .description("Record sync baseline when SRS, basic-design, and detail-design are aligned")
  .option("--label <text>", "Human label for this baseline")
  .option("--git-ref <ref>", "Git ref to store (default: HEAD)")
  .option("--force", "Overwrite existing baseline")
  .option("--json", "JSON output")
  .action(async (opts, cmd) => {
    const root = projectRootOpt(cmd);
    try {
      const result = await runSyncSnapshot({
        root,
        label: opts.label,
        gitRef: opts.gitRef,
        force: opts.force,
      });
      if (opts.json) {
        process.stdout.write(JSON.stringify(result, null, 2) + "\n");
      } else {
        process.stdout.write(
          `Sync baseline saved: ${result.totals.files} files, graph ${result.graphHash.slice(0, 8)}…, git ${result.gitRef?.slice(0, 7) ?? "none"}\n`,
        );
        for (const w of result.warnings) process.stdout.write(`  warn: ${w}\n`);
      }
    } catch (err) {
      process.stderr.write(err instanceof Error ? err.message : String(err));
      process.stderr.write("\n");
      process.exit(1);
    }
  });

syncCmd
  .command("audit")
  .description("Audit design layers against sync baseline")
  .option("--json", "JSON output")
  .option("--fail-on-drift", "Exit 1 when drift detected (CI)")
  .option("--direction <dir>", "downstream | upstream | both")
  .option("--verify-git-ref", "Warn if HEAD is not descendant of baseline gitRef")
  .action(async (opts, cmd) => {
    const root = projectRootOpt(cmd);
    try {
      const result = await runSyncAudit({
        root,
        direction: opts.direction,
        failOnDrift: opts.failOnDrift,
        verifyGitRef: opts.verifyGitRef,
      });
      if (opts.json) {
        process.stdout.write(JSON.stringify(result, null, 2) + "\n");
      } else {
        process.stdout.write(
          result.drift.hasDrift
            ? `Drift detected (${result.drift.graphChanged ? "graph + files" : "files"})\n`
            : "Aligned with baseline\n",
        );
      }
    } catch (err) {
      if (err instanceof SyncAuditError) {
        if (opts.json) {
          process.stdout.write(JSON.stringify({ error: err.message }, null, 2) + "\n");
        } else {
          process.stderr.write(err.message + "\n");
        }
        process.exit(err.exitCode);
      }
      throw err;
    }
  });

const graph = program.command("graph").description("Traceability graph operations");

graph
  .command("registry")
  .description("Build section-registry.json from bundled SRS templates")
  .action(async (_opts, cmd) => {
    const paths = await getPaths(cmd);
    const registry = await buildSectionRegistry(paths.root);
    await writeJson(paths.registry, registry);
    const total = registry.documents.reduce((n, d) => n + d.sections.length, 0);
    console.log(
      `Wrote ${paths.registry} (${registry.documents.length} documents, ${total} sections)`,
    );
  });

graph
  .command("bootstrap")
  .description("Create structure nodes/edges from section registry")
  .option("-i, --registry <path>", "Registry path")
  .option("-o, --output <path>", "Graph output path")
  .action(async (opts, cmd) => {
    const paths = await getPaths(cmd);
    const registryPath = opts.registry ?? paths.registry;
    const graphPath = opts.output ?? paths.graph;
    const registry = await readJson<SectionRegistry>(registryPath);
    const graph = bootstrapFromRegistry(registry);
    try {
      const { config } = await loadDocflowConfig(paths.root);
      const primary = config.languages[0];
      if (primary) {
        applyPrimaryLanguageOutputs(
          graph,
          primary.code,
          config.languages.map((l) => l.code),
        );
      }
    } catch {
      // uninitialized project — keep manifest paths as-is
    }
    await writeJson(graphPath, graph.toTraceabilityGraph());
    console.log(
      `Wrote ${graphPath} (${graph.nodesById.size} nodes, ${graph.toTraceabilityGraph().edges.length} edges)`,
    );
  });

graph
  .command("query <id>")
  .description("Find relevant subgraph and projection paths (for IDE / generate)")
  .option("-d, --direction <dir>", "out | in | both", "both")
  .option("--depth <n>", "Traversal depth", "2")
  .option(
    "-e, --edges <types>",
    "Comma-separated edge types (default: generate set)",
  )
  .option("--json", "JSON output for agents")
  .action(async (id: string, opts, cmd) => {
    const paths = await getPaths(cmd);
    const result = await runGraphQuery({
      graphPath: paths.graph,
      projectRoot: paths.root,
      seedId: id,
      direction: opts.direction as "out" | "in" | "both",
      depth: Number(opts.depth),
      edges: opts.edges,
    });
    if (opts.json) console.log(JSON.stringify(result, null, 2));
    else console.log(formatGraphQuery(result));
  });

graph
  .command("impact [id]")
  .description(
    "Impact analysis: regenerate / review buckets (id optional with --file / --heading / --git)",
  )
  .option("--file <path>", "Resolve origin from repo-relative doc path")
  .option("--heading <text>", "Resolve section by heading (optionally scoped with --file)")
  .option("--git", "Resolve seeds from current git diff (staged + unstaged) and merge impact")
  .option(
    "--direction <mode>",
    "downstream (default), upstream, or both — upstream populates syncUpstream bucket",
  )
  .option("-o, --output <path>", "Write impact report JSON")
  .option("--json", "Print JSON")
  .action(async (id: string | undefined, opts, cmd) => {
    const paths = await getPaths(cmd);
    if (!id && !opts.file && !opts.heading && !opts.git) {
      console.error(
        "Provide <nodeId>, --file <path>, --heading <text>, or --git to resolve the change origin.",
      );
      process.exitCode = 1;
      return;
    }
    const direction =
      opts.direction === "upstream" || opts.direction === "both"
        ? opts.direction
        : undefined;
    const result = await runGraphImpact({
      graphPath: paths.graph,
      rulesPath: paths.rulesImpact,
      projectRoot: paths.root,
      originId: id,
      file: opts.file,
      heading: opts.heading,
      git: opts.git,
      change: "content_change",
      output: opts.output,
      direction,
    });
    if (opts.json || opts.output) console.log(JSON.stringify(result, null, 2));
    else console.log(formatGraphImpact(result, opts.git));
  });

graph
  .command("merge [file]")
  .description(
    "Merge domain patch or knowledge.json into traceability graph (upsert nodes/edges)",
  )
  .option("--from-knowledge", "Read .ai-spector/.docflow/analysis/knowledge.json")
  .option(
    "--semantic",
    "Merge .ai-spector/.docflow/extract/semantic-links.patch.json (agent meaning edges only)",
  )
  .option(
    "--with-knowledge",
    "Merge knowledge.json first (creates domain nodes), then apply the patch — prevents missing-node errors",
  )
  .option("-g, --graph <path>", "Graph path")
  .option("-o, --write-patch <path>", "Write normalized extract patch before merge")
  .option("--no-validate", "Skip validate after merge")
  .option("--dry-run", "Compute merge stats without saving")
  .action(async (file: string | undefined, opts, cmd) => {
    const paths = await getPaths(cmd);
    const result = await runGraphMerge({
      root: paths.root,
      inputPath: file,
      fromKnowledge: opts.fromKnowledge,
      semantic: opts.semantic,
      withKnowledge: opts.withKnowledge,
      graphPath: opts.graph ?? paths.graph,
      writePatch: opts.writePatch,
      validate: !opts.noValidate,
      dryRun: opts.dryRun,
    });
    console.log(formatGraphMerge(result));
  });

graph
  .command("report")
  .description("Layer health: structure, spec instances, hubs, provenance, semantic links")
  .option("-g, --graph <path>", "Graph path")
  .option("--json", "JSON output for agents")
  .action(async (opts, cmd) => {
    const paths = await getPaths(cmd);
    const result = await runGraphReport({ root: paths.root, graphPath: opts.graph ?? paths.graph });
    if (opts.json) console.log(JSON.stringify(result, null, 2));
    else console.log(formatGraphReport(result));
  });

graph
  .command("ensure-bundles")
  .description("Create bundle.source + source files + bundle.business (idempotent)")
  .option("-g, --graph <path>", "Graph path")
  .action(async (opts, cmd) => {
    const paths = await getPaths(cmd);
    const graph = await loadInMemoryGraph(opts.graph ?? paths.graph);
    const result = await ensureHubBundles(graph, paths.root);
    await writeJson(opts.graph ?? paths.graph, graph.toTraceabilityGraph());
    console.log(
      `Source hub: ${result.sourceFiles} file(s); business hub: ${result.domainMembers} domain member(s)`,
    );
    console.log(`Wrote ${opts.graph ?? paths.graph}`);
  });

graph
  .command("link-sources")
  .description(
    "Add derivedFrom edges from domain nodes to docs/data-source paths",
  )
  .option("-g, --graph <path>", "Graph path")
  .action(async (_opts, cmd) => {
    const paths = await getPaths(cmd);
    const result = await runProvenanceLink({
      projectRoot: paths.root,
      graphPath: _opts.graph ?? paths.graph,
    });
    console.log(result.detail);
    if (!result.merged) {
      process.exitCode = 0;
    }
  });

graph
  .command("visualize")
  .description("Generate HTML report to explore graph and knowledge in a browser")
  .option("-o, --output <path>", "Output HTML path")
  .option("-g, --graph <path>", "Graph JSON path")
  .option("--knowledge <path>", "knowledge.json path")
  .option("--no-knowledge", "Omit knowledge.json from report")
  .option("--open", "Open the HTML file in the default browser")
  .action(async (opts, cmd) => {
    const paths = await getPaths(cmd);
    const result = await runGraphVisualize({
      root: paths.root,
      graphPath: opts.graph ?? paths.graph,
      knowledgePath: opts.knowledge,
      output: opts.output,
      open: opts.open,
      skipKnowledge: opts.noKnowledge,
    });
    console.log(formatGraphVisualize(result));
  });

const comments = program
  .command("comments")
  .description("Git-backed review comment threads under comments/ (local resolve flow)");

function parseCommentTypesOpt(raw: string | undefined): import("./core/comments/types.js").CommentType[] | undefined {
  if (!raw?.trim()) {
    return undefined;
  }
  const allowed = new Set(["document", "prototype"]);
  const types = raw
    .split(",")
    .map((t) => t.trim())
    .filter((t): t is import("./core/comments/types.js").CommentType => allowed.has(t));
  return types.length > 0 ? types : undefined;
}

function commentFilterOpts(opts: {
  file?: string;
  path?: string;
  type?: string;
  status?: string;
  screen?: string;
  branch?: string;
  anchorState?: string;
  group?: string;
}): CommentFilterOptions {
  return {
    filePath: opts.file,
    pathPrefix: opts.path,
    commentTypes: parseCommentTypesOpt(opts.type),
    status: (opts.status as CommentFilterOptions["status"]) ?? "open",
    screen: opts.screen,
    branch: opts.branch,
    anchorState: opts.anchorState as CommentFilterOptions["anchorState"],
    groupByScreen: opts.group === "screen",
  };
}

comments
  .command("facets")
  .description("Available comment filter values and counts")
  .option("--file <path>", "Scope facets to file path filter")
  .option("--path <prefix>", "Scope facets to path prefix")
  .option("--type <types>", "Comma-separated: document, prototype")
  .option("--screen <name>", "Prototype screen filter")
  .option("--branch <name>", "Branch filter")
  .option("--json", "JSON output for agents")
  .action(async (opts, cmd) => {
    const result = await runCommentsFacets({
      root: projectRootOpt(cmd),
      ...commentFilterOpts({ ...opts, status: "all" }),
    });
    if (opts.json) console.log(JSON.stringify(result, null, 2));
    else console.log(formatCommentsFacets(result));
  });

comments
  .command("list")
  .description("List comment threads from comments/{logical_path}/")
  .option("--file <path>", "Filter by logical file path (e.g. srs/01-overview or prototype)")
  .option("--path <prefix>", "Path prefix (e.g. srs/)")
  .option("--type <types>", "Comma-separated comment types: document, prototype")
  .option("--screen <name>", "Prototype screen stem (e.g. login)")
  .option("--branch <name>", "Filter by originBranch")
  .option("--anchor-state <state>", "active | drifted | missing")
  .option("--status <status>", "open | resolved | all", "open")
  .option("--json", "JSON output for agents")
  .action(async (opts, cmd) => {
    const result = await runCommentsList({
      root: projectRootOpt(cmd),
      ...commentFilterOpts(opts),
    });
    if (opts.json) console.log(JSON.stringify(result, null, 2));
    else console.log(formatCommentsList(result));
  });

comments
  .command("inbox")
  .description(
    "Thread pick list for IDE chat (C-001 / B-001) — JSON includes idePresentation.markdown",
  )
  .option("--file <path>", "Filter by logical file path (e.g. prototype)")
  .option("--path <prefix>", "Path prefix")
  .option("--type <types>", "Comma-separated comment types: document, prototype")
  .option("--screen <name>", "Prototype screen stem (e.g. login)")
  .option("--branch <name>", "Filter by originBranch")
  .option("--anchor-state <state>", "active | drifted | missing")
  .option("--group <mode>", "screen — add B-00N batch rows for prototype screens")
  .option("--status <status>", "open | resolved | all", "open")
  .option("--json", "JSON output for agents")
  .action(async (opts, cmd) => {
    const inbox = await runCommentsInbox({
      root: projectRootOpt(cmd),
      ...commentFilterOpts(opts),
    });
    if (opts.json) console.log(JSON.stringify(inbox, null, 2));
    else console.log(formatCommentsInbox(inbox));
  });

comments
  .command("plan [threadId]")
  .description("Resolve plan: anchor excerpt, graph impact, and IDE workflow hints")
  .option("--pick <id>", "Pick id from inbox (e.g. C-001)")
  .option("--file <path>", "Logical file path when thread id alone is ambiguous")
  .option("--json", "JSON output for agents")
  .action(async (threadId: string | undefined, opts, cmd) => {
    const id = opts.pick ?? threadId;
    if (!id) {
      console.error("Provide <threadId> or --pick C-001");
      process.exitCode = 1;
      return;
    }
    const plan = await runCommentsPlan({ root: projectRootOpt(cmd), threadId: id, filePath: opts.file, pick: opts.pick });
    if (opts.json) console.log(JSON.stringify(plan, null, 2));
    else console.log(formatCommentsPlan(plan));
  });

comments
  .command("show <threadId>")
  .description("Show thread metadata, replies, and events")
  .option("--file <path>", "Logical file path when thread id alone is ambiguous")
  .option("--json", "JSON output for agents")
  .action(async (threadId: string, opts, cmd) => {
    const thread = await runCommentsShow({ root: projectRootOpt(cmd), threadId, filePath: opts.file });
    if (opts.json) console.log(JSON.stringify(thread, null, 2));
    else console.log(formatCommentsShow(thread));
  });

comments
  .command("resolve <threadId>")
  .description("Mark thread resolved in meta_data.json and append events.jsonl")
  .requiredOption("--file <path>", "Logical file path (e.g. srs/04-features/auth)")
  .option("--by <email>", "Resolver email override (default: git user.email)")
  .option("--username <name>", "Resolver name override (default: git user.name)")
  .option("--role <role>", "Actor role: user | client (default: user)")
  .option("--commit-sha <sha>", "resolvedInCommitSha (defaults to git HEAD)")
  .option("--expected-version <n>", "Optimistic lock on meta_data.json version")
  .option("--dry-run", "Preview resolve without writing files")
  .option("--json", "JSON output for agents")
  .action(async (threadId: string, opts, cmd) => {
    const result = await runCommentsResolve({
      root: projectRootOpt(cmd),
      threadId,
      filePath: opts.file,
      resolvedBy: opts.by,
      resolvedByUsername: opts.username,
      role: opts.role,
      commitSha: opts.commitSha,
      expectedVersion: opts.expectedVersion != null ? Number(opts.expectedVersion) : undefined,
      dryRun: opts.dryRun,
    });
    if (opts.json) console.log(JSON.stringify(result, null, 2));
    else console.log(formatCommentsResolve(result, threadId));
  });

comments
  .command("batch-plan [token]")
  .description(
    "Batch resolve plan for prototype screen(s): B-001, --screen login, or --picks C-001,C-002,B-002",
  )
  .option("--pick <id>", "Batch id B-001 or comma-separated picks")
  .option("--picks <ids>", "Comma-separated B-00N / C-00N ids")
  .option("--screen <name>", "Prototype screen stem (e.g. login)")
  .option("--phrase <text>", "Natural phrase (e.g. 'login screen')")
  .option("--file <path>", "Filter by logical file path")
  .option("--path <prefix>", "Path prefix")
  .option("--branch <name>", "Branch filter")
  .option("--json", "JSON output for agents")
  .action(async (token: string | undefined, opts, cmd) => {
    const picksRaw = opts.picks ?? opts.pick ?? token;
    const picks = picksRaw
      ? String(picksRaw)
          .split(",")
          .map((p: string) => p.trim())
          .filter(Boolean)
      : undefined;
    const batchId = picks?.length === 1 && /^B-\d{3}$/i.test(picks[0]!) ? picks[0] : undefined;
    const result = await runCommentsBatchPlan({
      root: projectRootOpt(cmd),
      ...commentFilterOpts({ ...opts, type: "prototype" }),
      batchId,
      picks: batchId ? undefined : picks,
      screen: opts.screen,
      phrase: opts.phrase,
      groupByScreen: true,
    });
    if (opts.json) console.log(JSON.stringify(result, null, 2));
    else console.log(formatCommentsBatchPlan(result));
  });

comments
  .command("batch-resolve <picks>")
  .description("Mark multiple threads resolved (B-001 or comma-separated picks)")
  .option("--by <email>", "Resolver email override")
  .option("--username <name>", "Resolver name override")
  .option("--role <role>", "Actor role: user | client")
  .option("--commit-sha <sha>", "resolvedInCommitSha (defaults to git HEAD)")
  .option("--dry-run", "Preview without writing")
  .option("--json", "JSON output for agents")
  .action(async (picksArg: string, opts, cmd) => {
    const picks = picksArg
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean);
    const result = await runCommentsBatchResolve({
      root: projectRootOpt(cmd),
      picks,
      commentTypes: ["prototype"],
      resolvedBy: opts.by,
      resolvedByUsername: opts.username,
      role: opts.role,
      commitSha: opts.commitSha,
      dryRun: opts.dryRun,
    });
    if (opts.json) console.log(JSON.stringify(result, null, 2));
    else console.log(formatCommentsBatchResolve(result));
  });

// ── Review commands ───────────────────────────────────────────────────────────

const review = program
  .command("review")
  .description("Two-track document review: internal approval → client approval");

review
  .command("approve <logicalPath>")
  .description("Cast internal approve vote; moves to client queue when minApprovals is met")
  .option("--by <email>", "Reviewer email override (default: git user.email)")
  .option("--username <name>", "Reviewer name override (default: git user.name)")
  .option("--role <role>", "Actor role: user | client (default: user)")
  .option("--note <note>", "Review note")
  .option("--json", "JSON output for agents")
  .action(async (logicalPath: string, opts, cmd) => {
    const result = await runApprove({
      root: projectRootOpt(cmd),
      logicalPath,
      by: opts.by,
      username: opts.username,
      role: opts.role,
      note: opts.note,
    });
    if (opts.json) console.log(JSON.stringify(result, null, 2));
    else console.log(formatApproveResult(result));
  });

review
  .command("decline <logicalPath>")
  .description("Cast internal decline vote on a document pending review")
  .option("--by <email>", "Reviewer email override (default: git user.email)")
  .option("--username <name>", "Reviewer name override (default: git user.name)")
  .option("--note <note>", "Decline reason")
  .option("--json", "JSON output for agents")
  .action(async (logicalPath: string, opts, cmd) => {
    const result = await runDecline({
      root: projectRootOpt(cmd),
      logicalPath,
      by: opts.by,
      username: opts.username,
      note: opts.note,
    });
    if (opts.json) console.log(JSON.stringify(result, null, 2));
    else console.log(formatDeclineResult(result));
  });

review
  .command("close <logicalPath>")
  .description("Manually close internal review when minApprovals cannot be reached")
  .requiredOption("--reason <text>", "Why the review is closed")
  .option("--by <email>", "Actor email override")
  .option("--username <name>", "Actor name override")
  .option("--json", "JSON output for agents")
  .action(async (logicalPath: string, opts, cmd) => {
    const result = await runClose({
      root: projectRootOpt(cmd),
      logicalPath,
      reason: opts.reason,
      by: opts.by,
      username: opts.username,
    });
    if (opts.json) console.log(JSON.stringify(result, null, 2));
    else console.log(formatCloseResult(result));
  });

review
  .command("withdraw <logicalPath>")
  .description("Withdraw your vote on an open internal review track")
  .option("--by <email>", "Reviewer email override (default: git user.email)")
  .option("--username <name>", "Reviewer name override (default: git user.name)")
  .option("--role <role>", "Actor role: user | client (default: user)")
  .option("--track <track>", "Review track: internal | client (default: internal)")
  .option("--json", "JSON output for agents")
  .action(async (logicalPath: string, opts, cmd) => {
    const result = await runWithdraw({
      root: projectRootOpt(cmd),
      logicalPath,
      by: opts.by,
      username: opts.username,
      role: opts.role,
      track: opts.track,
    });
    if (opts.json) console.log(JSON.stringify(result, null, 2));
    else console.log(formatWithdrawResult(result));
  });

review
  .command("reopen <logicalPath>")
  .description("Reopen a closed internal review track (resets client track when internal)")
  .option("--by <email>", "Reviewer email override (default: git user.email)")
  .option("--username <name>", "Reviewer name override (default: git user.name)")
  .option("--role <role>", "Actor role: user | client (default: user)")
  .option("--track <track>", "Review track: internal | client (default: internal)")
  .option("--json", "JSON output for agents")
  .action(async (logicalPath: string, opts, cmd) => {
    const result = await runReopen({
      root: projectRootOpt(cmd),
      logicalPath,
      by: opts.by,
      username: opts.username,
      role: opts.role,
      track: opts.track,
    });
    if (opts.json) console.log(JSON.stringify(result, null, 2));
    else console.log(formatReopenResult(result));
  });

review
  .command("config")
  .description("Show review queue configuration (minApprovals per track)")
  .option("--json", "JSON output for agents")
  .action(async (opts, cmd) => {
    const result = await runReviewConfig({ root: projectRootOpt(cmd) });
    if (opts.json) console.log(JSON.stringify(result, null, 2));
    else console.log(formatReviewConfig(result));
  });

review
  .command("status <logicalPath>")
  .description("Show review status for a document (both tracks + diff if pending)")
  .option("--no-diff", "Skip diff content")
  .option("--history", "Include approval history")
  .option("--history-limit <n>", "Max history entries to return", parseInt)
  .option("--history-since <iso>", "Only history entries after this ISO timestamp")
  .option("--json", "JSON output for agents")
  .action(async (logicalPath: string, opts, cmd) => {
    const result = await runReviewStatus({
      root: projectRootOpt(cmd),
      logicalPath,
      showDiff: opts.diff !== false,
      includeHistory: opts.history,
      historyLimit: opts.historyLimit,
      historySince: opts.historySince,
    });
    if (opts.json) console.log(JSON.stringify(result, null, 2));
    else console.log(formatReviewStatus(result));
  });

review
  .command("list")
  .description("List all documents with approval records")
  .option("--prefix <prefix>", "Filter by logical path prefix (e.g. srs/)")
  .option(
    "--status <status>",
    "Filter by overall status: pending_internal | pending_client | approved | rejected | all",
  )
  .option("--json", "JSON output for agents")
  .action(async (opts, cmd) => {
    const result = await runReviewList({
      root: projectRootOpt(cmd),
      prefix: opts.prefix,
      status: opts.status,
    });
    if (opts.json) console.log(JSON.stringify(result, null, 2));
    else console.log(formatReviewList(result));
  });

review
  .command("queue")
  .description("List documents pending review across internal and client queues")
  .option("--track <track>", "internal | client | all (default: all)")
  .option("--no-diff", "Skip diff content")
  .option("--no-enrich", "Skip git diff and graph impact (fast listing)")
  .option("--json", "JSON output for agents")
  .action(async (opts, cmd) => {
    const result = await runReviewQueue({
      root: projectRootOpt(cmd),
      track: opts.track as "internal" | "client" | "all" | undefined,
      showDiff: opts.diff !== false,
      enrich: opts.enrich,
    });
    if (opts.json) console.log(JSON.stringify(result, null, 2));
    else console.log(formatReviewQueue(result));
  });

review
  .command("begin [logicalPath]")
  .description("Discover docs on disk, queue never-reviewed files, and start review for one document")
  .option("--no-diff", "Skip diff content when logicalPath is provided")
  .option("--history", "Include approval history when logicalPath is provided")
  .option("--history-limit <n>", "Max history entries to return", parseInt)
  .option("--history-since <iso>", "Only history entries after this ISO timestamp")
  .option("--json", "JSON output for agents")
  .action(async (logicalPath: string | undefined, opts, cmd) => {
    const result = await runReviewBegin({
      root: projectRootOpt(cmd),
      logicalPath: logicalPath || undefined,
      showDiff: opts.diff !== false,
      includeHistory: opts.history,
      historyLimit: opts.historyLimit,
      historySince: opts.historySince,
    });
    if (opts.json) console.log(JSON.stringify(result, null, 2));
    else console.log(formatReviewBegin(result));
  });

review
  .command("check")
  .description("Scan approved documents for content changes and invalidate stale approvals")
  .option("--json", "JSON output for agents")
  .action(async (opts, cmd) => {
    const result = await runReviewCheck({ root: projectRootOpt(cmd) });
    if (opts.json) console.log(JSON.stringify(result, null, 2));
    else console.log(formatReviewCheck(result));
  });

review
  .command("reject <logicalPath>")
  .description("Dismiss document from internal queue without re-approval (trivial changes)")
  .option("--reason <text>", "Why the change does not require re-approval")
  .option("--json", "JSON output for agents")
  .action(async (logicalPath: string, opts, cmd) => {
    const result = await runReviewReject({ root: projectRootOpt(cmd), logicalPath, reason: opts.reason });
    if (opts.json) console.log(JSON.stringify(result, null, 2));
    else console.log(formatReviewReject(result));
  });

review
  .command("migrate")
  .description("Migrate legacy reviews/ directory to .ai-spector/.docflow/review-queue/")
  .option("--json", "JSON output for agents")
  .action(async (opts, cmd) => {
    const result = await runReviewMigrate({ root: projectRootOpt(cmd) });
    if (opts.json) console.log(JSON.stringify(result, null, 2));
    else console.log(formatReviewMigrate(result));
  });

const docops = program.command("docops").description("Writer-owned .docops/ contract helpers");

docops
  .command("status")
  .description("Assess .docops/ layout and Writer readiness")
  .option("--json", "JSON output for agents")
  .action(async (opts, cmd) => {
    const code = await runDocopsStatus({ root: projectRootOpt(cmd), json: opts.json });
    process.exitCode = code;
  });

docops
  .command("init")
  .description("Scaffold Writer-ready .docops/ contract")
  .option("--lang <codes>", "Comma-separated language codes", "en")
  .option("--layers <keys>", "Comma-separated doc type keys (srs,basicDesign,detailDesign)")
  .option("--dry-run", "Print planned actions without writing files")
  .option("--force", "Fill missing files when config already exists")
  .action(async (opts, cmd) => {
    await runDocopsInit({
      root: projectRootOpt(cmd),
      lang: opts.lang,
      layers: opts.layers,
      dryRun: opts.dryRun,
      force: opts.force,
    });
  });

docops
  .command("migrate")
  .description("Migrate legacy ai-spector layout to .docops/ contract")
  .option("--dry-run", "Print planned actions without writing files")
  .option("--repair", "Fill gaps in existing .docops/ without overwriting")
  .option("--templates-only", "Copy templates only")
  .option("--from-docflow", "Split legacy docflow.config.json into docops.config.json + engine.json")
  .action(async (opts, cmd) => {
    await runDocopsMigrate({
      root: projectRootOpt(cmd),
      dryRun: opts.dryRun,
      repair: opts.repair,
      templatesOnly: opts.templatesOnly,
      fromDocflow: opts.fromDocflow,
    });
  });

const reviewSession = review.command("session").description("Persisted review session gate for sign-off");

reviewSession
  .command("start")
  .description("Start or reset the review session (.session.json)")
  .option("--json", "JSON output for agents")
  .action(async (opts, cmd) => {
    const result = await runReviewSessionStart({ root: projectRootOpt(cmd) });
    if (opts.json) console.log(JSON.stringify(result, null, 2));
    else console.log(formatReviewSessionStart(result));
  });

reviewSession
  .command("ack <logicalPath>")
  .description("Acknowledge review summary written — unlocks review approve")
  .option("--json", "JSON output for agents")
  .action(async (logicalPath: string, opts, cmd) => {
    const result = await runReviewSessionAckReview({
      root: projectRootOpt(cmd),
      logicalPath,
    });
    if (opts.json) console.log(JSON.stringify(result, null, 2));
    else console.log(formatReviewSessionAckReview(result));
  });

const prototype = program
  .command("prototype")
  .description("HTML prototype workspace: themes, manifest, validation (static files under prototype/src/)");

prototype
  .command("themes")
  .description("List bundled UI themes from assets/themes/")
  .option("--json", "JSON output")
  .action(async (opts) => {
    await runPrototypeThemes({ json: opts.json });
  });

prototype
  .command("preview")
  .description("Show (and optionally open) a theme preview.html from assets/themes/<name>/")
  .argument("<theme>", "Theme folder name (e.g. stripe, vercel)")
  .option("--open", "Open preview in the default browser")
  .option("--json", "JSON output with file path")
  .action(async (theme: string, opts) => {
    await runPrototypePreview({ theme, open: opts.open, json: opts.json });
  });

prototype
  .command("install-previews")
  .description("Move staged preview HTML files into assets/themes/<name>/preview.html (maintainers)")
  .option("--from <path>", "Staging folder (default: assets/preview/themes/)")
  .option("--dry-run", "List moves without writing")
  .option("--json", "JSON output")
  .action(async (opts) => {
    await runPrototypeInstallPreviews({
      from: opts.from,
      dryRun: opts.dryRun,
      json: opts.json,
    });
  });

prototype
  .command("stack")
  .description(
    "Set the prototype tech stack (html | vue | react | nuxt | next | svelte | angular) and derive buildMode",
  )
  .argument("<stack>", "Tech stack name")
  .action(async (stack: string, _opts, cmd) => {
    await runPrototypeStack({ root: projectRootOpt(cmd), stack });
  });

prototype
  .command("auth")
  .description("Configure HTTP basic auth (credentials in prototype/config.json, .htpasswd under prototype/)")
  .option("--username <name>", "Basic auth username")
  .option("--password <secret>", "Basic auth password")
  .option("--from-config", "Regenerate .htpasswd from stored prototype/config.json basicAuth")
  .action(async (opts, cmd) => {
    await runPrototypeAuth({
      root: projectRootOpt(cmd),
      username: opts.username,
      password: opts.password,
      fromConfig: opts.fromConfig,
    });
  });

prototype
  .command("setup")
  .description("Scaffold prototype/, install theme DESIGN.md, seed manifest when list-screens exists")
  .option("--theme <name>", "Theme folder under assets/themes/ (default: vercel or existing manifest)")
  .option("--no-emit-manifest", "Do not rebuild manifest from list-screens.md")
  .option("--force-design", "Overwrite prototype/DESIGN.md from theme")
  .action(async (opts, cmd) => {
    await runPrototypeSetup({
      root: projectRootOpt(cmd),
      theme: opts.theme,
      emitManifest: opts.emitManifest,
      forceDesign: opts.forceDesign,
    });
  });

prototype
  .command("manifest")
  .description("Rebuild prototype/manifest.json and screen-map.json from docs/basic-design/list-screens.md")
  .option("--theme <name>", "Theme name stored in manifest")
  .option(
    "--default-screen <id>",
    "Default entry screen (Screen Index id); picks from screens with HTML when omitted",
  )
  .option("--review-host <url>", "POC host for reviewUrl fields (e.g. https://poc.dev.kaopiz.com)")
  .option("--project <id>", "Deploy project id for reviewUrl fields")
  .option("--version <slug>", "Deploy version for reviewUrl fields")
  .option(
    "--direct-review-url",
    "Set reviewUrl = prototypePath (full URL per screen; no host/project/version construction)",
  )
  .option("--dry-run", "Print planned manifest without writing")
  .option("--strict", "Treat warnings as errors (e.g. missing screen docs)")
  .option("--json", "JSON output")
  .action(async (opts, cmd) => {
    await runPrototypeManifest({
      root: projectRootOpt(cmd),
      theme: opts.theme,
      defaultScreen: opts.defaultScreen,
      reviewHost: opts.reviewHost,
      projectId: opts.project,
      version: opts.version,
      directReviewUrl: opts.directReviewUrl,
      dryRun: opts.dryRun,
      strict: opts.strict,
      json: opts.json,
    });
  });

prototype
  .command("map")
  .description(
    "Build prototype/screen-map.json from basic-design Screen Index + prototype/path-map.json (hosted / external prototypes)",
  )
  .option("--from <path>", "Path map input (default: prototype/path-map.json)")
  .option("--theme <name>", "Theme name stored in screen-map.json")
  .option("--review-host <url>", "POC host for reviewUrl fields (overrides path-map.json)")
  .option("--project <id>", "Deploy project id for reviewUrl fields")
  .option("--version <slug>", "Deploy version for reviewUrl fields")
  .option(
    "--direct-review-url",
    "Set reviewUrl = prototypePath (full URL per screen; no host/project/version construction)",
  )
  .option("--dry-run", "Print planned screen-map without writing")
  .option("--strict", "Require prototypePath for every Screen Index row")
  .option("--json", "JSON output (writes unless --dry-run)")
  .action(async (opts, cmd) => {
    await runPrototypeMap({
      root: projectRootOpt(cmd),
      from: opts.from,
      theme: opts.theme,
      reviewHost: opts.reviewHost,
      projectId: opts.project,
      version: opts.version,
      directReviewUrl: opts.directReviewUrl,
      dryRun: opts.dryRun,
      strict: opts.strict,
      json: opts.json,
    });
  });

prototype
  .command("sync")
  .description(
    "Copy SPA/framework build output into prototype dest dir and regenerate screen-map.json",
  )
  .option("--from <path>", "Source build output dir (overrides config.buildSrc)")
  .option("--to <path>", "Destination dir inside project (overrides config.buildDest)")
  .option("--skip-copy", "Only regenerate screen-map.json — do not copy files")
  .option("--clean", "Remove destination dir before copying (clean sync)")
  .option("--json", "JSON output")
  .action(async (opts, cmd) => {
    await runPrototypeSync({
      root: projectRootOpt(cmd),
      from: opts.from,
      to: opts.to,
      skipCopy: opts.skipCopy,
      clean: opts.clean,
      json: opts.json,
    });
  });

prototype
  .command("validate")
  .description("Check manifest, screen docs, and prototype/src/*.html alignment")
  .option("--strict", "Treat missing HTML as errors")
  .option("--skip-external-check", "Do not warn on CDN/font URLs in HTML")
  .option("--json", "JSON output")
  .action(async (opts, cmd) => {
    await runPrototypeValidate({
      root: projectRootOpt(cmd),
      strict: opts.strict,
      json: opts.json,
      skipExternalCheck: opts.skipExternalCheck,
    });
  });

graph
  .command("validate")
  .description("Validate graph against bundled schema and traceability rules")
  .option("-g, --graph <path>", "Graph path")
  .option("-s, --schema <path>", "Schema path")
  .option("--registry <path>", "Registry for REGISTRY-COMPLETE")
  .option("--rules <path>", "Rules manifest path")
  .action(async (opts, cmd) => {
    const paths = await getPaths(cmd);
    const issues = await validateGraph({
      graphPath: opts.graph ?? paths.graph,
      schemaPath: opts.schema ?? paths.schema,
      registryPath: opts.registry ?? paths.registry,
      rulesPath: opts.rules ?? paths.rulesTraceability,
    });
    console.log(formatIssues(issues));
    const errors = issues.filter((i) => i.severity === "error");
    if (errors.length > 0) {
      process.exitCode = 1;
    }
  });

registerTemplateCommand(program);
registerAdoptCommand(program);
registerUpgradeCommand(program);
registerReadinessCommand(program);

const course = program
  .command("course")
  .description("Browse the step-by-step AI Spector course in your browser");

course
  .command("serve")
  .description("Start a local web server for the interactive course")
  .option("--port <number>", "Port (default: 4177)", (v) => Number(v), 4177)
  .option("--host <host>", "Host (default: 127.0.0.1)", "127.0.0.1")
  .option("--open", "Open the course in your default browser")
  .action(async (opts, cmd) => {
    const result = await runCourseServe({
      projectRoot: projectRootOpt(cmd),
      host: opts.host,
      port: opts.port,
      open: opts.open,
    });
    console.log(formatCourseServeStarted(result));
    await new Promise<void>(() => {
      /* keep process alive until Ctrl+C */
    });
  });

// ── CocoIndex ──────────────────────────────────────────────────────────────────

const cocoindex = program
  .command("cocoindex")
  .description("CocoIndex semantic search add-on — index docs and search by meaning");

cocoindex
  .command("setup")
  .description("Scaffold the CocoIndex pipeline into this project")
  .option("--root <path>", "Project root (default: cwd)")
  .option("--force", "Overwrite existing pipeline files")
  .option("--json", "JSON output")
  .action(async (opts) => {
    const result = await runCocoindexSetup({ root: opts.root, force: opts.force });
    if (opts.json) console.log(JSON.stringify(result, null, 2));
    else console.log(formatCocoindexSetup(result));
  });

cocoindex
  .command("index")
  .description("Run the CocoIndex pipeline to update embeddings (requires Python)")
  .option("--root <path>", "Project root (default: cwd)")
  .action(async (opts) => {
    const { resolve: res, join } = await import("node:path");
    const { isCocoindexConfigured, cocoindexPipelinePath, cocoindexDir, findPython } = await import(
      "./core/operations/cocoindex.js"
    );
    const root = res(opts.root ?? process.cwd());
    if (!(await isCocoindexConfigured(root))) {
      console.error("CocoIndex is not configured. Run: npx ai-spector cocoindex setup");
      process.exitCode = 1;
      return;
    }
    const pipelinePath = cocoindexPipelinePath(root);
    let pythonBin: string;
    try {
      pythonBin = await findPython(cocoindexDir(root));
    } catch (err) {
      console.error(err instanceof Error ? err.message : String(err));
      process.exitCode = 1;
      return;
    }
    const { spawn } = await import("node:child_process");
    await new Promise<void>((resolveP, reject) => {
      const child = spawn(pythonBin, [join(cocoindexDir(root), "pipeline.py"), "update"], {
        cwd: root,
        stdio: "inherit",
        env: { ...process.env, AI_SPECTOR_ROOT: root },
        shell: process.platform === "win32",
      });
      child.on("error", reject);
      child.on("close", (code) => {
        if (code === 0) resolveP();
        else reject(new Error(`python pipeline exited with code ${code}`));
      });
    });
  });

cocoindex
  .command("query-fuzzy")
  .description("Resolve a natural language query to a graph node and return its subgraph")
  .requiredOption("--query <text>", "Natural language description of the node")
  .option("--root <path>", "Project root (default: cwd)")
  .option("--direction <dir>", "out | in | both", "out")
  .option("--depth <n>", "Max traversal depth", "3")
  .option("--threshold <n>", "Minimum cosine similarity 0–1", "0.35")
  .option("--json", "JSON output")
  .action(async (opts) => {
    try {
      const result = await runGraphQueryFuzzy({
        root: opts.root,
        query: opts.query,
        direction: opts.direction as "out" | "in" | "both",
        depth: Number(opts.depth),
        threshold: Number(opts.threshold),
      });
      if (opts.json) console.log(JSON.stringify(result, null, 2));
      else console.log(formatGraphQueryFuzzy(result));
    } catch (err) {
      console.error(err instanceof Error ? err.message : String(err));
      process.exitCode = 1;
    }
  });

cocoindex
  .command("search")
  .description("Semantic search over indexed project docs")
  .requiredOption("--query <text>", "Natural language search query")
  .option("--root <path>", "Project root (default: cwd)")
  .option("--limit <n>", "Max results", "5")
  .option("--threshold <n>", "Minimum cosine similarity 0–1", "0.35")
  .option("--json", "JSON output")
  .action(async (opts) => {
    const result = await runCocoindexSearch({
      root: opts.root,
      query: opts.query,
      limit: Number(opts.limit),
      threshold: Number(opts.threshold),
    });
    if (opts.json) console.log(JSON.stringify(result, null, 2));
    else console.log(formatCocoindexSearch(result));
  });

cocoindex
  .command("stats")
  .description("Embedding store diagnostics: chunk count, file count, embedded paths")
  .option("--root <path>", "Project root (default: cwd)")
  .option("--json", "JSON output")
  .action(async (opts) => {
    const { runCocoindexStats } = await import("./core/operations/cocoindex.js");
    const result = await runCocoindexStats({ root: opts.root });
    if (opts.json) console.log(JSON.stringify(result, null, 2));
    else console.log(formatCocoindexStats(result));
  });

// ── resolve-task ──────────────────────────────────────────────────────────────

program
  .command("resolve-task [planJson]")
  .description(
    "Execute a resolve-task plan from a JSON file or --task-id (approved task in .ai-spector/.docflow/tasks/).",
  )
  .option("--root <path>", "Project root (default: cwd)")
  .option("--task-id <id>", "Load approved plan from task file")
  .option("--dry-run", "Validate plan without writing any changes")
  .option("--json", "JSON output")
  .action(async (planJson: string | undefined, opts) => {
    const { readJson } = await import("./core/util/fs.js");
    const {
      runResolveTask,
      createGoalSpec,
      createPlan,
    } = await import("./core/operations/resolve-task.js");
    type TaskDomain = import("./core/operations/resolve-task.js").TaskDomain;
    type StepExecutor = import("./core/operations/resolve-task.js").StepExecutor;
    const { runIndex } = await import("./core/operations/index.js");
    const { runGraphMerge } = await import("./core/operations/graph-merge.js");
    const { runGraphReport } = await import("./core/operations/graph-report.js");
    const { runGraphImpact } = await import("./core/operations/graph-impact.js");
    const { resolveProjectPaths } = await import("./core/util/paths.js");
    const {
      loadResolveExecutionContext,
      recordResolveStepProgress,
    } = await import("./core/operations/task.js");

    const paths = await resolveProjectPaths(opts.root);

    let intent: string;
    let goalSpec: ReturnType<typeof createGoalSpec>;
    let plan: ReturnType<typeof createPlan>;
    const taskId = opts.taskId as string | undefined;

    if (taskId) {
      const ctx = await loadResolveExecutionContext({ root: paths.root, taskId });
      intent = ctx.intent;
      goalSpec = ctx.goalSpec;
      plan = ctx.plan;
    } else {
      if (!planJson) {
        throw new Error("Provide planJson path or --task-id");
      }
      const raw = await readJson<{
        intent: string;
        goalSpec: {
          trigger: string;
          domain: string;
          scope: string[];
          criteria: string[];
          notes?: string;
        };
        plan: {
          steps: Array<{ id: string; description: string; tool: string; args: Record<string, unknown> }>;
        };
      }>(resolve(planJson));
      goalSpec = createGoalSpec(
        raw.goalSpec.trigger,
        raw.goalSpec.domain as TaskDomain,
        raw.goalSpec.scope,
        raw.goalSpec.criteria,
        raw.goalSpec.notes,
      );
      plan = createPlan(
        goalSpec,
        raw.plan.steps,
        goalSpec.scope.map((nodeId) => ({ nodeId, directCallers: 0, riskLevel: "low" as const })),
      );
      plan.approvedAt = new Date().toISOString();
      intent = raw.intent;
    }

    const executors: Record<string, StepExecutor> = {
      index: async (_args: Record<string, unknown>, root: string) => {
        await runIndex({ root, graphOnly: false, docsOnly: false });
        return { artifacts: [] };
      },
      graph_merge: async (_args: Record<string, unknown>, root: string) => {
        const r = await runGraphMerge({ root });
        return { artifacts: r.graphPath ? [r.graphPath] : [] };
      },
      graph_report: async (_args: Record<string, unknown>, root: string) => {
        await runGraphReport({ root });
        return { artifacts: [] };
      },
      graph_impact: async (args: Record<string, unknown>, root: string) => {
        await runGraphImpact({
          graphPath: String(args.graphPath ?? paths.graph),
          rulesPath: String(args.rulesPath ?? paths.rulesImpact),
          projectRoot: root,
          change: String(args.change ?? ""),
          originId: args.originId != null ? String(args.originId) : undefined,
          file: args.file != null ? String(args.file) : undefined,
        });
        return { artifacts: [] };
      },
    };

    const onStepComplete = taskId
      ? async (
          event: import("./core/operations/resolve-task.js").ResolveStepProgressEvent,
        ) => {
          await recordResolveStepProgress({
            root: paths.root,
            taskId,
            plan: event.plan,
            stepId: event.stepId,
            stepStatus: event.status,
            artifacts: event.artifacts,
            blocker: event.issue ?? null,
          });
        }
      : undefined;

    const result = await runResolveTask({
      intent,
      goalSpec,
      plan,
      projectRoot: paths.root,
      graphPath: paths.graph,
      rulesPath: paths.rulesImpact,
      executors,
      dryRun: opts.dryRun,
      onStepComplete,
    });

    if (opts.json) console.log(JSON.stringify(result, null, 2));
    else console.log(formatResolveTask(result));
  });

program.parseAsync(process.argv).catch((err) => {
  const msg = err instanceof Error ? err.message : String(err);
  console.error(msg);
  console.error("");
  console.error("Fix the issue above, then re-run the same command.");
  console.error(
    "In Cursor: see .cursor/skills/ai-spector/references/cli-failures.md — agent offers fix, workaround, or pause.",
  );
  process.exit(1);
});
