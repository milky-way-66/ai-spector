import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { loadDocflowConfig } from "../config/load.js";
import { pathExists, readJson, writeJsonAtomic } from "../util/fs.js";
import { runCheck } from "./check.js";
import { runContextList } from "./context.js";
import type { GoalSpec, TaskPlan } from "./resolve-task.js";
import {
  activeSlotFor,
  defaultNextAction,
  getWorkflowTemplate,
  type TaskKind,
  type WorkflowId,
} from "./task-templates.js";

export type { TaskKind, WorkflowId };
export type { GoalSpec, TaskPlan } from "./resolve-task.js";

export type TaskStatus =
  | "draft"
  | "active"
  | "paused"
  | "blocked"
  | "complete"
  | "abandoned";

export type PhaseStatus = "in_progress" | "awaiting_user" | "done";

export type WorkflowStepStatus =
  | "pending"
  | "in-progress"
  | "done"
  | "blocked"
  | "skipped";

export interface TaskStep {
  id: string;
  phase: string;
  description: string;
  status: WorkflowStepStatus;
  completedAt?: string;
  blocker?: string | null;
  artifacts?: string[];
  openContextIds?: string[];
}

export interface GeneratePlanRow {
  output: string;
  dagNode: string;
  sources: string[];
  keyPoints: string[];
}

export interface GeneratePlanBriefing {
  target: string;
  graphContext?: string;
  dataSourceFiles?: string[];
  contextAnswers?: string[];
  assumptions?: string[];
  template?: string;
  excluded?: string;
}

export interface GeneratePlan {
  docType: string;
  language?: string;
  scope: "all" | "explicit" | "described";
  scopeDetail?: string;
  briefing: GeneratePlanBriefing[];
  rows: GeneratePlanRow[];
  waves?: { wave: number; nodeIds: string[] }[];
}

export type StoredPlan =
  | { kind: "resolve"; plan: TaskPlan }
  | { kind: "generate"; plan: GeneratePlan };

export interface TaskContextRefs {
  docType?: string;
  contextFile?: string;
  planLog?: string | null;
}

export interface TaskSnapshot {
  workspaceCheckAt?: string;
  artifactHashes?: Record<string, string>;
  graphMergedAt?: string;
}

export interface TaskState {
  version: number;
  id: string;
  kind: TaskKind;
  workflow: WorkflowId;
  status: TaskStatus;
  createdAt: string;
  updatedAt: string;
  trigger: string;
  phase: string;
  phaseStatus: PhaseStatus;
  goal: GoalSpec | null;
  plan: StoredPlan | null;
  planApprovedAt: string | null;
  steps: TaskStep[];
  currentStepId: string;
  nextAction: string;
  blockers: string[];
  contextRefs: TaskContextRefs;
  snapshot: TaskSnapshot;
}

export interface TaskIndex {
  version: number;
  active: Record<string, string>;
  recent: string[];
}

const RECENT_MAX = 20;

// ── store paths ───────────────────────────────────────────────────────────────

function tasksDir(root: string): string {
  return join(root, ".ai-spector/.docflow/tasks");
}

export function taskIndexPath(root: string): string {
  return join(tasksDir(root), "index.json");
}

export function taskFilePath(root: string, taskId: string): string {
  return join(tasksDir(root), `${taskId}.json`);
}

export function buildTaskId(): string {
  return `task-${Date.now().toString(36)}`;
}

async function resolveRoot(root?: string): Promise<string> {
  const loaded = await loadDocflowConfig(root ? resolve(root) : undefined);
  return loaded.root;
}

async function loadIndex(root: string): Promise<TaskIndex> {
  const path = taskIndexPath(root);
  if (await pathExists(path)) {
    return readJson<TaskIndex>(path);
  }
  return { version: 1, active: {}, recent: [] };
}

async function saveIndex(root: string, index: TaskIndex): Promise<void> {
  const path = taskIndexPath(root);
  await writeJsonAtomic(path, index);
}

async function loadTask(root: string, taskId: string): Promise<TaskState> {
  const path = taskFilePath(root, taskId);
  if (!(await pathExists(path))) {
    throw new Error(`Task "${taskId}" not found`);
  }
  return readJson<TaskState>(path);
}

async function saveTask(root: string, task: TaskState): Promise<string> {
  const path = taskFilePath(root, task.id);
  await writeJsonAtomic(path, task);
  return path;
}

function touchTask(task: TaskState): void {
  task.updatedAt = new Date().toISOString();
}

