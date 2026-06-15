import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { resolveAuditActor } from "../util/audit-actor.js";
import { pathExists } from "../util/fs.js";
import { resolveProjectPaths } from "../util/paths.js";
import { normalizeLogicalPath } from "../comments/paths.js";
import { resolveReviewDocPath } from "../reviews/doc-resolve.js";
import { docTypeFromLogicalPath } from "../reviews/doc-type.js";
import {
  runReadinessOutputChecklist,
  runReadinessScan,
  type ReadinessOutputChecklistResult,
  type ReadinessScanResult,
} from "./readiness.js";
import { listThreads } from "../comments/storage.js";
import { computeLineDiff } from "../util/diff.js";
import {
  getApproval,
  saveApproval,
  makeApproval,
  writeSnapshot,
  readSnapshot,
  appendHistory,
  addToQueue,
  removeFromQueue,
  archiveQueueEntry,
  loadQueueIndex,
  loadDiff,
  saveDiff,
  deleteDiff,
  deriveOverallStatus,
  discoverApprovals,
  readHistory,
  updateFingerprint,
} from "../reviews/storage.js";
import { reconcileReviews } from "../reviews/reconcile.js";
import { ensureApprovalForReview, runReviewDiscovery } from "../reviews/register.js";
import { deriveReviewKind, reviewTemplateForKind, type ReviewKind, type ReviewTemplate } from "../reviews/review-kind.js";
import { computeLiveStaleness } from "../reviews/staleness.js";
import { ensureReviewQueueMigrated, migrateLegacyReviews } from "../reviews/migrate.js";
import { assertCanInternalApprove, assertCanInternalClose } from "../reviews/errors.js";
import { computeQuorum } from "../reviews/quorum.js";
import { emptyClientTrack, upsertVote, trackQuorum } from "../reviews/votes.js";
import {
  assertReviewSessionAllowsApprove,
  clearReviewSession,
  loadReviewSession,
  resetReviewSession,
  setReviewSessionPhase,
} from "../reviews/session.js";
import {
  buildReviewWorkflowGuidance,
  type ReviewWorkflowGuidance,
} from "../reviews/workflow-guidance.js";
import {
  buildReviewSessionWorkflowGuidance,
  type WorkflowToolGuidance,
} from "../workflow/guidance.js";
import {
  clearWorkflowActive,
  recordWorkflowFromReviewSession,
} from "../workflow/active-worker.js";
import type {
  ApprovalRecord,
  QueueEntry,
  DiffFile,
  HistoryLine,
  ReviewSessionFile,
  QuorumSummary,
  ReviewVote,
} from "../reviews/types.js";

// ── Options / Results ─────────────────────────────────────────────────────────

export interface ReviewApproveOptions {
  root?: string;
  logicalPath: string;
  /** Optional email override; generic values like "user" resolve to git user.email. */
  by?: string;
  /** Optional name override; generic values resolve to git user.name. */
  username?: string;
  role?: "user" | "client";
  /** Reviewer note on approve (optional). */
  note?: string;
}

export interface ReviewApproveResult {
  logicalPath: string;
  approvedBy: string;
  approvedByUsername: string;
  approvedByRole: "user" | "client";
  contentHash: string;
  decision: "approve";
  quorum: QuorumSummary;
  quorumMet: boolean;
  movedToClientQueue: boolean;
  openThreadWarning: string | null;
  note?: string;
}

export interface ReviewDeclineOptions {
  root?: string;
  logicalPath: string;
  by?: string;
  username?: string;
  role?: "user" | "client";
  note?: string;
}

export interface ReviewDeclineResult {
  logicalPath: string;
  declinedBy: string;
  declinedByUsername: string;
  declinedByRole: "user" | "client";
  contentHash: string;
  decision: "decline";
  quorum: QuorumSummary;
  quorumMet: boolean;
  note?: string;
}

export interface ReviewCloseOptions {
  root?: string;
  logicalPath: string;
  reason: string;
  by?: string;
  username?: string;
  role?: "user" | "client";
}

