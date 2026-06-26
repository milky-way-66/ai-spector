import { resolveProjectPaths } from "../util/paths.js";
import { loadOrDeriveDocopsConfig } from "../docops/config.js";
import { requireCapability } from "../engine/gate.js";
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
  runReviewSessionStart,
  runReviewSessionAckReview,
  runWithdraw,
  runReopen,
  runReviewConfig,
} from "./review.js";
import {
  runCommentsList,
  runCommentsFacets,
  runCommentsInbox,
  runCommentsBatchPlan,
  runCommentsBatchResolve,
  runCommentsShow,
  runCommentsResolve,
  toCommentListFilters,
} from "./comments.js";
import {
  runLangQueueScan,
  runLangQueuePending,
  runLangQueueFailed,
  runLangQueueResolved,
} from "./lang-queue.js";

// ── Shared input types ─────────────────────────────────────────────────────

export interface ContractReviewInput {
  root?: string;
  action: string;
  logicalPath?: string;
  track?: "internal" | "client" | "all";
  by?: string;
  username?: string;
  role?: "user" | "client";
  note?: string;
  reason?: string;
  showDiff?: boolean;
  includeHistory?: boolean;
  historyLimit?: number;
  historySince?: string;
  enrich?: boolean;
  status?: string;
  prefix?: string;
}

export interface ContractCommentsInput {
  root?: string;
  action: string;
  filePath?: string;
  pathPrefix?: string;
  commentTypes?: ("document" | "prototype")[];
  screen?: string;
  originBranch?: string;
  anchorState?: "active" | "drifted" | "missing";
  status?: "open" | "resolved" | "all";
  groupByScreen?: boolean;
  batchId?: string;
  picks?: string[];
  phrase?: string;
  threadId?: string;
  by?: string;
  username?: string;
  role?: "user" | "client";
  resolvedBy?: string;
  dryRun?: boolean;
}

export interface ContractPrototypeInput {
  root?: string;
  action: string;
}

export interface ContractTranslateInput {
  root?: string;
  action: string;
  lang?: string;
  limit?: number;
  status?: "pending" | "failed" | "resolved" | "all";
  enrich?: boolean;
}

// ── dispatch functions ─────────────────────────────────────────────────────

export async function dispatchContractReview(input: ContractReviewInput): Promise<unknown> {
  const paths = await resolveProjectPaths(input.root);
  const config = await loadOrDeriveDocopsConfig(paths.root);
  requireCapability(config, "review");

  const { action } = input;

  switch (action) {
    case "check":
      return runReviewCheck({ root: input.root });

    case "status":
      return runReviewStatus({
        root: input.root,
        logicalPath: input.logicalPath!,
        showDiff: input.showDiff,
        includeHistory: input.includeHistory,
        historyLimit: input.historyLimit,
        historySince: input.historySince,
      });

    case "approve":
      return runApprove({
        root: input.root,
        logicalPath: input.logicalPath!,
        by: input.by,
        username: input.username,
        role: input.role,
        note: input.note,
      });

    case "decline":
      return runDecline({
        root: input.root,
        logicalPath: input.logicalPath!,
        by: input.by,
        username: input.username,
        role: input.role,
        note: input.note,
      });

    case "close":
      return runClose({
        root: input.root,
        logicalPath: input.logicalPath!,
        reason: input.reason!,
        by: input.by,
        username: input.username,
        role: input.role,
      });

    case "reject":
      return runReviewReject({
        root: input.root,
        logicalPath: input.logicalPath!,
        reason: input.reason!,
        by: input.by,
        username: input.username,
        role: input.role,
      });

    case "queue":
      return runReviewQueue({
        root: input.root,
        track: input.track as "internal" | "client" | "all" | undefined,
        showDiff: input.showDiff,
        enrich: input.enrich ?? input.showDiff !== false,
      });

    case "list":
      return runReviewList({
        root: input.root,
        status: input.status as "pending_internal" | "pending_client" | "approved" | "rejected" | "all" | undefined,
        prefix: input.prefix,
      });

    case "begin":
      return runReviewBegin({
        root: input.root,
        logicalPath: input.logicalPath,
        showDiff: input.showDiff,
        includeHistory: input.includeHistory,
        historyLimit: input.historyLimit,
        historySince: input.historySince,
      });

    case "config":
      return runReviewConfig({ root: input.root });

    case "session_start":
      return runReviewSessionStart({ root: input.root });

    case "session_ack":
      return runReviewSessionAckReview({ root: input.root, logicalPath: input.logicalPath! });

    case "withdraw":
      return runWithdraw({
        root: input.root,
        logicalPath: input.logicalPath!,
        track: input.track as "internal" | "client" | undefined,
        by: input.by,
        username: input.username,
        role: input.role,
      });

    case "reopen":
      return runReopen({
        root: input.root,
        logicalPath: input.logicalPath!,
        track: input.track as "internal" | "client" | undefined,
        by: input.by,
        username: input.username,
        role: input.role,
      });

    default:
      throw new Error(
        `contract_review: unknown action "${action}". Valid actions: check, status, approve, decline, close, reject, queue, list, begin, config, session_start, session_ack, withdraw, reopen`,
      );
  }
}

