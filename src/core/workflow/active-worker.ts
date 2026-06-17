import { appendFile, mkdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { pathExists, readJson, writeJson } from "../util/fs.js";
import type { ReviewSessionFile } from "../reviews/types.js";
import type { TaskState } from "../operations/task.js";
import type { WorkflowId } from "./route-intent.js";
import type { WorkflowRouteHandoff } from "./route-intent.js";

const DOC_FLOW_REL = ".ai-spector/.docflow";
const ACTIVE_FILE = "workflow-active.json";
const LOG_FILE = "workflow-log.jsonl";
const MAX_LOG_LINES = 200;

const SKILL_BY_WORKFLOW: Record<WorkflowId, string> = {
  "doc-review": "ai-spector-review",
  "resolve-comments": "ai-spector-resolve-comments",
  "resolve-prototype-comments": "ai-spector-resolve-prototype-comments",
  "generate-srs": "ai-spector-generate-srs",
  "generate-basic-design": "ai-spector-generate-basic-design",
  "generate-detail-design": "ai-spector-generate-detail-design",
  "generate-prototype": "ai-spector-generate-prototype",
  "resolve-task": "ai-spector-resolve-task",
  "task-router": "ai-spector-task",
  "spec-queue": "ai-spector-generate",
  "graph-ops": "ai-spector-graph",
  search: "ai-spector-search",
  "setup-check": "ai-spector-setup",
  course: "ai-spector-course",
  "lang-status": "ai-spector-lang-status",
  "resolve-translation": "ai-spector-resolve-translation",
  "template-import": "ai-spector-template-import",
};

export interface WorkflowActiveContext {
  logicalPath?: string | null;
  taskId?: string;
  commentId?: string;
}

export interface WorkflowActiveFile {
  version: 1;
  workflowId: WorkflowId;
  skill: string;
  phase: string;
  updatedAt: string;
  source: "workflow_route" | "review_session" | "task" | "cleared";
  context?: WorkflowActiveContext;
  displayLabel: string;
}

export interface WorkflowTransitionEntry {
  at: string;
  workflowId: WorkflowId;
  phase: string;
  event: string;
  source: string;
}

export interface WorkflowStatusResult {
  active: WorkflowActiveFile | null;
  recentTransitions: WorkflowTransitionEntry[];
  /** One-line hint for orchestrator status line / chat header */
  statusLine: string;
}

function docflowDir(projectRoot: string): string {
  return join(projectRoot, DOC_FLOW_REL).replace(/\\/g, "/");
}

function activePath(projectRoot: string): string {
  return join(docflowDir(projectRoot), ACTIVE_FILE).replace(/\\/g, "/");
}

function logPath(projectRoot: string): string {
  return join(docflowDir(projectRoot), LOG_FILE).replace(/\\/g, "/");
}

export function formatActiveWorkerLabel(
  workflowId: WorkflowId,
  phase: string,
  context?: WorkflowActiveContext,
): string {
  const detail =
    context?.logicalPath ??
    context?.taskId ??
    context?.commentId ??
    null;
  return detail ? `${workflowId} (${phase} ${detail})` : `${workflowId} (${phase})`;
}

export function buildStatusLine(active: WorkflowActiveFile | null): string {
  if (!active) {
    return "AI Spector — no active worker";
  }
  return `Active worker: ${active.displayLabel}`;
}

async function appendTransition(
  projectRoot: string,
  entry: WorkflowTransitionEntry,
): Promise<void> {
  const path = logPath(projectRoot);
  await mkdir(dirname(path), { recursive: true });
  const line = `${JSON.stringify(entry)}\n`;
  await appendFile(path, line, "utf8");

  try {
    const raw = await readFile(path, "utf8");
    const lines = raw.trim().split("\n").filter(Boolean);
    if (lines.length > MAX_LOG_LINES) {
      const trimmed = lines.slice(-MAX_LOG_LINES).join("\n") + "\n";
      const { writeFile } = await import("node:fs/promises");
      await writeFile(path, trimmed, "utf8");
    }
  } catch {
    // best-effort log trim
  }
}

async function readRecentTransitions(projectRoot: string, limit = 8): Promise<WorkflowTransitionEntry[]> {
  const path = logPath(projectRoot);
  if (!(await pathExists(path))) {
    return [];
  }
  const raw = await readFile(path, "utf8");
  const lines = raw.trim().split("\n").filter(Boolean);
  return lines
    .slice(-limit)
    .map((line) => JSON.parse(line) as WorkflowTransitionEntry)
    .reverse();
}

export async function loadWorkflowActive(projectRoot: string): Promise<WorkflowActiveFile | null> {
  const path = activePath(projectRoot);
  if (!(await pathExists(path))) {
    return null;
  }
  return readJson<WorkflowActiveFile>(path);
}

export async function recordWorkflowActive(
  projectRoot: string,
  patch: {
    workflowId: WorkflowId;
    phase: string;
    source: WorkflowActiveFile["source"];
    context?: WorkflowActiveContext;
    event?: string;
    skill?: string;
  },
): Promise<WorkflowActiveFile> {
  const now = new Date().toISOString();
  const context = patch.context;
  const active: WorkflowActiveFile = {
    version: 1,
    workflowId: patch.workflowId,
    skill: patch.skill ?? SKILL_BY_WORKFLOW[patch.workflowId],
    phase: patch.phase,
    updatedAt: now,
    source: patch.source,
    ...(context ? { context } : {}),
    displayLabel: formatActiveWorkerLabel(patch.workflowId, patch.phase, context),
  };

  const path = activePath(projectRoot);
  await mkdir(dirname(path), { recursive: true });
  await writeJson(path, active);

  await appendTransition(projectRoot, {
    at: now,
    workflowId: patch.workflowId,
    phase: patch.phase,
    event: patch.event ?? "active_updated",
    source: patch.source,
  });

  return active;
}

export async function clearWorkflowActive(
  projectRoot: string,
  workflowId?: WorkflowId,
): Promise<void> {
  const existing = await loadWorkflowActive(projectRoot);
  if (!existing) {
    return;
  }
  if (workflowId && existing.workflowId !== workflowId) {
    return;
  }

  const now = new Date().toISOString();
  await appendTransition(projectRoot, {
    at: now,
    workflowId: existing.workflowId,
    phase: "done",
    event: "cleared",
    source: "cleared",
  });

  const { unlink } = await import("node:fs/promises");
  await unlink(activePath(projectRoot));
}

export async function recordWorkflowFromHandoff(
  projectRoot: string,
  handoff: WorkflowRouteHandoff,
): Promise<WorkflowActiveFile> {
  return recordWorkflowActive(projectRoot, {
    workflowId: handoff.workflowId,
    phase: handoff.phase,
    source: "workflow_route",
    skill: handoff.skill,
    event: "routed",
    context: {
      ...(handoff.context?.activeLogicalPath !== undefined
        ? { logicalPath: handoff.context.activeLogicalPath }
        : {}),
      ...(handoff.context?.activeTaskId ? { taskId: handoff.context.activeTaskId } : {}),
    },
  });
}

export async function recordWorkflowFromReviewSession(
  projectRoot: string,
  session: ReviewSessionFile,
): Promise<WorkflowActiveFile> {
  return recordWorkflowActive(projectRoot, {
    workflowId: "doc-review",
    phase: session.phase,
    source: "review_session",
    event: "session_phase",
    context: { logicalPath: session.activeLogicalPath },
  });
}

export async function recordWorkflowFromTask(
  projectRoot: string,
  task: TaskState,
): Promise<WorkflowActiveFile> {
  const workflowId: WorkflowId =
    task.kind === "resolve"
      ? "resolve-task"
      : task.workflow === "generate-basic-design"
        ? "generate-basic-design"
        : task.workflow === "generate-detail-design"
          ? "generate-detail-design"
          : task.workflow === "generate-prototype"
            ? "generate-prototype"
            : "generate-srs";
  const phase = task.planApprovedAt ? "plan_approved" : task.plan ? "awaiting_plan_approval" : "planning";

  return recordWorkflowActive(projectRoot, {
    workflowId,
    phase,
    source: "task",
    event: "task_state",
    context: { taskId: task.id },
  });
}

export async function runWorkflowStatus(projectRoot: string): Promise<WorkflowStatusResult> {
  const active = await loadWorkflowActive(projectRoot);
  const recentTransitions = await readRecentTransitions(projectRoot);
  return {
    active,
    recentTransitions,
    statusLine: buildStatusLine(active),
  };
}