export interface ReviewCloseResult {
  logicalPath: string;
  closedBy: string;
  closedByUsername: string;
  closedByRole: "user" | "client";
  reason: string;
  quorum: QuorumSummary;
}

export interface ReviewStatusOptions {
  root?: string;
  logicalPath: string;
  showDiff?: boolean;
  includeHistory?: boolean;
  historyLimit?: number;
  historySince?: string;
}

export interface ReviewReadinessContext {
  docPath: string;
  docType: string;
  /** Structural checks (headings, placeholders, empty sections). */
  structuralScan: ReadinessScanResult;
  /** Rubric for agent semantic scoring — judge each item met | partial | missing. */
  outputChecklist: ReadinessOutputChecklistResult;
}

export interface ReviewStatusResult {
  approval: ApprovalRecord;
  diff: DiffFile | null;
  internalQuorum: QuorumSummary;
  clientQuorum: QuorumSummary;
  /** True when live content hash differs from last approved hash (computed, not yet reconciled). */
  stale?: boolean;
  /** Hash of the approved snapshot when stale is true. */
  approvedContentHash?: string;
  history?: HistoryLine[];
  /** Resolved on-disk path and readiness rubric when doc type is known. */
  readiness?: ReviewReadinessContext;
  /** Agent routing: recommended next MCP tools and whether review_approve is allowed now. */
  workflowGuidance?: ReviewWorkflowGuidance;
  /** Persisted review session gate state (`.session.json`). */
  session?: ReviewSessionFile | null;
  /** Classification for review template selection. */
  reviewKind?: ReviewKind;
  reviewTemplate?: ReviewTemplate;
  docPath?: string;
}

export interface ReviewQueueOptions {
  root?: string;
  track?: "internal" | "client" | "all";
  showDiff?: boolean;
}

export interface ReviewQueueResult {
  internal: { pending: QueueEntry[]; resolved: QueueEntry[]; rejected: QueueEntry[]; failed: QueueEntry[] };
  client: { pending: QueueEntry[]; resolved: QueueEntry[]; rejected: QueueEntry[] };
  diffs: Record<string, DiffFile | null>;
  session?: ReviewSessionFile;
  workflowGuidance?: WorkflowToolGuidance;
}

export interface ReviewCheckOptions {
  root?: string;
}

export interface ReviewCheckResult {
  scanned: number;
  invalidated: number;
  alreadyPending: number;
  /** Markdown files found on disk under docs/srs, docs/basic-design, docs/detail-design. */
  discovered: number;
  /** Never-reviewed docs registered this run. */
  queued: number;
  /** Pending-internal docs whose on-disk content changed this run. */
  updated: number;
  alreadyQueued: number;
  errors: Array<{ logicalPath: string; error: string }>;
  migrated?: boolean;
  session?: ReviewSessionFile;
  workflowGuidance?: WorkflowToolGuidance;
}

export interface ReviewBeginOptions {
  root?: string;
  logicalPath?: string;
  showDiff?: boolean;
  includeHistory?: boolean;
  historyLimit?: number;
  historySince?: string;
}

export interface ReviewBeginDiscovery {
  discovered: number;
  queued: number;
  updated: number;
  alreadyQueued: number;
  scanned: number;
  invalidated: number;
  alreadyPending: number;
}

export type ReviewBeginResult =
  | (ReviewStatusResult & { discovery: ReviewBeginDiscovery })
  | {
      discovery: ReviewBeginDiscovery;
      queue: ReviewQueueResult;
      session: ReviewSessionFile;
      workflowGuidance: ReviewWorkflowGuidance;
    };

export interface ReviewRejectOptions {
  root?: string;
  logicalPath: string;
  reason?: string;
  by?: string;
  username?: string;
  role?: "user" | "client";
}

export interface ReviewRejectResult {
  logicalPath: string;
  rejected: boolean;
  rejectedBy: string;
  rejectedByUsername: string;
  rejectedByRole: "user" | "client";
  message: string;
}

export interface ReviewListOptions {
  root?: string;
  /** Filter by overallStatus. Omit to return all. */
  status?: "pending_internal" | "pending_client" | "approved" | "rejected" | "all";
  /** Filter to logical paths starting with this prefix, e.g. "srs" */
  prefix?: string;
}

