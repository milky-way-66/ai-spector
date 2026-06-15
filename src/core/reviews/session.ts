import { unlink } from "node:fs/promises";
import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { pathExists, readJson, writeJson } from "../util/fs.js";
import { ReviewPreconditionError } from "./errors.js";
import { reviewQueuePaths } from "./paths.js";
import { recordWorkflowFromReviewSession } from "../workflow/active-worker.js";
import type { ReviewSessionFile, ReviewSessionPhase } from "./types.js";

function newSession(): ReviewSessionFile {
  const now = new Date().toISOString();
  return {
    version: 1,
    startedAt: now,
    updatedAt: now,
    phase: "detect",
    activeLogicalPath: null,
    reviewStatusAt: null,
    reviewWrittenAt: null,
    contentHashAtReview: null,
  };
}

export async function loadReviewSession(projectRoot: string): Promise<ReviewSessionFile | null> {
  const sessionPath = reviewQueuePaths(projectRoot).session;
  if (!(await pathExists(sessionPath))) {
    return null;
  }
  return readJson<ReviewSessionFile>(sessionPath);
}

export async function saveReviewSession(
  projectRoot: string,
  session: ReviewSessionFile,
): Promise<void> {
  const sessionPath = reviewQueuePaths(projectRoot).session;
  await mkdir(dirname(sessionPath), { recursive: true });
  session.updatedAt = new Date().toISOString();
  await writeJson(sessionPath, session);
}

export async function ensureReviewSession(projectRoot: string): Promise<ReviewSessionFile> {
  const existing = await loadReviewSession(projectRoot);
  if (existing) {
    return existing;
  }
  const session = newSession();
  await saveReviewSession(projectRoot, session);
  return session;
}

export async function resetReviewSession(projectRoot: string): Promise<ReviewSessionFile> {
  const session = newSession();
  await saveReviewSession(projectRoot, session);
  return session;
}

export async function clearReviewSession(projectRoot: string): Promise<void> {
  const sessionPath = reviewQueuePaths(projectRoot).session;
  if (await pathExists(sessionPath)) {
    await unlink(sessionPath);
  }
}

export async function setReviewSessionPhase(
  projectRoot: string,
  phase: ReviewSessionPhase,
  patch: Partial<
    Pick<
      ReviewSessionFile,
      "activeLogicalPath" | "reviewStatusAt" | "reviewWrittenAt" | "contentHashAtReview"
    >
  > = {},
): Promise<ReviewSessionFile> {
  const session = await ensureReviewSession(projectRoot);
  session.phase = phase;
  if ("activeLogicalPath" in patch) session.activeLogicalPath = patch.activeLogicalPath ?? null;
  if ("reviewStatusAt" in patch) session.reviewStatusAt = patch.reviewStatusAt ?? null;
  if ("reviewWrittenAt" in patch) session.reviewWrittenAt = patch.reviewWrittenAt ?? null;
  if ("contentHashAtReview" in patch) {
    session.contentHashAtReview = patch.contentHashAtReview ?? null;
  }
  await saveReviewSession(projectRoot, session);
  await recordWorkflowFromReviewSession(projectRoot, session);
  return session;
}

const SESSION_GATE_TOOLS = [
  "review_session_start",
  "review_status",
  "review_session_ack_review",
] as const;

function sessionPhaseHint(session: ReviewSessionFile): string {
  switch (session.phase) {
    case "detect":
      return "Run review_check and review_queue, pick a document, then review_status.";
    case "queue":
      return "Pick a document from the queue, then call review_status for that logicalPath.";
    case "reviewing":
      return "Write the structured review summary in chat, then call review_session_ack_review.";
    case "done":
      return "Start a new review with review_session_start or review_check.";
    default:
      return "Follow the ai-spector-review runbook phases in order.";
  }
}

/** Gate review_approve on persisted session state (Phase 3 deterministic checkpoint). */
export function assertReviewSessionAllowsApprove(
  session: ReviewSessionFile | null,
  logicalPath: string,
  contentHash: string,
): void {
  const notThese = ["spec_approve", "task_approve_plan", "comments_resolve"];

  if (!session) {
    throw new ReviewPreconditionError(
      "session_not_ready",
      `Cannot sign off ${logicalPath}: no active review session.`,
      "Start review_check (or review_session_start), call review_status for this document, write a review summary, then review_session_ack_review before review_approve.",
      [...SESSION_GATE_TOOLS, ...notThese],
      logicalPath,
      undefined,
      undefined,
      "Let's start a review session first — I'll scan the queue, read the document, and write a summary before you can approve.",
    );
  }

  if (session.activeLogicalPath !== logicalPath) {
    throw new ReviewPreconditionError(
      "session_not_ready",
      `Cannot sign off ${logicalPath}: session is tracking ${session.activeLogicalPath ?? "(none)"}.`,
      "Call review_status for the document you want to approve, then review_session_ack_review.",
      ["review_status", "review_session_ack_review", ...notThese],
      logicalPath,
      undefined,
      session.phase,
      session.activeLogicalPath
        ? `We're reviewing ${session.activeLogicalPath} right now. Say if you want to switch to ${logicalPath} instead.`
        : undefined,
    );
  }

  if (session.phase !== "awaiting_decision" || !session.reviewWrittenAt) {
    throw new ReviewPreconditionError(
      "session_not_ready",
      `Cannot sign off ${logicalPath}: review session phase is "${session.phase}" (review summary not acknowledged).`,
      sessionPhaseHint(session),
      ["review_session_ack_review", "review_status", ...notThese],
      logicalPath,
      undefined,
      session.phase,
      session.phase === "reviewing"
        ? `I'm still writing the review summary for ${logicalPath}. I'll ask for your decision when it's ready.`
        : undefined,
    );
  }

  if (session.contentHashAtReview && session.contentHashAtReview !== contentHash) {
    throw new ReviewPreconditionError(
      "session_content_changed",
      `Cannot sign off ${logicalPath}: document content changed since review_status.`,
      "Re-run review_status for the new content, rewrite the review summary, then review_session_ack_review.",
      ["review_status", "review_session_ack_review", ...notThese],
      logicalPath,
      undefined,
      session.phase,
    );
  }
}
