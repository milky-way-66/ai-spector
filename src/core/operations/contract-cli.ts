import { resolve } from "node:path";
import type { Command } from "commander";
import type { CommentType } from "../comments/types.js";
import type { CommentFilterOptions } from "./comments.js";
import {
  dispatchContractReview,
  dispatchContractComments,
  dispatchContractTranslate,
} from "./contract.js";
import { runPrototypePreview, runPrototypeValidate } from "./prototype.js";
import {
  formatApproveResult,
  formatDeclineResult,
  formatCloseResult,
  formatReviewStatus,
  formatReviewQueue,
  formatReviewCheck,
  formatReviewReject,
  formatReviewList,
} from "../../interfaces/cli/format/reviews.js";
import {
  formatCommentsList,
  formatCommentsInbox,
  formatCommentsShow,
  formatCommentsResolve,
  formatCommentsFacets,
} from "../../interfaces/cli/format/comments.js";
import {
  formatPendingTable,
  formatResolvedTable,
  formatFailedTable,
} from "../lang/queue.js";
import type { TranslationJob } from "../lang/queue-types.js";

function projectRoot(cmd: Command, opts: { cwd?: string }): string | undefined {
  const globalRoot = (cmd.optsWithGlobals() as { root?: string }).root;
  if (opts.cwd) return resolve(opts.cwd);
  return globalRoot;
}