export interface ReviewListEntry {
  logicalPath: string;
  overallStatus: string;
  contentHash: string;
  internal: { status: string; quorum: QuorumSummary };
  client: { status: string; quorum: QuorumSummary };
  /** True when live content differs from last approved hash. */
  stale?: boolean;
  /** Hash at last approval when stale is true. */
  approvedContentHash?: string;
}

export interface ReviewListResult {
  entries: ReviewListEntry[];
  total: number;
}

export interface ReviewMigrateOptions {
  root?: string;
}

export interface ReviewMigrateResult {
  migrated: boolean;
  documents: number;
  pendingJobs: number;
  historyLines: number;
  message: string;
}

export interface ReviewSessionStartOptions {
  root?: string;
}

export interface ReviewSessionStartResult {
  session: ReviewSessionFile;
  message: string;
  workflowGuidance?: WorkflowToolGuidance;
}

export interface ReviewSessionAckReviewOptions {
  root?: string;
  logicalPath: string;
}

export interface ReviewSessionAckReviewResult {
  logicalPath: string;
  session: ReviewSessionFile;
  canReviewApprove: boolean;
  workflowGuidance?: WorkflowToolGuidance;
}

async function prepareReviewRoot(root?: string): Promise<string> {
  const paths = await resolveProjectPaths(root);
  await ensureReviewQueueMigrated(paths.root);
  return paths.root;
}

async function loadDocContentHash(
  projectRoot: string,
  lp: string,
): Promise<{ absPath: string; docPath: string; contentHash: string; content: string }> {
  const { absPath, docPath } = await resolveReviewDocPath(projectRoot, lp);
  const content = await readFile(absPath, "utf8");
  const contentHash = createHash("sha256").update(content).digest("hex").slice(0, 16);
  return { absPath, docPath, contentHash, content };
}

async function finalizeInternalQuorum(
  projectRoot: string,
  lp: string,
  approval: ApprovalRecord,
  content: string,
  contentHash: string,
  docPath: string,
  now: string,
  actor: { by: string; username: string; role: "user" | "client" },
  quorum: QuorumSummary,
): Promise<void> {
  const snapshotRef = await writeSnapshot(projectRoot, lp, content);
  approval.snapshotRef = snapshotRef;

  await updateFingerprint(projectRoot, lp, {
    hash: contentHash,
    docPath,
    scannedAt: now,
  });

  const entry = await removeFromQueue(projectRoot, "internal", lp);
  if (entry) {
    await archiveQueueEntry(projectRoot, "internal", "resolved", { ...entry, queuedAt: entry.queuedAt });
    await deleteDiff(projectRoot, "internal", lp);
  }

  await addToQueue(projectRoot, "client", {
    logicalPath: lp,
    queuedAt: now,
    reason: "awaiting_client_signoff",
    approvedHash: contentHash,
    currentHash: contentHash,
  });

  await appendHistory(projectRoot, lp, {
    event: "internal_quorum_met",
    track: "internal",
    at: now,
    by: actor.by,
    username: actor.username,
    role: actor.role,
    hash: contentHash,
    meta: {
      voterCount: quorum.voterCount,
      approveCount: quorum.approveCount,
      required: quorum.required,
    },
  });

  await clearReviewSession(projectRoot);
  await clearWorkflowActive(projectRoot, "doc-review");
}

async function appendInternalVoteHistory(
  projectRoot: string,
  lp: string,
  vote: ReviewVote,
  contentHash: string,
): Promise<void> {
  await appendHistory(projectRoot, lp, {
    event: "internal_vote",
    track: "internal",
    decision: vote.decision,
    at: vote.at,
    by: vote.by,
    username: vote.username,
    role: vote.role,
    hash: contentHash,
    ...(vote.note ? { note: vote.note } : {}),
  });
}

// ── Operations ────────────────────────────────────────────────────────────────