function pushRecent(index: TaskIndex, taskId: string): void {
  index.recent = [taskId, ...index.recent.filter((id) => id !== taskId)].slice(0, RECENT_MAX);
}

function stepsFromTemplate(workflow: WorkflowId): TaskStep[] {
  return getWorkflowTemplate(workflow).steps.map((s) => ({
    id: s.id,
    phase: s.phase,
    description: s.description,
    status: "pending" as const,
    blocker: null,
    artifacts: [],
  }));
}

function parseTask(raw: TaskState): TaskState {
  return {
    ...raw,
    version: raw.version ?? 1,
    goal: raw.goal ?? null,
    plan: raw.plan ?? null,
    planApprovedAt: raw.planApprovedAt ?? null,
    blockers: raw.blockers ?? [],
    contextRefs: raw.contextRefs ?? {},
    snapshot: raw.snapshot ?? {},
    steps: raw.steps ?? [],
  };
}

// ── create ────────────────────────────────────────────────────────────────────

export interface TaskCreateOptions {
  root?: string;
  kind: TaskKind;
  workflow: WorkflowId;
  trigger: string;
  docType?: string;
  /** Replace an existing active task in the same slot (marks it abandoned). */
  force?: boolean;
}

export interface TaskCreateResult {
  task: TaskState;
  taskPath: string;
  replacedTaskId?: string;
}

export async function runTaskCreate(opts: TaskCreateOptions): Promise<TaskCreateResult> {
  if (!opts.trigger?.trim()) throw new Error("trigger is required");

  const template = getWorkflowTemplate(opts.workflow);
  if (template.kind !== opts.kind) {
    throw new Error(`Workflow "${opts.workflow}" is kind "${template.kind}", not "${opts.kind}"`);
  }

  const root = await resolveRoot(opts.root);
  const index = await loadIndex(root);
  const slot = activeSlotFor(opts.kind, opts.workflow);

  let replacedTaskId: string | undefined;
  const existingId = index.active[slot];
  if (existingId) {
    if (!opts.force) {
      throw new Error(
        `Active task already exists for slot "${slot}" (${existingId}). Pass force:true to replace it.`,
      );
    }
    try {
      const existing = await loadTask(root, existingId);
      if (existing.status !== "complete" && existing.status !== "abandoned") {
        existing.status = "abandoned";
        touchTask(existing);
        await saveTask(root, existing);
        replacedTaskId = existingId;
      }
    } catch {
      // stale index entry — overwrite below
    }
  }

  const now = new Date().toISOString();
  const steps = stepsFromTemplate(opts.workflow);
  const first = steps[0]!;
  first.status = "in-progress";

  const task: TaskState = {
    version: 1,
    id: buildTaskId(),
    kind: opts.kind,
    workflow: opts.workflow,
    status: "active",
    createdAt: now,
    updatedAt: now,
    trigger: opts.trigger.trim(),
    phase: first.phase,
    phaseStatus: "in_progress",
    goal: null,
    plan: null,
    planApprovedAt: null,
    steps,
    currentStepId: first.id,
    nextAction: defaultNextAction(opts.workflow, first.id),
    blockers: [],
    contextRefs: opts.docType
      ? { docType: opts.docType, contextFile: `context/${opts.docType}.json` }
      : {},
    snapshot: {},
  };

  const taskPath = await saveTask(root, task);
  index.active[slot] = task.id;
  pushRecent(index, task.id);
  await saveIndex(root, index);

  return { task, taskPath, replacedTaskId };
}

// ── get / list ────────────────────────────────────────────────────────────────

export interface TaskGetOptions {
  root?: string;
  taskId: string;
}

export interface TaskGetResult {
  task: TaskState;
  taskPath: string;
}

export async function runTaskGet(opts: TaskGetOptions): Promise<TaskGetResult> {
  const root = await resolveRoot(opts.root);
  const task = parseTask(await loadTask(root, opts.taskId));
  return { task, taskPath: taskFilePath(root, opts.taskId) };
}

export interface TaskListOptions {
  root?: string;
  status?: TaskStatus | TaskStatus[];
  kind?: TaskKind;
  workflow?: WorkflowId;
  /** Include only tasks listed in index.recent (default: scan all task files). */
  recentOnly?: boolean;
}

export interface TaskListResult {
  tasks: TaskState[];
  total: number;
  index: TaskIndex;
}