function parseCommentTypesOpt(raw: string | undefined): CommentType[] | undefined {
  if (!raw?.trim()) return undefined;
  const allowed = new Set(["document", "prototype"]);
  const types = raw
    .split(",")
    .map((t) => t.trim())
    .filter((t): t is CommentType => allowed.has(t));
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

type JsonOpts = { json?: boolean };

async function printResult(
  result: unknown,
  opts: JsonOpts,
  format?: (value: never) => string,
): Promise<void> {
  if (opts.json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }
  if (format) {
    console.log(format(result as never));
    return;
  }
  console.log(JSON.stringify(result, null, 2));
}

interface TranslateQueueResult {
  skipped?: boolean;
  skipReason?: string;
  status?: string;
  summary?: {
    pending: number;
    enqueued: number;
    resolved: number;
    failed: number;
  };
  jobs?: TranslationJob[];
}

function formatContractTranslateQueue(result: TranslateQueueResult): string {
  if (result.skipped) {
    return `Translation queue skipped: ${result.skipReason ?? "unknown reason"}`;
  }
  const lines: string[] = [`Translation queue (status: ${result.status ?? "pending"})`];
  if (result.summary) {
    lines.push(
      `  pending: ${result.summary.pending}, enqueued: ${result.summary.enqueued}, resolved: ${result.summary.resolved}, failed: ${result.summary.failed}`,
    );
  }
  const jobs = result.jobs ?? [];
  if (jobs.length === 0) {
    lines.push("No jobs.");
  } else if (result.status === "failed") {
    lines.push(formatFailedTable(jobs as Parameters<typeof formatFailedTable>[0]));
  } else if (result.status === "resolved") {
    lines.push(formatResolvedTable(jobs as Parameters<typeof formatResolvedTable>[0]));
  } else {
    lines.push(formatPendingTable(jobs));
  }
  return lines.join("\n");
}

function registerContractReviewCommands(contract: Command): void {
  const review = contract.command("review").description("Document sign-off (Writer contract)");

  review
    .command("check")
    .description("Scan approved documents for content changes and invalidate stale approvals")
    .option("-C, --cwd <path>", "Project root", process.cwd())
    .option("--json", "JSON output")
    .action(async (opts, cmd) => {
      const result = await dispatchContractReview({
        root: projectRoot(cmd, opts),
        action: "check",
      });
      await printResult(result, opts, formatReviewCheck as (value: never) => string);
    });

  review
    .command("status <logicalPath>")
    .description("Show review status for a document (both tracks + diff if pending)")
    .option("-C, --cwd <path>", "Project root", process.cwd())
    .option("--no-diff", "Skip diff content")
    .option("--history", "Include approval history")
    .option("--history-limit <n>", "Max history entries to return", parseInt)
    .option("--history-since <iso>", "Only history entries after this ISO timestamp")
    .option("--json", "JSON output")
    .action(async (logicalPath: string, opts, cmd) => {
      const result = await dispatchContractReview({
        root: projectRoot(cmd, opts),
        action: "status",
        logicalPath,
        showDiff: opts.diff !== false,
        includeHistory: opts.history,
        historyLimit: opts.historyLimit,
        historySince: opts.historySince,
      });
      await printResult(result, opts, formatReviewStatus as (value: never) => string);
    });

  review
    .command("approve <logicalPath>")
    .description("Cast internal approve vote; moves to client queue when minApprovals is met")
    .option("-C, --cwd <path>", "Project root", process.cwd())
    .option("--by <email>", "Reviewer email override (default: git user.email)")
    .option("--username <name>", "Reviewer name override (default: git user.name)")
    .option("--role <role>", "Actor role: user | client (default: user)")
    .option("--note <note>", "Review note")
    .option("--json", "JSON output")
    .action(async (logicalPath: string, opts, cmd) => {
      const result = await dispatchContractReview({
        root: projectRoot(cmd, opts),
        action: "approve",
        logicalPath,
        by: opts.by,
        username: opts.username,
        role: opts.role,
        note: opts.note,
      });
      await printResult(result, opts, formatApproveResult as (value: never) => string);
    });

  review
    .command("decline <logicalPath>")
    .description("Cast internal decline vote on a document pending review")
    .option("-C, --cwd <path>", "Project root", process.cwd())
    .option("--by <email>", "Reviewer email override (default: git user.email)")
    .option("--username <name>", "Reviewer name override (default: git user.name)")
    .option("--note <note>", "Decline reason")
    .option("--json", "JSON output")
    .action(async (logicalPath: string, opts, cmd) => {
      const result = await dispatchContractReview({
        root: projectRoot(cmd, opts),
        action: "decline",
        logicalPath,
        by: opts.by,
        username: opts.username,
        note: opts.note,
      });
      await printResult(result, opts, formatDeclineResult as (value: never) => string);
    });

  review
    .command("close <logicalPath>")
    .description("Manually close internal review when minApprovals cannot be reached")
    .requiredOption("--reason <text>", "Why the review is closed")
    .option("-C, --cwd <path>", "Project root", process.cwd())
    .option("--by <email>", "Actor email override")
    .option("--username <name>", "Actor name override")
    .option("--json", "JSON output")
    .action(async (logicalPath: string, opts, cmd) => {
      const result = await dispatchContractReview({
        root: projectRoot(cmd, opts),
        action: "close",
        logicalPath,
        reason: opts.reason,
        by: opts.by,
        username: opts.username,
      });
      await printResult(result, opts, formatCloseResult as (value: never) => string);
    });

  review
    .command("reject <logicalPath>")
    .description("Dismiss document from internal queue without re-approval (trivial changes)")
    .option("-C, --cwd <path>", "Project root", process.cwd())
    .option("--reason <text>", "Why the change does not require re-approval")
    .option("--by <email>", "Reviewer email override")
    .option("--username <name>", "Reviewer name override")
    .option("--role <role>", "Actor role: user | client")
    .option("--json", "JSON output")
    .action(async (logicalPath: string, opts, cmd) => {
      const result = await dispatchContractReview({
        root: projectRoot(cmd, opts),
        action: "reject",
        logicalPath,
        reason: opts.reason,
        by: opts.by,
        username: opts.username,
        role: opts.role,
      });
      await printResult(result, opts, formatReviewReject as (value: never) => string);
    });

  review
    .command("queue")
    .description("List documents pending review across internal and client queues")
    .option("-C, --cwd <path>", "Project root", process.cwd())
    .option("--track <track>", "internal | client | all (default: all)")
    .option("--no-diff", "Skip diff content")
    .option("--no-enrich", "Skip git diff and graph impact (fast listing)")
    .option("--json", "JSON output")
    .action(async (opts, cmd) => {
      const result = await dispatchContractReview({
        root: projectRoot(cmd, opts),
        action: "queue",
        track: opts.track,
        showDiff: opts.diff !== false,
        enrich: opts.enrich,
      });
      await printResult(result, opts, formatReviewQueue as (value: never) => string);
    });

  review
    .command("list")
    .description("List all documents with approval records")
    .option("-C, --cwd <path>", "Project root", process.cwd())
    .option("--prefix <prefix>", "Filter by logical path prefix (e.g. srs/)")
    .option(
      "--status <status>",
      "Filter by overall status: pending_internal | pending_client | approved | rejected | all",
    )
    .option("--json", "JSON output")
    .action(async (opts, cmd) => {
      const result = await dispatchContractReview({
        root: projectRoot(cmd, opts),
        action: "list",
        prefix: opts.prefix,
        status: opts.status,
      });
      await printResult(result, opts, formatReviewList as (value: never) => string);
    });
}

function registerContractCommentsCommands(contract: Command): void {
  const comments = contract
    .command("comments")
    .description("Git-backed review comment threads (Writer contract)");

  comments
    .command("list")
    .description("List comment threads from comments/{logical_path}/")
    .option("-C, --cwd <path>", "Project root", process.cwd())
    .option("--file <path>", "Filter by logical file path (e.g. srs/01-overview or prototype)")
    .option("--path <prefix>", "Path prefix (e.g. srs/)")
    .option("--type <types>", "Comma-separated comment types: document, prototype")
    .option("--screen <name>", "Prototype screen stem (e.g. login)")
    .option("--branch <name>", "Filter by originBranch")
    .option("--anchor-state <state>", "active | drifted | missing")
    .option("--status <status>", "open | resolved | all", "open")
    .option("--json", "JSON output")
    .action(async (opts, cmd) => {
      const filters = commentFilterOpts(opts);
      const result = await dispatchContractComments({
        root: projectRoot(cmd, opts),
        action: "list",
        filePath: filters.filePath,
        pathPrefix: filters.pathPrefix,
        commentTypes: filters.commentTypes,
        screen: filters.screen,
        originBranch: filters.branch,
        anchorState: filters.anchorState,
        status: filters.status,
      });
      await printResult(result, opts, formatCommentsList as (value: never) => string);
    });

  comments
    .command("inbox")
    .description("Thread pick list for IDE chat (C-001 / B-001)")
    .option("-C, --cwd <path>", "Project root", process.cwd())
    .option("--file <path>", "Filter by logical file path (e.g. prototype)")
    .option("--path <prefix>", "Path prefix")
    .option("--type <types>", "Comma-separated comment types: document, prototype")
    .option("--screen <name>", "Prototype screen stem (e.g. login)")
    .option("--branch <name>", "Filter by originBranch")
    .option("--anchor-state <state>", "active | drifted | missing")
    .option("--group <mode>", "screen — add B-00N batch rows for prototype screens")
    .option("--status <status>", "open | resolved | all", "open")
    .option("--json", "JSON output")
    .action(async (opts, cmd) => {
      const filters = commentFilterOpts(opts);
      const result = await dispatchContractComments({
        root: projectRoot(cmd, opts),
        action: "inbox",
        filePath: filters.filePath,
        pathPrefix: filters.pathPrefix,
        commentTypes: filters.commentTypes,
        screen: filters.screen,
        originBranch: filters.branch,
        anchorState: filters.anchorState,
        status: filters.status,
        groupByScreen: filters.groupByScreen,
      });
      await printResult(result, opts, formatCommentsInbox as (value: never) => string);
    });

  comments
    .command("show <threadId>")
    .description("Show thread metadata, replies, and events")
    .option("-C, --cwd <path>", "Project root", process.cwd())
    .option("--file <path>", "Logical file path when thread id alone is ambiguous")
    .option("--json", "JSON output")
    .action(async (threadId: string, opts, cmd) => {
      const result = await dispatchContractComments({
        root: projectRoot(cmd, opts),
        action: "show",
        threadId,
        filePath: opts.file,
      });
      await printResult(result, opts, formatCommentsShow as (value: never) => string);
    });

  comments
    .command("resolve <threadId>")
    .description("Mark thread resolved in meta_data.json and append events.jsonl")
    .requiredOption("--file <path>", "Logical file path (e.g. srs/04-features/auth)")
    .option("-C, --cwd <path>", "Project root", process.cwd())
    .option("--by <email>", "Resolver email override (default: git user.email)")
    .option("--username <name>", "Resolver name override (default: git user.name)")
    .option("--role <role>", "Actor role: user | client (default: user)")
    .option("--dry-run", "Preview resolve without writing files")
    .option("--json", "JSON output")
    .action(async (threadId: string, opts, cmd) => {
      const result = await dispatchContractComments({
        root: projectRoot(cmd, opts),
        action: "resolve",
        threadId,
        filePath: opts.file,
        by: opts.by,
        username: opts.username,
        role: opts.role,
        dryRun: opts.dryRun,
      });
      if (opts.json) console.log(JSON.stringify(result, null, 2));
      else console.log(formatCommentsResolve(result as never, threadId));
    });

  comments
    .command("facets")
    .description("Available comment filter values and counts")
    .option("-C, --cwd <path>", "Project root", process.cwd())
    .option("--file <path>", "Scope facets to file path filter")
    .option("--path <prefix>", "Scope facets to path prefix")
    .option("--type <types>", "Comma-separated: document, prototype")
    .option("--screen <name>", "Prototype screen filter")
    .option("--branch <name>", "Branch filter")
    .option("--json", "JSON output")
    .action(async (opts, cmd) => {
      const filters = commentFilterOpts({ ...opts, status: "all" });
      const result = await dispatchContractComments({
        root: projectRoot(cmd, opts),
        action: "facets",
        filePath: filters.filePath,
        pathPrefix: filters.pathPrefix,
        commentTypes: filters.commentTypes,
        screen: filters.screen,
        originBranch: filters.branch,
      });
      await printResult(result, opts, formatCommentsFacets as (value: never) => string);
    });
}

function registerContractPrototypeCommands(contract: Command): void {
  const prototype = contract
    .command("prototype")
    .description("Prototype workspace helpers (Writer contract)");

  prototype
    .command("validate")
    .description("Check manifest, screen docs, and prototype/src/*.html alignment")
    .option("-C, --cwd <path>", "Project root", process.cwd())
    .option("--strict", "Treat missing HTML as errors")
    .option("--skip-external-check", "Do not warn on CDN/font URLs in HTML")
    .option("--json", "JSON output")
    .action(async (opts, cmd) => {
      await runPrototypeValidate({
        root: projectRoot(cmd, opts),
        strict: opts.strict,
        json: opts.json,
        skipExternalCheck: opts.skipExternalCheck,
      });
    });

  prototype
    .command("preview <theme>")
    .description("Show (and optionally open) a theme preview.html from assets/themes/<name>/")
    .option("--open", "Open preview in the default browser")
    .option("--json", "JSON output with file path")
    .action(async (theme: string, opts) => {
      await runPrototypePreview({ theme, open: opts.open, json: opts.json });
    });
}

function registerContractTranslateCommands(contract: Command): void {
  const translate = contract
    .command("translate")
    .description("Translation sync queue (Writer contract)");

  const queue = translate.command("queue").description("Translation sync job queue");

  queue
    .command("pending")
    .description("List pending translation sync jobs (default queue view)")
    .option("-C, --cwd <path>", "Project root", process.cwd())
    .option("--lang <code>", "Filter jobs affecting a language")
    .option("--no-enrich", "Skip git diff and graph impact (fast listing)")
    .option("--json", "JSON output")
    .action(async (opts, cmd) => {
      const result = await dispatchContractTranslate({
        root: projectRoot(cmd, opts),
        action: "lang_queue",
        lang: opts.lang,
        status: "pending",
        enrich: opts.enrich,
      });
      await printResult(result, opts, formatContractTranslateQueue as (value: never) => string);
    });

  queue
    .command("resolved")
    .description("List resolved translation sync jobs")
    .option("-C, --cwd <path>", "Project root", process.cwd())
    .option("--limit <n>", "Max entries to show", (v) => parseInt(v, 10))
    .option("--json", "JSON output")
    .action(async (opts, cmd) => {
      const result = await dispatchContractTranslate({
        root: projectRoot(cmd, opts),
        action: "lang_queue",
        status: "resolved",
        limit: opts.limit,
      });
      await printResult(result, opts, formatContractTranslateQueue as (value: never) => string);
    });

  queue
    .command("failed")
    .description("List failed translation sync jobs")
    .option("-C, --cwd <path>", "Project root", process.cwd())
    .option("--limit <n>", "Max entries to show", (v) => parseInt(v, 10))
    .option("--json", "JSON output")
    .action(async (opts, cmd) => {
      const result = await dispatchContractTranslate({
        root: projectRoot(cmd, opts),
        action: "lang_queue",
        status: "failed",
        limit: opts.limit,
      });
      await printResult(result, opts, formatContractTranslateQueue as (value: never) => string);
    });
}

/** Register the `contract` CLI command group (review, comments, prototype, translate). */
export function registerContractCommands(program: Command): void {
  const contract = program
    .command("contract")
    .description("Writer contract operations (review, comments, prototype, translate)");

  registerContractReviewCommands(contract);
  registerContractCommentsCommands(contract);
  registerContractPrototypeCommands(contract);
  registerContractTranslateCommands(contract);
}