export async function runApprove(opts: ReviewApproveOptions): Promise<ReviewApproveResult> {
  const projectRoot = await prepareReviewRoot(opts.root);
  const lp = normalizeLogicalPath(opts.logicalPath);
  const actor = await resolveAuditActor(projectRoot, {
    by: opts.by,
    username: opts.username,
    role: opts.role ?? "user",
  });

  const { docPath, contentHash, content } = await loadDocContentHash(projectRoot, lp);

  let openThreadWarning: string | null = null;
  const openThreads = await listThreads({ projectRoot, filePath: lp, status: "open" });
  if (openThreads.length > 0) {
    openThreadWarning = `${openThreads.length} open comment thread(s) on this document`;
  }

  const now = new Date().toISOString();

  let approval = await getApproval(projectRoot, lp);
  if (!approval) {
    approval = makeApproval(lp, contentHash, docPath);
  }

  assertCanInternalApprove(approval, lp);
  const session = await loadReviewSession(projectRoot);
  assertReviewSessionAllowsApprove(session, lp, contentHash);

  const vote: ReviewVote = {
    by: actor.by,
    username: actor.username,
    role: actor.role,
    decision: "approve",
    at: now,
    note: opts.note ?? null,
  };

  approval.docPath = docPath;
  approval.contentHash = contentHash;
  approval.internal.votes = upsertVote(approval.internal.votes, vote);
  const quorum = computeQuorum(approval.internal.votes);

  let movedToClientQueue = false;
  if (quorum.met) {
    approval.internal.status = "approved";
    approval.internal.quorumMetAt = now;
    await finalizeInternalQuorum(projectRoot, lp, approval, content, contentHash, docPath, now, actor, quorum);
    movedToClientQueue = true;
  }

  approval.lastEventAt = now;
  approval.overallStatus = deriveOverallStatus(approval);
  await saveApproval(projectRoot, approval);
  await appendInternalVoteHistory(projectRoot, lp, vote, contentHash);

  return {
    logicalPath: lp,
    approvedBy: actor.by,
    approvedByUsername: actor.username,
    approvedByRole: actor.role,
    contentHash,
    decision: "approve",
    quorum,
    quorumMet: quorum.met,
    movedToClientQueue,
    openThreadWarning,
    ...(opts.note ? { note: opts.note } : {}),
  };
}

export async function runDecline(opts: ReviewDeclineOptions): Promise<ReviewDeclineResult> {
  const projectRoot = await prepareReviewRoot(opts.root);
  const lp = normalizeLogicalPath(opts.logicalPath);
  const actor = await resolveAuditActor(projectRoot, {
    by: opts.by,
    username: opts.username,
    role: opts.role ?? "user",
  });

  const { docPath, contentHash } = await loadDocContentHash(projectRoot, lp);
  const now = new Date().toISOString();

  let approval = await getApproval(projectRoot, lp);
  if (!approval) {
    approval = makeApproval(lp, contentHash, docPath);
  }

  assertCanInternalApprove(approval, lp);

  const vote: ReviewVote = {
    by: actor.by,
    username: actor.username,
    role: actor.role,
    decision: "decline",
    at: now,
    note: opts.note ?? null,
  };

  approval.docPath = docPath;
  approval.contentHash = contentHash;
  approval.internal.votes = upsertVote(approval.internal.votes, vote);
  const quorum = computeQuorum(approval.internal.votes);

  if (quorum.met) {
    approval.internal.status = "approved";
    approval.internal.quorumMetAt = now;
    const { content } = await loadDocContentHash(projectRoot, lp);
    await finalizeInternalQuorum(projectRoot, lp, approval, content, contentHash, docPath, now, actor, quorum);
  }

  approval.lastEventAt = now;
  approval.overallStatus = deriveOverallStatus(approval);
  await saveApproval(projectRoot, approval);
  await appendInternalVoteHistory(projectRoot, lp, vote, contentHash);

  return {
    logicalPath: lp,
    declinedBy: actor.by,
    declinedByUsername: actor.username,
    declinedByRole: actor.role,
    contentHash,
    decision: "decline",
    quorum,
    quorumMet: quorum.met,
    ...(opts.note ? { note: opts.note } : {}),
  };
}