export async function dispatchContractComments(input: ContractCommentsInput): Promise<unknown> {
  const paths = await resolveProjectPaths(input.root);
  const config = await loadOrDeriveDocopsConfig(paths.root);
  requireCapability(config, "comments");

  const { action } = input;
  const filters = toCommentListFilters({
    filePath: input.filePath,
    pathPrefix: input.pathPrefix,
    commentTypes: input.commentTypes,
    screen: input.screen,
    branch: input.originBranch,
    anchorState: input.anchorState,
    status: input.status,
  });

  switch (action) {
    case "list":
      return runCommentsList({ root: input.root, ...filters });

    case "inbox":
      return runCommentsInbox({
        root: input.root,
        ...filters,
        groupByScreen: input.groupByScreen,
      });

    case "show":
      return runCommentsShow({ root: input.root, threadId: input.threadId!, filePath: input.filePath });

    case "resolve":
      return runCommentsResolve({
        root: input.root,
        threadId: input.threadId!,
        filePath: input.filePath!,
        resolvedBy: input.by ?? input.resolvedBy,
        resolvedByUsername: input.username,
        role: input.role,
        dryRun: input.dryRun,
      });

    case "facets":
      return runCommentsFacets({
        root: input.root,
        ...toCommentListFilters({
          filePath: input.filePath,
          pathPrefix: input.pathPrefix,
          commentTypes: input.commentTypes,
          screen: input.screen,
          branch: input.originBranch,
          status: "all",
        }),
      });

    case "batch_plan":
      return runCommentsBatchPlan({
        root: input.root,
        ...toCommentListFilters({
          filePath: input.filePath,
          pathPrefix: input.pathPrefix,
          commentTypes: input.commentTypes ?? ["prototype"],
          screen: input.screen,
          branch: input.originBranch,
          anchorState: input.anchorState,
          status: input.status,
        }),
        batchId: input.batchId,
        picks: input.picks,
        screen: input.screen,
        phrase: input.phrase,
        groupByScreen: input.groupByScreen ?? true,
      });

    case "batch_resolve":
      return runCommentsBatchResolve({
        root: input.root,
        picks: input.picks!,
        commentTypes: ["prototype"],
        resolvedBy: input.by ?? input.resolvedBy,
        resolvedByUsername: input.username,
        role: input.role,
        dryRun: input.dryRun,
      });

    default:
      throw new Error(
        `contract_comments: unknown action "${action}". Valid actions: list, inbox, show, resolve, facets, batch_plan, batch_resolve`,
      );
  }
}

export async function dispatchContractPrototype(input: ContractPrototypeInput): Promise<unknown> {
  const paths = await resolveProjectPaths(input.root);
  const config = await loadOrDeriveDocopsConfig(paths.root);
  requireCapability(config, "prototype");

  const { action } = input;

  switch (action) {
    default:
      throw new Error(
        `contract_prototype: unknown action "${action}". No prototype preview actions are currently supported via MCP.`,
      );
  }
}

export async function dispatchContractTranslate(input: ContractTranslateInput): Promise<unknown> {
  const paths = await resolveProjectPaths(input.root);
  const config = await loadOrDeriveDocopsConfig(paths.root);
  requireCapability(config, "translate");

  const { action } = input;

  switch (action) {
    case "lang_queue": {
      const enrich = input.enrich !== false;
      const opts = { root: input.root, lang: input.lang, limit: input.limit, enrich };
      const status = input.status ?? "pending";

      const scan = await runLangQueueScan(opts);
      if (scan.skipped) {
        return { skipped: true, skipReason: scan.skipReason, jobs: [] };
      }

      let jobs: unknown[] = [];
      if (status === "pending" || status === "all") {
        jobs = [...jobs, ...(await runLangQueuePending(opts)).map((r) => r.job)];
      }
      if (status === "failed" || status === "all") {
        jobs = [...jobs, ...(await runLangQueueFailed(opts))];
      }
      if (status === "resolved" || status === "all") {
        jobs = [...jobs, ...(await runLangQueueResolved(opts))];
      }

      return {
        skipped: false,
        summary: {
          pending: scan.pendingCount ?? 0,
          enqueued: scan.enqueued ?? 0,
          resolved: scan.resolved ?? 0,
          failed: scan.failed ?? 0,
        },
        status,
        jobs,
      };
    }

    default:
      throw new Error(
        `contract_translate: unknown action "${action}". Valid actions: lang_queue`,
      );
  }
}