export async function runTaskList(opts: TaskListOptions = {}): Promise<TaskListResult> {
  const root = await resolveRoot(opts.root);
  const index = await loadIndex(root);
  const dir = tasksDir(root);

  let ids: string[] = [];
  if (opts.recentOnly) {
    ids = [...index.recent];
  } else if (await pathExists(dir)) {
    ids = (await readdir(dir))
      .filter((f) => f.endsWith(".json") && f !== "index.json")
      .map((f) => f.slice(0, -".json".length));
  } else {
    ids = [...index.recent];
  }

  const statuses = opts.status
    ? Array.isArray(opts.status)
      ? opts.status
      : [opts.status]
    : undefined;

  const tasks: TaskState[] = [];
  for (const id of ids) {
    try {
      const task = parseTask(await loadTask(root, id));
      if (statuses && !statuses.includes(task.status)) continue;
      if (opts.kind && task.kind !== opts.kind) continue;
      if (opts.workflow && task.workflow !== opts.workflow) continue;
      tasks.push(task);
    } catch {
      // skip missing/corrupt files
    }
  }

  tasks.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return { tasks, total: tasks.length, index };
}

// ── update ────────────────────────────────────────────────────────────────────

export interface TaskStepPatch {
  status?: WorkflowStepStatus;
  completedAt?: string;
  blocker?: string | null;
  artifacts?: string[];
  openContextIds?: string[];
}

export interface TaskUpdatePatch {
  status?: TaskStatus;
  phase?: string;
  phaseStatus?: PhaseStatus;
  currentStepId?: string;
  nextAction?: string;
  goal?: GoalSpec | null;
  plan?: StoredPlan | null;
  blockers?: string[];
  contextRefs?: Partial<TaskContextRefs>;
  snapshot?: Partial<TaskSnapshot>;
  step?: { id: string; patch: TaskStepPatch };
}

export interface TaskUpdateOptions {
  root?: string;
  taskId: string;
  patch: TaskUpdatePatch;
}

export interface TaskUpdateResult {
  task: TaskState;
  taskPath: string;
}

function applyStepPatch(task: TaskState, stepId: string, patch: TaskStepPatch): void {
  const step = task.steps.find((s) => s.id === stepId);
  if (!step) {
    throw new Error(`No step "${stepId}" in task "${task.id}"`);
  }
  if (patch.status !== undefined) step.status = patch.status;
  if (patch.completedAt !== undefined) step.completedAt = patch.completedAt;
  if (patch.blocker !== undefined) step.blocker = patch.blocker;
  if (patch.artifacts !== undefined) step.artifacts = patch.artifacts;
  if (patch.openContextIds !== undefined) step.openContextIds = patch.openContextIds;
}

export async function runTaskUpdate(opts: TaskUpdateOptions): Promise<TaskUpdateResult> {
  const root = await resolveRoot(opts.root);
  const task = parseTask(await loadTask(root, opts.taskId));
  const { patch } = opts;

  if (patch.status !== undefined) task.status = patch.status;
  if (patch.phase !== undefined) task.phase = patch.phase;
  if (patch.phaseStatus !== undefined) task.phaseStatus = patch.phaseStatus;
  if (patch.currentStepId !== undefined) task.currentStepId = patch.currentStepId;
  if (patch.nextAction !== undefined) task.nextAction = patch.nextAction;
  if (patch.goal !== undefined) task.goal = patch.goal;
  if (patch.plan !== undefined) task.plan = patch.plan;
  if (patch.blockers !== undefined) task.blockers = patch.blockers;
  if (patch.contextRefs) {
    task.contextRefs = { ...task.contextRefs, ...patch.contextRefs };
  }
  if (patch.snapshot) {
    task.snapshot = { ...task.snapshot, ...patch.snapshot };
  }
  if (patch.step) {
    applyStepPatch(task, patch.step.id, patch.step.patch);
    if (patch.step.patch.status === "done" && patch.step.patch.artifacts?.length) {
      const hashes = { ...(task.snapshot.artifactHashes ?? {}) };
      for (const rel of patch.step.patch.artifacts) {
        try {
          const buf = await readFile(join(root, rel));
          hashes[rel] = `sha256:${createHash("sha256").update(buf).digest("hex")}`;
        } catch {
          // file missing — resume will report drift
        }
      }
      task.snapshot.artifactHashes = hashes;
    }
  }

  touchTask(task);
  const taskPath = await saveTask(root, task);

  const index = await loadIndex(root);
  pushRecent(index, task.id);
  await saveIndex(root, index);

  return { task, taskPath };
}