export async function runClose(opts: ReviewCloseOptions): Promise<ReviewCloseResult> {
  const projectRoot = await prepareReviewRoot(opts.root);
  const lp = normalizeLogicalPath(opts.logicalPath);
  const actor = await resolveAuditActor(projectRoot, {
    by: opts.by,
    username: opts.username,
    role: opts.role ?? "user",
  });

  if (!opts.reason?.trim()) {
    throw new Error("close reason is required");
  }

  const { docPath, contentHash } = await loadDocContentHash(projectRoot, lp);

  const approval = await getApproval(projectRoot, lp);
  if (!approval) {
    throw new Error(`No approval record for ${lp}`);
  }

  assertCanInternalClose(approval, lp);
  const quorum = trackQuorum(approval.internal);
  if (quorum.met) {
    throw new Error(`Cannot close ${lp}: internal quorum already met`);
  }

  const now = new Date().toISOString();
  approval.internal.status = "rejected";
  approval.internal.closedAt = now;
  approval.internal.closedBy = actor.by;
  approval.internal.closeReason = opts.reason.trim();
  approval.docPath = docPath;
  approval.contentHash = contentHash;
  approval.lastEventAt = now;
  approval.overallStatus = deriveOverallStatus(approval);
  await saveApproval(projectRoot, approval);

  const entry = await removeFromQueue(projectRoot, "internal", lp);
  if (entry) {
    await archiveQueueEntry(projectRoot, "internal", "rejected", entry);
    await deleteDiff(projectRoot, "internal", lp);
  }

  await appendHistory(projectRoot, lp, {
    event: "internal_closed",
    track: "internal",
    at: now,
    by: actor.by,
    username: actor.username,
    role: actor.role,
    reason: opts.reason.trim(),
    hash: contentHash,
  });

  await clearReviewSession(projectRoot);
  await clearWorkflowActive(projectRoot, "doc-review");

  return {
    logicalPath: lp,
    closedBy: actor.by,
    closedByUsername: actor.username,
    closedByRole: actor.role,
    reason: opts.reason.trim(),
    quorum,
  };
}

export async function runReviewStatus(opts: ReviewStatusOptions): Promise<ReviewStatusResult> {
  const projectRoot = await prepareReviewRoot(opts.root);
  const lp = normalizeLogicalPath(opts.logicalPath);

  const { approval: ensured, reviewKind } = await ensureApprovalForReview(projectRoot, lp);
  const persisted = ensured;

  const approvedContentHash = persisted.contentHash;
  const live = await computeLiveStaleness(projectRoot, persisted, {
    showDiff: opts.showDiff !== false,
  });
  const approval = live.effectiveApproval;
  const kind = reviewKind === "first" && !live.stale ? reviewKind : deriveReviewKind(approval);

  let diff: DiffFile | null = null;
  if (opts.showDiff !== false) {
    // Persisted diff from reconcile takes precedence
    diff = await loadDiff(projectRoot, "internal", lp);
    if (!diff) diff = await loadDiff(projectRoot, "client", lp);
    if (!diff) diff = live.diff;

    // Recompute if missing but already pending internal
    if (!diff && approval.overallStatus === "pending_internal") {
      try {
        const snapshot = await readSnapshot(projectRoot, lp);
        const { absPath: absDocPath } = await resolveReviewDocPath(projectRoot, lp);
        if (snapshot && (await pathExists(absDocPath))) {
          const current = await readFile(absDocPath, "utf8");
          const currentHash = createHash("sha256").update(current).digest("hex").slice(0, 16);
          const diffResult = computeLineDiff(snapshot, current);
          diff = {
            logicalPath: lp,
            approvedHash: approvedContentHash,
            currentHash,
            ...diffResult,
            computedAt: new Date().toISOString(),
          };
          if (!live.stale) {
            await saveDiff(projectRoot, "internal", diff);
          }
        }
      } catch {
        // Doc file not resolvable — skip diff recomputation
      }
    }
  }

  const session = await setReviewSessionPhase(projectRoot, "reviewing", {
    activeLogicalPath: lp,
    reviewStatusAt: new Date().toISOString(),
    contentHashAtReview: approval.contentHash,
    reviewWrittenAt: null,
  });

  let docPath: string | undefined;
  const result: ReviewStatusResult = {
    approval,
    diff,
    internalQuorum: trackQuorum(approval.internal),
    clientQuorum: trackQuorum(approval.client),
    session,
    reviewKind: kind,
    reviewTemplate: reviewTemplateForKind(kind),
    workflowGuidance: buildReviewWorkflowGuidance(approval, {
      stale: live.stale,
      session,
      reviewKind: kind,
    }),
    ...(live.stale ? { stale: true, approvedContentHash } : {}),
  };

  try {
    const docType = docTypeFromLogicalPath(lp);
    if (docType) {
      const resolved = await resolveReviewDocPath(projectRoot, lp);
      docPath = resolved.docPath;
      const [structuralScan, outputChecklist] = await Promise.all([
        runReadinessScan({
          root: projectRoot,
          docType,
          paths: [docPath],
          updateLastScan: false,
        }),
        runReadinessOutputChecklist({
          root: projectRoot,
          docType,
          paths: [docPath],
          logicalPath: lp,
        }),
      ]);
      result.readiness = { docPath, docType, structuralScan, outputChecklist };
      result.docPath = docPath;
    }
  } catch {
    // Readiness config or doc path may be unavailable — review proceeds without checklist
  }

  if (opts.includeHistory) {
    result.history = await readHistory(projectRoot, lp, {
      limit: opts.historyLimit,
      since: opts.historySince,
    });
  }

  return result;
}

export async function runReviewQueue(opts: ReviewQueueOptions): Promise<ReviewQueueResult> {
  const projectRoot = await prepareReviewRoot(opts.root);
  await runReviewDiscovery(projectRoot);
  const session = await setReviewSessionPhase(projectRoot, "queue");
  const track = opts.track ?? "all";

  const [iPending, iResolved, iRejected, iFailed, cPending, cResolved, cRejected] =
    await Promise.all([
      track !== "client" ? loadQueueIndex(projectRoot, "internal", "pending") : Promise.resolve({ version: 1 as const, entries: [] }),
      track !== "client" ? loadQueueIndex(projectRoot, "internal", "resolved") : Promise.resolve({ version: 1 as const, entries: [] }),
      track !== "client" ? loadQueueIndex(projectRoot, "internal", "rejected") : Promise.resolve({ version: 1 as const, entries: [] }),
      track !== "client" ? loadQueueIndex(projectRoot, "internal", "failed") : Promise.resolve({ version: 1 as const, entries: [] }),
      track !== "internal" ? loadQueueIndex(projectRoot, "client", "pending") : Promise.resolve({ version: 1 as const, entries: [] }),
      track !== "internal" ? loadQueueIndex(projectRoot, "client", "resolved") : Promise.resolve({ version: 1 as const, entries: [] }),
      track !== "internal" ? loadQueueIndex(projectRoot, "client", "rejected") : Promise.resolve({ version: 1 as const, entries: [] }),
    ]);

  // Load diffs for pending entries if requested
  const diffs: Record<string, DiffFile | null> = {};
  if (opts.showDiff !== false) {
    const pendingPaths = [
      ...iPending.entries.map((e) => ({ lp: e.logicalPath, t: "internal" as const })),
      ...cPending.entries.map((e) => ({ lp: e.logicalPath, t: "client" as const })),
    ];
    await Promise.all(
      pendingPaths.map(async ({ lp, t }) => {
        diffs[lp] = await loadDiff(projectRoot, t, lp);
      }),
    );
  }

  return {
    internal: {
      pending: iPending.entries,
      resolved: iResolved.entries,
      rejected: iRejected.entries,
      failed: iFailed.entries,
    },
    client: {
      pending: cPending.entries,
      resolved: cResolved.entries,
      rejected: cRejected.entries,
    },
    diffs,
    session,
    workflowGuidance: buildReviewSessionWorkflowGuidance(session, {
      pendingCount: iPending.entries.length,
    }),
  };
}