// ── approve plan ──────────────────────────────────────────────────────────────

export interface TaskApprovePlanOptions {
  root?: string;
  taskId: string;
  plan?: StoredPlan;
}

export interface TaskApprovePlanResult {
  task: TaskState;
  taskPath: string;
}

export async function runTaskApprovePlan(
  opts: TaskApprovePlanOptions,
): Promise<TaskApprovePlanResult> {
  const root = await resolveRoot(opts.root);
  const task = parseTask(await loadTask(root, opts.taskId));

  if (opts.plan) {
    task.plan = opts.plan;
  }
  if (!task.plan) {
    throw new Error(`Task "${task.id}" has no plan to approve`);
  }

  const now = new Date().toISOString();
  task.planApprovedAt = now;
  task.phaseStatus = "done";

  const planIndex = task.steps.findIndex((s) => s.id === "plan");
  if (planIndex >= 0) {
    const planStep = task.steps[planIndex]!;
    planStep.status = "done";
    planStep.completedAt = now;
    planStep.blocker = null;
  }

  const nextStep =
    planIndex >= 0
      ? task.steps.slice(planIndex + 1).find((s) => s.status !== "done" && s.status !== "skipped")
      : task.steps.find((s) => s.status === "pending");
  if (nextStep) {
    nextStep.status = "in-progress";
    task.currentStepId = nextStep.id;
    task.phase = nextStep.phase;
    task.phaseStatus = "in_progress";
    task.nextAction = defaultNextAction(task.workflow, nextStep.id);
  }

  if (task.status === "blocked") {
    task.status = "active";
    task.blockers = [];
  }

  const logPath = await writePlanAuditLog(root, task, now);
  if (logPath) {
    task.contextRefs = { ...task.contextRefs, planLog: logPath };
  }

  touchTask(task);
  const taskPath = await saveTask(root, task);
  return { task, taskPath };
}

async function writePlanAuditLog(
  root: string,
  task: TaskState,
  approvedAt: string,
): Promise<string | undefined> {
  if (!task.plan) return undefined;
  const docType =
    task.plan.kind === "generate"
      ? task.plan.plan.docType
      : (task.contextRefs.docType ?? "resolve");
  const rel = `.ai-spector/.docflow/logs/plan-${docType}-${Date.now()}.json`;
  const abs = join(root, rel);
  await writeJsonAtomic(abs, {
    version: 1,
    taskId: task.id,
    workflow: task.workflow,
    approvedAt,
    plan: task.plan,
    goal: task.goal,
  });
  return rel;
}

// ── resume ────────────────────────────────────────────────────────────────────

export type ArtifactDriftKind = "modified" | "deleted" | "added";

export interface ArtifactDrift {
  path: string;
  kind: ArtifactDriftKind;
}

export interface TaskResumeOptions {
  root?: string;
  taskId: string;
}

export interface TaskResumeResult {
  task: TaskState;
  taskPath: string;
  drift: ArtifactDrift[];
  staleContextIds: string[];
  blockers: string[];
  suggestedNext: string;
  canContinue: boolean;
  workspaceOk: boolean;
}

async function hashFile(root: string, rel: string): Promise<string | undefined> {
  try {
    const buf = await readFile(join(root, rel));
    return `sha256:${createHash("sha256").update(buf).digest("hex")}`;
  } catch {
    return undefined;
  }
}

function collectStepArtifacts(task: TaskState): string[] {
  const paths = new Set<string>();
  for (const step of task.steps) {
    for (const a of step.artifacts ?? []) {
      paths.add(a);
    }
  }
  for (const rel of Object.keys(task.snapshot.artifactHashes ?? {})) {
    paths.add(rel);
  }
  return [...paths];
}

async function computeFullDrift(root: string, task: TaskState): Promise<ArtifactDrift[]> {
  const drift: ArtifactDrift[] = [];
  const prev = task.snapshot.artifactHashes ?? {};
  const allPaths = collectStepArtifacts(task);

  for (const rel of allPaths) {
    const oldHash = prev[rel];
    const current = await hashFile(root, rel);
    if (oldHash) {
      if (!current) drift.push({ path: rel, kind: "deleted" });
      else if (current !== oldHash) drift.push({ path: rel, kind: "modified" });
    } else if (current) {
      drift.push({ path: rel, kind: "added" });
    }
  }
  return drift;
}