export async function runReviewList(opts: ReviewListOptions): Promise<ReviewListResult> {
  const projectRoot = await prepareReviewRoot(opts.root);
  const logicalPaths = await discoverApprovals(projectRoot);

  const entries: ReviewListEntry[] = [];

  await Promise.all(
    logicalPaths.map(async (lp) => {
      if (opts.prefix && !lp.startsWith(opts.prefix)) return;
      const persisted = await getApproval(projectRoot, lp);
      if (!persisted) return;

      const live = await computeLiveStaleness(projectRoot, persisted, { showDiff: false });
      const approval = live.effectiveApproval;

      if (opts.status && opts.status !== "all") {
        const filterStatus = opts.status;
        const matchesPersisted = persisted.overallStatus === filterStatus;
        const matchesLive = approval.overallStatus === filterStatus;
        if (!matchesPersisted && !matchesLive) return;
      }

      entries.push({
        logicalPath: lp,
        overallStatus: approval.overallStatus,
        contentHash: approval.contentHash,
        internal: {
          status: approval.internal.status,
          quorum: trackQuorum(approval.internal),
        },
        client: {
          status: approval.client.status,
          quorum: trackQuorum(approval.client),
        },
        ...(live.stale
          ? { stale: true, approvedContentHash: persisted.contentHash }
          : {}),
      });
    }),
  );

  entries.sort((a, b) => a.logicalPath.localeCompare(b.logicalPath));

  return { entries, total: entries.length };
}

export async function runReviewCheck(opts: ReviewCheckOptions): Promise<ReviewCheckResult> {
  const projectRoot = await prepareReviewRoot(opts.root);
  const session = await setReviewSessionPhase(projectRoot, "detect");
  const migration = await ensureReviewQueueMigrated(projectRoot);
  const result = await runReviewDiscovery(projectRoot);
  const guidance = buildReviewSessionWorkflowGuidance(session, {
    pendingCount: result.queued + result.invalidated + result.alreadyPending,
  });
  if (migration?.migrated) {
    return { ...result, migrated: true, session, workflowGuidance: guidance };
  }
  return { ...result, session, workflowGuidance: guidance };
}

export async function runReviewBegin(opts: ReviewBeginOptions): Promise<ReviewBeginResult> {
  const projectRoot = await prepareReviewRoot(opts.root);
  const discovery = await runReviewDiscovery(projectRoot);

  if (!opts.logicalPath) {
    const queue = await runReviewQueue({ root: projectRoot, track: "internal", showDiff: false });
    const session = await setReviewSessionPhase(projectRoot, "queue");
    const pendingTotal = queue.internal.pending.length;
    return {
      discovery: {
        discovered: discovery.discovered,
        queued: discovery.queued,
        updated: discovery.updated,
        alreadyQueued: discovery.alreadyQueued,
        scanned: discovery.scanned,
        invalidated: discovery.invalidated,
        alreadyPending: discovery.alreadyPending,
      },
      queue,
      session,
      workflowGuidance: {
        workflowId: "doc-review",
        phase: "awaiting_internal_review",
        canReviewApprove: false,
        message:
          discovery.discovered === 0
            ? "No reviewable documents on disk — generate or add docs first, then review_begin."
            : `Found ${discovery.discovered} document(s) on disk — ${pendingTotal} pending internal review. Call review_begin with logicalPath to start reviewing one.`,
        nextTools: ["review_begin", "review_status", "review_queue"],
        notTheseTools: ["review_approve", "spec_approve", "task_approve_plan", "comments_resolve"],
        reviewTemplate: "first",
      },
    };
  }

  const status = await runReviewStatus({
    root: projectRoot,
    logicalPath: opts.logicalPath,
    showDiff: opts.showDiff,
    includeHistory: opts.includeHistory,
    historyLimit: opts.historyLimit,
    historySince: opts.historySince,
  });

  return {
    ...status,
    discovery: {
      discovered: discovery.discovered,
      queued: discovery.queued,
      updated: discovery.updated,
      alreadyQueued: discovery.alreadyQueued,
      scanned: discovery.scanned,
      invalidated: discovery.invalidated,
      alreadyPending: discovery.alreadyPending,
    },
  };
}