export async function runTaskResume(opts: TaskResumeOptions): Promise<TaskResumeResult> {
  const root = await resolveRoot(opts.root);
  const task = parseTask(await loadTask(root, opts.taskId));

  if (task.status === "complete" || task.status === "abandoned") {
    throw new Error(`Cannot resume task in status "${task.status}"`);
  }

  const check = await runCheck({ root });
  const drift = await computeFullDrift(root, task);

  const staleContextIds: string[] = [];
  const docType = task.contextRefs.docType;
  if (docType) {
    const ctx = await runContextList({ root, docType, status: "stale" });
    for (const store of ctx.stores) {
      for (const e of store.entries) {
        staleContextIds.push(e.id);
      }
    }
  }

  const blockers: string[] = [...task.blockers];
  if (!check.ok) {
    blockers.push(
      `Workspace check failed (${check.findings.filter((f) => f.severity === "error").length} error(s)) — run workspace_check or npx ai-spector check`,
    );
  }
  if (drift.length > 0) {
    blockers.push(
      `${drift.length} artifact(s) changed since last snapshot — confirm with user before continuing`,
    );
  }
  if (staleContextIds.length > 0) {
    blockers.push(
      `Stale clarifications: ${staleContextIds.join(", ")} — re-confirm before continuing`,
    );
  }

  const canContinue = check.ok && blockers.length === 0;

  if (task.status === "paused" && canContinue) {
    task.status = "active";
    touchTask(task);
    await saveTask(root, task);
  }

  const suggestedNext = canContinue
    ? task.nextAction || defaultNextAction(task.workflow, task.currentStepId)
    : blockers[0] ?? "Resolve blockers before continuing";

  return {
    task,
    taskPath: taskFilePath(root, task.id),
    drift,
    staleContextIds,
    blockers,
    suggestedNext,
    canContinue,
    workspaceOk: check.ok,
  };
}

// ── pause / complete / abandon ──────────────────────────────────────────────────

export interface TaskPauseOptions {
  root?: string;
  taskId: string;
}

export interface TaskPauseResult {
  task: TaskState;
  taskPath: string;
}

export async function runTaskPause(opts: TaskPauseOptions): Promise<TaskPauseResult> {
  const root = await resolveRoot(opts.root);
  const task = parseTask(await loadTask(root, opts.taskId));
  if (task.status === "complete" || task.status === "abandoned") {
    throw new Error(`Cannot pause task in status "${task.status}"`);
  }
  task.status = "paused";
  touchTask(task);
  const taskPath = await saveTask(root, task);
  return { task, taskPath };
}

export interface TaskCompleteOptions {
  root?: string;
  taskId: string;
  summary?: string;
}

export interface TaskCompleteResult {
  task: TaskState;
  taskPath: string;
}

export async function runTaskComplete(opts: TaskCompleteOptions): Promise<TaskCompleteResult> {
  const root = await resolveRoot(opts.root);
  const task = parseTask(await loadTask(root, opts.taskId));
  const now = new Date().toISOString();

  task.status = "complete";
  task.phaseStatus = "done";
  for (const step of task.steps) {
    if (step.status === "pending" || step.status === "in-progress") {
      step.status = "skipped";
    }
  }
  if (opts.summary) {
    task.nextAction = opts.summary;
  } else {
    task.nextAction = "Task complete";
  }

  touchTask(task);
  const taskPath = await saveTask(root, task);

  const index = await loadIndex(root);
  const slot = activeSlotFor(task.kind, task.workflow);
  if (index.active[slot] === task.id) {
    delete index.active[slot];
  }
  pushRecent(index, task.id);
  await saveIndex(root, index);

  return { task, taskPath };
}

export interface TaskAbandonOptions {
  root?: string;
  taskId: string;
  reason?: string;
}

export interface TaskAbandonResult {
  task: TaskState;
  taskPath: string;
}

export async function runTaskAbandon(opts: TaskAbandonOptions): Promise<TaskAbandonResult> {
  const root = await resolveRoot(opts.root);
  const task = parseTask(await loadTask(root, opts.taskId));

  task.status = "abandoned";
  if (opts.reason) {
    task.blockers = [...task.blockers, opts.reason];
    task.nextAction = opts.reason;
  } else {
    task.nextAction = "Task abandoned";
  }

  touchTask(task);
  const taskPath = await saveTask(root, task);

  const index = await loadIndex(root);
  const slot = activeSlotFor(task.kind, task.workflow);
  if (index.active[slot] === task.id) {
    delete index.active[slot];
  }
  pushRecent(index, task.id);
  await saveIndex(root, index);

  return { task, taskPath };
}