export async function runReviewReject(opts: ReviewRejectOptions): Promise<ReviewRejectResult> {
  const projectRoot = await prepareReviewRoot(opts.root);
  const lp = normalizeLogicalPath(opts.logicalPath);
  const actor = await resolveAuditActor(projectRoot, {
    by: opts.by,
    username: opts.username,
    role: opts.role ?? "user",
  });

  const entry = await removeFromQueue(projectRoot, "internal", lp);
  if (!entry) {
    return {
      logicalPath: lp,
      rejected: false,
      rejectedBy: actor.by,
      rejectedByUsername: actor.username,
      rejectedByRole: actor.role,
      message: `${lp} is not in the internal review queue`,
    };
  }

  await archiveQueueEntry(projectRoot, "internal", "rejected", entry);
  await deleteDiff(projectRoot, "internal", lp);

  // Reset approval back to approved (dismiss the change) — preserve quorum votes
  const approval = await getApproval(projectRoot, lp);
  if (approval) {
    approval.internal.status = "approved";
    approval.internal.invalidatedAt = null;
    approval.overallStatus = deriveOverallStatus(approval);
    await saveApproval(projectRoot, approval);
  }

  const now = new Date().toISOString();
  await appendHistory(projectRoot, lp, {
    event: "rejected",
    track: "internal",
    at: now,
    by: actor.by,
    username: actor.username,
    role: actor.role,
    reason: opts.reason ?? "dismissed",
  });

  await clearReviewSession(projectRoot);
  await clearWorkflowActive(projectRoot, "doc-review");

  return {
    logicalPath: lp,
    rejected: true,
    rejectedBy: actor.by,
    rejectedByUsername: actor.username,
    rejectedByRole: actor.role,
    message: opts.reason
      ? `Dismissed change for ${lp}: ${opts.reason}`
      : `Dismissed change for ${lp} (no re-approval required)`,
  };
}

export async function runReviewMigrate(opts: ReviewMigrateOptions): Promise<ReviewMigrateResult> {
  const paths = await resolveProjectPaths(opts.root);
  return migrateLegacyReviews(paths.root);
}

export async function runReviewSessionStart(
  opts: ReviewSessionStartOptions = {},
): Promise<ReviewSessionStartResult> {
  const projectRoot = await prepareReviewRoot(opts.root);
  const session = await resetReviewSession(projectRoot);
  await recordWorkflowFromReviewSession(projectRoot, session);
  const guidance = buildReviewSessionWorkflowGuidance(session);
  return {
    session,
    message: "Review session started — phase detect. Run review_check next.",
    workflowGuidance: guidance,
  };
}

export async function runReviewSessionAckReview(
  opts: ReviewSessionAckReviewOptions,
): Promise<ReviewSessionAckReviewResult> {
  const projectRoot = await prepareReviewRoot(opts.root);
  const lp = normalizeLogicalPath(opts.logicalPath);
  const session = await loadReviewSession(projectRoot);

  if (!session) {
    throw new Error(
      `No review session for ${lp}. Call review_begin({ logicalPath: "${lp}" }) to start reviewing.`,
    );
  }
  if (session.activeLogicalPath !== lp) {
    throw new Error(
      `Session tracks ${session.activeLogicalPath ?? "(none)"}, not ${lp}. Call review_begin({ logicalPath: "${lp}" }) first.`,
    );
  }
  if (session.phase !== "reviewing" && session.phase !== "awaiting_decision") {
    throw new Error(
      `Cannot acknowledge review in session phase "${session.phase}". Call review_begin({ logicalPath: "${lp}" }) first.`,
    );
  }

  const updated = await setReviewSessionPhase(projectRoot, "awaiting_decision", {
    reviewWrittenAt: new Date().toISOString(),
  });

  return {
    logicalPath: lp,
    session: updated,
    canReviewApprove: true,
    workflowGuidance: buildReviewSessionWorkflowGuidance(updated),
  };
}
