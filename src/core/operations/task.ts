import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { loadDocflowConfig } from "../config/load.js";
import { pathExists, readJson, writeJsonAtomic } from "../util/fs.js";
import { runCheck } from "./check.js";
import { runContextList } from "./context.js";
import type { GoalSpec, TaskPlan, TaskStepStatus } from "./resolve-task.js";
import {
  activeSlotFor,
  defaultNextAction,
  getWorkflowTemplate,
  type TaskKind,
  type WorkflowId,
} from "./task-templates.js";
import {
  buildTaskWorkflowGuidance,
  buildTaskApprovePlanWorkflowGuidance,
  buildTaskListWorkflowGuidance,
  type WorkflowToolGuidance,
} from "../workflow/guidance.js";
import { recordWorkflowFromTask } from "../workflow/active-worker.js";
import { resolveAuditActor } from "../util/audit-actor.js";
import {
  validateDeriveBootstrap,
  assertDeriveNotBlockedByCompleteSrs,
  type DeriveLayer,
  type DerivePhase,
  type SourceMode,
} from "./derive.js";
import { probeLifecycleSignals, readLifecycle } from "../docops/lifecycle.js";
import {
  assertGenerateExecutionAllowed,
  assertResolveExecutionAllowed,
  assertGeneratePlanStoreAllowed,
  assertTaskApprovePlanAllowed,
  assertTaskStepUpdateAllowed,
  effectiveResolveTier,
} from "./task-gates.js";
import {
  assertTaskApproveImportPlanAllowed,
  assertTaskApprovePackDesignAllowed,
} from "./template-import-gates.js";
import {
  assertTaskApproveAdoptPlanAllowed,
} from "./adopt-gates.js";
import { buildAdoptPlanSummary } from "./adopt-plan.js";
import { approveAdoptPlan } from "../adopt/plan.js";
import type { AdoptScanResult } from "../adopt/types.js";
import { adoptArtifactPaths } from "../adopt/paths.js";

export type { TaskKind, WorkflowId };
import type { ImportPlan } from "./import-plan.js";
import type { AdoptPlanSummary } from "./adopt-plan.js";
export type { ImportPlan, ImportManifestRow } from "./import-plan.js";
export type { AdoptPlanSummary } from "./adopt-plan.js";

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
  /** Readiness criterion ids this output will address (from readiness_assess), e.g. §1-001, G-003 */
  criteriaIds?: string[];
  /** ISO/IEC/IEEE 29148 section refs for this output, e.g. 9.6.2, 9.6.4 */
  isoRefs?: string[];
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
  | { kind: "generate"; plan: GeneratePlan }
  | { kind: "import"; plan: ImportPlan }
  | { kind: "adopt"; plan: AdoptPlanSummary };

export interface TaskContextRefs {
  docType?: string;
  contextFile?: string;
  planLog?: string | null;
  /** Spec review queue for stage 6 extract, e.g. extracted/srs.json */
  extractedFile?: string;
}

export interface BuildGeneratePlanOptions {
  docType: string;
  language?: string;
  scope: GeneratePlan["scope"];
  scopeDetail?: string;
  briefing: GeneratePlanBriefing[];
  rows: GeneratePlanRow[];
  waves?: GeneratePlan["waves"];
}

/** Build a generate-task plan from briefing + plan table rows (+ optional wave assignments). */
export function buildGeneratePlan(opts: BuildGeneratePlanOptions): GeneratePlan {
  return {
    docType: opts.docType,
    language: opts.language,
    scope: opts.scope,
    scopeDetail: opts.scopeDetail,
    briefing: opts.briefing,
    rows: opts.rows,
    waves: opts.waves,
  };
}

function expandGenerateWaveSteps(task: TaskState, plan: GeneratePlan): void {
  const placeholderIndex = task.steps.findIndex((s) => s.id === "generate-waves");
  if (placeholderIndex < 0) return;

  const waveSteps: TaskStep[] =
    plan.waves && plan.waves.length > 0
      ? plan.waves.map((w) => ({
          id: `wave-${w.wave}`,
          phase: "generate",
          description: `Generate wave ${w.wave} (${w.nodeIds.join(", ")})`,
          status: "pending" as const,
          blocker: null,
          artifacts: [],
        }))
      : [
          {
            id: "wave-1",
            phase: "generate",
            description: "Generate documents in DAG waves",
            status: "pending" as const,
            blocker: null,
            artifacts: [],
          },
        ];

  task.steps.splice(placeholderIndex, 1, ...waveSteps);
}

export type ResolveTier = "fast" | "standard" | "full";
export type ResolveExecutionMode = "inline" | "subagent";

export interface TaskSnapshot {
  workspaceCheckAt?: string;
  artifactHashes?: Record<string, string>;
  graphMergedAt?: string;
  /** Set when the full readiness criteria table was shown to the user (clarify gate). */
  readinessReportShown?: boolean;
  /** Set when user confirmed the per-file context briefing (briefing gate). */
  briefingConfirmedAt?: string;
  /** Greenfield first generate — shorten clarify to readiness summary + blockingGaps. */
  greenfieldBootstrap?: boolean;
  /** Set after presenting readiness_assess summary (blockingGaps) on greenfield bootstrap. */
  readinessSummaryAcknowledged?: boolean;
  /** Set when the plan table was shown in chat and phaseStatus is awaiting_user. */
  planPresentedAt?: string;
  /** Set when extract stage offered spec_record to the user (extract gate before task_complete). */
  extractOffered?: boolean;
  /** Set when docs were migrated via adopt workflow (not generate). */
  adoptedAt?: string;
  /** Resolve-task tier confirmed with user (fast / standard / full). */
  resolveTier?: ResolveTier;
  tierConfirmedAt?: string;
  /** Full tier: path to approved design spec under docs/superpowers/specs/. */
  designSpecPath?: string;
  designSpecApprovedAt?: string;
  /** Standard/Full tier: path to bite-sized plan under docs/superpowers/plans/. */
  implementationPlanPath?: string;
  /** Standard/Full tier: inline or subagent execution after plan approval. */
  executionMode?: ResolveExecutionMode;
  /** Import task — pack design spec under docs/superpowers/specs/ */
  packDesignSpecPath?: string;
  packDesignSpecApprovedAt?: string;
  importPlanPath?: string;
  scanResultHash?: string;
  scanConfirmedAt?: string;
  manifestPlanPresentedAt?: string;
  manifestPlanApprovedAt?: string;
  skillBriefingConfirmedAt?: string;
  stagedSkillPath?: string;
  contextMapResolvedAt?: string;
  readinessReviewedAt?: string;
  packValidateReadyAt?: string;
  /** Import clarify — aspect coverage confirmed */
  aspectCoverageConfirmedAt?: string;
  /** Adopt task — first successful adopt_scan during clarify */
  adoptScanAt?: string;
  /** Adopt task — all blocking scan questions resolved */
  adoptClarifyCompleteAt?: string;
  /** Adopt task — move mapping table presented in chat */
  adoptPlanPresentedAt?: string;
  /** Adopt task — adopt_apply succeeded */
  adoptApplyAt?: string;
  /** Adopt task — adopt_bootstrap succeeded */
  adoptBootstrapAt?: string;
  /** Adopt task — adopt_validate ready */
  adoptValidateReadyAt?: string;
  /** Adopt task — handed off to template-import */
  adoptForkedToImportAt?: string;
  /** Generate task — forward (default) or derive from downstream docs */
  sourceMode?: SourceMode;
  deriveFrom?: DeriveLayer[];
  derivePhase?: DerivePhase;
  priorDeriveTaskId?: string;
  /** Set when extract pass completes and expand pass is offered */
  deriveExpandOfferedAt?: string;
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

/** Active in-flight task for a workflow slot (e.g. `import`, `resolve`). */
export async function getActiveTaskForSlot(root: string, slot: string): Promise<TaskState | null> {
  const index = await loadIndex(root);
  const taskId = index.active[slot];
  if (!taskId) return null;
  try {
    const task = parseTask(await loadTask(root, taskId));
    if (task.status === "complete" || task.status === "abandoned") return null;
    return task;
  } catch {
    return null;
  }
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

async function assertExpandDeriveAllowed(root: string, priorTaskId: string): Promise<void> {
  const task = parseTask(await loadTask(root, priorTaskId));
  if (task.status !== "complete") {
    throw new Error(
      `priorDeriveTaskId ${priorTaskId} is not complete — finish extract pass before expand`,
    );
  }
  if (task.snapshot.sourceMode !== "derive-downstream") {
    throw new Error(`priorDeriveTaskId ${priorTaskId} was not a derive-downstream task`);
  }
  if (task.snapshot.derivePhase !== "extract") {
    throw new Error(`priorDeriveTaskId ${priorTaskId} must be an extract pass task`);
  }
}

export interface TaskCreateOptions {
  root?: string;
  kind: TaskKind;
  workflow: WorkflowId;
  trigger: string;
  docType?: string;
  /** Replace an existing active task in the same slot (marks it abandoned). */
  force?: boolean;
  sourceMode?: SourceMode;
  deriveFrom?: DeriveLayer[];
  derivePhase?: DerivePhase;
  priorDeriveTaskId?: string;
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
  const slot = activeSlotFor(opts.kind, opts.workflow, opts.docType);

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

  const derive = validateDeriveBootstrap({
    sourceMode: opts.sourceMode,
    workflow: opts.workflow,
    deriveFrom: opts.deriveFrom,
    derivePhase: opts.derivePhase,
    priorDeriveTaskId: opts.priorDeriveTaskId,
  });

  if (derive.sourceMode === "derive-downstream") {
    await assertDeriveNotBlockedByCompleteSrs(root, opts.workflow);
  }

  if (derive.derivePhase === "expand" && derive.priorDeriveTaskId) {
    await assertExpandDeriveAllowed(root, derive.priorDeriveTaskId);
  }

  const now = new Date().toISOString();
  const steps = stepsFromTemplate(opts.workflow);
  const first = steps[0]!;
  first.status = "in-progress";

  const greenfieldBootstrap = await detectGreenfieldBootstrap(root, opts.kind);

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
    snapshot: {
      sourceMode: derive.sourceMode,
      ...(derive.deriveFrom ? { deriveFrom: derive.deriveFrom } : {}),
      derivePhase: derive.derivePhase,
      ...(derive.priorDeriveTaskId ? { priorDeriveTaskId: derive.priorDeriveTaskId } : {}),
      ...(greenfieldBootstrap ? { greenfieldBootstrap: true } : {}),
    },
  };

  const taskPath = await saveTask(root, task);
  index.active[slot] = task.id;
  pushRecent(index, task.id);
  await saveIndex(root, index);

  return { task, taskPath, replacedTaskId };
}

async function detectGreenfieldBootstrap(
  root: string,
  kind: TaskKind,
): Promise<boolean> {
  if (kind !== "generate") {
    return false;
  }
  const lifecycle = await readLifecycle(root);
  const probes = await probeLifecycleSignals(root);
  const intent = lifecycle?.intent ?? (probes.layout === "legacy" || probes.layout === "mixed" ? "migrate" : "greenfield");
  return (
    intent === "greenfield" &&
    !probes.has_generated_docs &&
    Boolean(probes.has_data_source_files)
  );
}

// ── get / list ────────────────────────────────────────────────────────────────

export interface TaskGetOptions {
  root?: string;
  taskId: string;
}

export interface TaskGetResult {
  task: TaskState;
  taskPath: string;
  workflowGuidance: WorkflowToolGuidance;
}

export async function runTaskGet(opts: TaskGetOptions): Promise<TaskGetResult> {
  const root = await resolveRoot(opts.root);
  const task = parseTask(await loadTask(root, opts.taskId));
  return {
    task,
    taskPath: taskFilePath(root, opts.taskId),
    workflowGuidance: buildTaskWorkflowGuidance(task),
  };
}

export interface TaskListBootstrap {
  kind: TaskKind;
  workflow: WorkflowId;
  trigger: string;
  docType?: string;
  force?: boolean;
  sourceMode?: SourceMode;
  deriveFrom?: DeriveLayer[];
  derivePhase?: DerivePhase;
  priorDeriveTaskId?: string;
}

export interface TaskListActiveSlot {
  slot: string;
  taskId: string;
  action: "resume";
  task: TaskState;
}

export interface TaskListBootstrapped {
  created: true;
  task: TaskState;
  taskPath: string;
  replacedTaskId?: string;
}

export interface TaskListOptions {
  root?: string;
  status?: TaskStatus | TaskStatus[];
  kind?: TaskKind;
  workflow?: WorkflowId;
  /** Include only tasks listed in index.recent (default: scan all task files). */
  recentOnly?: boolean;
  /**
   * When set, creates a task if the workflow slot has no in-flight task; otherwise
   * returns `activeForSlot` so the agent can call task_resume in one list call.
   */
  bootstrap?: TaskListBootstrap;
}

export interface TaskListResult {
  tasks: TaskState[];
  total: number;
  index: TaskIndex;
  /** New task created because the slot was empty or only had a finished task. */
  bootstrapped?: TaskListBootstrapped;
  /** Existing in-flight task for the bootstrap slot — prefer task_resume. */
  activeForSlot?: TaskListActiveSlot;
  workflowGuidance?: WorkflowToolGuidance;
}

async function maybeBootstrapFromList(
  root: string,
  bootstrap: TaskListBootstrap,
): Promise<{
  index: TaskIndex;
  bootstrapped?: TaskListBootstrapped;
  activeForSlot?: TaskListActiveSlot;
}> {
  const index = await loadIndex(root);
  const slot = activeSlotFor(bootstrap.kind, bootstrap.workflow, bootstrap.docType);
  const activeId = index.active[slot];

  if (activeId && !bootstrap.force) {
    try {
      const task = parseTask(await loadTask(root, activeId));
      if (task.status !== "complete" && task.status !== "abandoned") {
        return {
          index,
          activeForSlot: { slot, taskId: activeId, action: "resume", task },
        };
      }
    } catch {
      // stale index entry — create below
    }
  }

  const created = await runTaskCreate({
    root,
    kind: bootstrap.kind,
    workflow: bootstrap.workflow,
    trigger: bootstrap.trigger,
    docType: bootstrap.docType,
    force: bootstrap.force,
    sourceMode: bootstrap.sourceMode,
    deriveFrom: bootstrap.deriveFrom,
    derivePhase: bootstrap.derivePhase,
    priorDeriveTaskId: bootstrap.priorDeriveTaskId,
  });
  return {
    index: await loadIndex(root),
    bootstrapped: {
      created: true,
      task: created.task,
      taskPath: created.taskPath,
      replacedTaskId: created.replacedTaskId,
    },
  };
}

export async function runTaskList(opts: TaskListOptions = {}): Promise<TaskListResult> {
  const root = await resolveRoot(opts.root);
  let bootstrapped: TaskListBootstrapped | undefined;
  let activeForSlot: TaskListActiveSlot | undefined;
  let index = await loadIndex(root);

  if (opts.bootstrap) {
    const boot = await maybeBootstrapFromList(root, opts.bootstrap);
    index = boot.index;
    bootstrapped = boot.bootstrapped;
    activeForSlot = boot.activeForSlot;
  }

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

  if (bootstrapped && !tasks.some((t) => t.id === bootstrapped.task.id)) {
    tasks.unshift(bootstrapped.task);
  }
  if (activeForSlot && !tasks.some((t) => t.id === activeForSlot.taskId)) {
    tasks.unshift(activeForSlot.task);
  }

  return {
    tasks,
    total: tasks.length,
    index,
    bootstrapped,
    activeForSlot,
    workflowGuidance: buildTaskListWorkflowGuidance({ activeForSlot, bootstrapped }),
  };
}

export interface TaskStatusSlot {
  slot: string;
  taskId: string;
  task?: TaskState;
  missing?: boolean;
}

export interface TaskStatusResult {
  index: TaskIndex;
  slots: TaskStatusSlot[];
}

/** Active workflow slots only — quick view for `task status` / resume prompts. */
export async function runTaskStatus(opts: { root?: string } = {}): Promise<TaskStatusResult> {
  const root = await resolveRoot(opts.root);
  const index = await loadIndex(root);
  const slots: TaskStatusSlot[] = [];
  for (const [slot, taskId] of Object.entries(index.active ?? {})) {
    try {
      const task = parseTask(await loadTask(root, taskId));
      slots.push({ slot, taskId, task });
    } catch {
      slots.push({ slot, taskId, missing: true });
    }
  }
  return { index, slots };
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
  if (patch.plan !== undefined) {
    if (patch.plan && task.kind === "generate") {
      assertGeneratePlanStoreAllowed(task);
    }
    task.plan = patch.plan;
  }
  if (patch.blockers !== undefined) task.blockers = patch.blockers;
  if (patch.contextRefs) {
    task.contextRefs = { ...task.contextRefs, ...patch.contextRefs };
  }
  if (patch.snapshot) {
    task.snapshot = { ...task.snapshot, ...patch.snapshot };
  }
  if (patch.step) {
    assertTaskStepUpdateAllowed(task, patch.step.id, patch.step.patch.status);
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

const RESOLVE_FAST_SKIP_STEPS = ["check", "design", "briefing"] as const;

function advanceResolveStep(task: TaskState, fromStepId: string): void {
  const fromIndex = task.steps.findIndex((s) => s.id === fromStepId);
  const nextStep =
    fromIndex >= 0
      ? task.steps.slice(fromIndex + 1).find((s) => s.status !== "done" && s.status !== "skipped")
      : task.steps.find((s) => s.status === "pending" || s.status === "in-progress");
  if (!nextStep) return;
  nextStep.status = "in-progress";
  task.currentStepId = nextStep.id;
  task.phase = nextStep.phase;
  task.phaseStatus = "in_progress";
  task.nextAction = defaultNextAction(task.workflow, nextStep.id);
}

export interface TaskConfirmTierOptions {
  root?: string;
  taskId: string;
  tier: ResolveTier;
}

export interface TaskConfirmTierResult {
  task: TaskState;
  taskPath: string;
  workflowGuidance: WorkflowToolGuidance;
}

/** Record user-confirmed resolve tier and advance to clarify (Fast: skip check/design/briefing). */
export async function runTaskConfirmTier(
  opts: TaskConfirmTierOptions,
): Promise<TaskConfirmTierResult> {
  const root = await resolveRoot(opts.root);
  const task = parseTask(await loadTask(root, opts.taskId));

  if (task.kind !== "resolve") {
    throw new Error(`Task "${task.id}" is kind "${task.kind}" — task_confirm_tier is for resolve tasks only`);
  }
  if (task.planApprovedAt) {
    throw new Error(`Task "${task.id}" plan already approved — cannot change tier`);
  }

  const now = new Date().toISOString();
  task.snapshot.resolveTier = opts.tier;
  task.snapshot.tierConfirmedAt = now;

  const tierStep = task.steps.find((s) => s.id === "tier");
  if (tierStep) {
    tierStep.status = "done";
    tierStep.completedAt = now;
    tierStep.blocker = null;
  }

  if (opts.tier === "fast") {
    for (const stepId of RESOLVE_FAST_SKIP_STEPS) {
      const step = task.steps.find((s) => s.id === stepId);
      if (step && (step.status === "pending" || step.status === "in-progress")) {
        step.status = "skipped";
      }
    }
  } else if (opts.tier === "standard") {
    const designStep = task.steps.find((s) => s.id === "design");
    if (designStep && (designStep.status === "pending" || designStep.status === "in-progress")) {
      designStep.status = "skipped";
    }
  }

  advanceResolveStep(task, "tier");

  touchTask(task);
  const taskPath = await saveTask(root, task);

  const index = await loadIndex(root);
  pushRecent(index, task.id);
  await saveIndex(root, index);

  return {
    task,
    taskPath,
    workflowGuidance: buildTaskWorkflowGuidance(task),
  };
}

export interface TaskApproveDesignSpecOptions {
  root?: string;
  taskId: string;
  designSpecPath: string;
}

export interface TaskApproveDesignSpecResult {
  task: TaskState;
  taskPath: string;
  workflowGuidance: WorkflowToolGuidance;
}

/** Full tier: record approved design spec path and advance to check. */
export async function runTaskApproveDesignSpec(
  opts: TaskApproveDesignSpecOptions,
): Promise<TaskApproveDesignSpecResult> {
  const root = await resolveRoot(opts.root);
  const task = parseTask(await loadTask(root, opts.taskId));

  if (task.kind !== "resolve") {
    throw new Error(`Task "${task.id}" is not a resolve task`);
  }
  if (effectiveResolveTier(task) !== "full") {
    throw new Error(`Task "${task.id}" tier is "${effectiveResolveTier(task)}" — design spec approval is Full tier only`);
  }
  if (task.planApprovedAt) {
    throw new Error(`Task "${task.id}" plan already approved — design spec gate is pre-plan only`);
  }
  if (!task.snapshot.tierConfirmedAt) {
    throw new Error(`Task "${task.id}" tier not confirmed — call task_confirm_tier first`);
  }

  const now = new Date().toISOString();
  task.snapshot.designSpecPath = opts.designSpecPath.replace(/\\/g, "/");
  task.snapshot.designSpecApprovedAt = now;

  const designStep = task.steps.find((s) => s.id === "design");
  if (designStep) {
    designStep.status = "done";
    designStep.completedAt = now;
    designStep.blocker = null;
  }

  advanceResolveStep(task, "design");

  touchTask(task);
  const taskPath = await saveTask(root, task);

  return {
    task,
    taskPath,
    workflowGuidance: buildTaskWorkflowGuidance(task),
  };
}

export interface TaskSetExecutionModeOptions {
  root?: string;
  taskId: string;
  mode: ResolveExecutionMode;
}

export interface TaskSetExecutionModeResult {
  task: TaskState;
  taskPath: string;
  workflowGuidance: WorkflowToolGuidance;
}

/** Standard/Full resolve tasks: record inline vs subagent execution after plan approval. */
export async function runTaskSetExecutionMode(
  opts: TaskSetExecutionModeOptions,
): Promise<TaskSetExecutionModeResult> {
  const root = await resolveRoot(opts.root);
  const task = parseTask(await loadTask(root, opts.taskId));

  if (task.kind !== "resolve") {
    throw new Error(`Task "${task.id}" is not a resolve task`);
  }
  if (!task.planApprovedAt) {
    throw new Error(`Task "${task.id}" plan not approved — call task_approve_plan first`);
  }
  const tier = effectiveResolveTier(task);
  if (tier === "fast") {
    throw new Error(`Task "${task.id}" is Fast tier — execution is always inline`);
  }

  task.snapshot.executionMode = opts.mode;
  touchTask(task);
  const taskPath = await saveTask(root, task);

  return {
    task,
    taskPath,
    workflowGuidance: buildTaskWorkflowGuidance(task),
  };
}

// ── approve plan ──────────────────────────────────────────────────────────────

export interface TaskApprovePlanOptions {
  root?: string;
  taskId: string;
  plan?: StoredPlan;
  by?: string;
  username?: string;
  role?: "user" | "client";
}

export interface TaskApprovePlanResult {
  task: TaskState;
  taskPath: string;
  workflowGuidance: WorkflowToolGuidance;
}

export async function runTaskApprovePlan(
  opts: TaskApprovePlanOptions,
): Promise<TaskApprovePlanResult> {
  const root = await resolveRoot(opts.root);
  const task = parseTask(await loadTask(root, opts.taskId));

  if (task.kind === "import") {
    throw new Error(
      'Import tasks use task_approve_import_plan, not task_approve_plan.',
    );
  }

  if (task.kind === "adopt") {
    throw new Error(
      'Adopt tasks use task_approve_adopt_plan, not task_approve_plan.',
    );
  }

  if (opts.plan) {
    task.plan = opts.plan;
  }

  assertTaskApprovePlanAllowed(task);

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

  if (task.status === "blocked") {
    task.status = "active";
    task.blockers = [];
  }

  if (task.plan.kind === "generate") {
    expandGenerateWaveSteps(task, task.plan.plan);
    task.contextRefs = {
      ...task.contextRefs,
      docType: task.plan.plan.docType,
      contextFile: task.contextRefs.contextFile ?? `context/${task.plan.plan.docType}.json`,
      extractedFile: `extracted/${task.plan.plan.docType}.json`,
    };
    const nextWave = task.steps.find((s) => s.id.startsWith("wave-") && s.status === "pending");
    if (nextWave) {
      nextWave.status = "in-progress";
      task.currentStepId = nextWave.id;
      task.phase = "generate";
      task.phaseStatus = "in_progress";
      task.nextAction = nextWave.description;
    }
  } else {
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
  }

  const logPath = await writePlanAuditLog(root, task, now, {
    by: opts.by,
    username: opts.username,
    role: opts.role,
  });
  if (logPath) {
    task.contextRefs = { ...task.contextRefs, planLog: logPath };
  }

  touchTask(task);
  const taskPath = await saveTask(root, task);
  await recordWorkflowFromTask(root, task);
  return {
    task,
    taskPath,
    workflowGuidance: buildTaskApprovePlanWorkflowGuidance(task),
  };
}

export interface TaskApproveImportPlanOptions {
  root?: string;
  taskId: string;
  plan?: StoredPlan;
}

export async function runTaskApproveImportPlan(
  opts: TaskApproveImportPlanOptions,
): Promise<TaskApprovePlanResult> {
  const root = await resolveRoot(opts.root);
  const task = parseTask(await loadTask(root, opts.taskId));

  if (opts.plan) {
    task.plan = opts.plan;
  }

  assertTaskApproveImportPlanAllowed(task);

  const now = new Date().toISOString();
  task.planApprovedAt = now;
  task.snapshot.manifestPlanApprovedAt = now;
  task.phaseStatus = "done";

  const planStep = task.steps.find((s) => s.id === "manifest-plan");
  if (planStep) {
    planStep.status = "done";
    planStep.completedAt = now;
    planStep.blocker = null;
  }

  const nextStep = task.steps.find(
    (s) => s.id === "refine-templates" || (s.status === "pending" && s.id !== "manifest-plan"),
  );
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

  touchTask(task);
  const taskPath = await saveTask(root, task);
  await recordWorkflowFromTask(root, task);
  return {
    task,
    taskPath,
    workflowGuidance: buildTaskApprovePlanWorkflowGuidance(task),
  };
}

export interface TaskApproveAdoptPlanOptions {
  root?: string;
  taskId: string;
  plan?: StoredPlan;
  by?: string;
}

export async function runTaskApproveAdoptPlan(
  opts: TaskApproveAdoptPlanOptions,
): Promise<TaskApprovePlanResult> {
  const root = await resolveRoot(opts.root);
  const task = parseTask(await loadTask(root, opts.taskId));

  if (opts.plan) {
    task.plan = opts.plan;
  } else if (!task.plan || task.plan.kind !== "adopt") {
    task.plan = await buildAdoptStoredPlanFromArtifacts(root);
  }

  assertTaskApproveAdoptPlanAllowed(task);

  await approveAdoptPlan({ root, by: opts.by });

  const now = new Date().toISOString();
  task.planApprovedAt = now;
  task.phaseStatus = "done";

  const planStep = task.steps.find((s) => s.id === "plan");
  if (planStep) {
    planStep.status = "done";
    planStep.completedAt = now;
    planStep.blocker = null;
  }

  const nextStep = task.steps.find((s) => s.id === "apply");
  if (nextStep) {
    nextStep.status = "in-progress";
    task.currentStepId = nextStep.id;
    task.phase = nextStep.phase;
    task.phaseStatus = "in_progress";
    task.nextAction = defaultNextAction("adopt", "apply");
  }

  if (task.status === "blocked") {
    task.status = "active";
    task.blockers = [];
  }

  touchTask(task);
  const taskPath = await saveTask(root, task);
  await recordWorkflowFromTask(root, task);
  return {
    task,
    taskPath,
    workflowGuidance: buildTaskApprovePlanWorkflowGuidance(task),
  };
}

/** Build adopt StoredPlan from on-disk plan.json + scan-result.json. */
export async function buildAdoptStoredPlanFromArtifacts(root: string): Promise<StoredPlan> {
  const paths = adoptArtifactPaths(root);
  const plan = await readJson<import("../adopt/types.js").AdoptPlan>(paths.plan);
  const scan = await readJson<AdoptScanResult>(paths.scanResult);
  return {
    kind: "adopt",
    plan: buildAdoptPlanSummary(plan, scan.classification),
  };
}

export interface TaskApprovePackDesignOptions {
  root?: string;
  taskId: string;
  designSpecPath: string;
}

export async function runTaskApprovePackDesign(
  opts: TaskApprovePackDesignOptions,
): Promise<TaskGetResult> {
  const root = await resolveRoot(opts.root);
  const task = parseTask(await loadTask(root, opts.taskId));

  assertTaskApprovePackDesignAllowed(task);

  const now = new Date().toISOString();
  task.snapshot.packDesignSpecPath = opts.designSpecPath.replace(/\\/g, "/");
  task.snapshot.packDesignSpecApprovedAt = now;

  const designStep = task.steps.find((s) => s.id === "design");
  if (designStep && designStep.status !== "done") {
    designStep.status = "done";
    designStep.completedAt = now;
  }

  const next = task.steps.find((s) => s.id === "manifest-briefing" && s.status === "pending");
  if (next) {
    next.status = "in-progress";
    task.currentStepId = next.id;
    task.phase = next.phase;
    task.phaseStatus = "in_progress";
    task.nextAction = defaultNextAction(task.workflow, next.id);
  }

  touchTask(task);
  const taskPath = await saveTask(root, task);
  await recordWorkflowFromTask(root, task);
  return {
    task,
    taskPath,
    workflowGuidance: buildTaskWorkflowGuidance(task),
  };
}

async function writePlanAuditLog(
  root: string,
  task: TaskState,
  approvedAt: string,
  actorInput?: { by?: string; username?: string; role?: "user" | "client" },
): Promise<string | undefined> {
  if (!task.plan) return undefined;
  const actor = await resolveAuditActor(root, actorInput);
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
    approvedBy: actor.by,
    approvedByUsername: actor.username,
    approvedByRole: actor.role,
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

  if (task.kind === "generate") {
    const extractStep = task.steps.find((s) => s.id === "extract");
    if (extractStep && extractStep.status === "pending") {
      throw new Error(
        'Cannot complete generate task — extract stage not started. Offer spec extraction (spec_record) per extract-specs.md, then task_update extract step done or set snapshot.extractOffered.',
      );
    }
    if (
      extractStep &&
      extractStep.status === "in-progress" &&
      !task.snapshot.extractOffered
    ) {
      throw new Error(
        'Cannot complete generate task — extract stage in progress. Offer spec_record to the user first, then set snapshot.extractOffered via task_update.',
      );
    }
  }

  task.status = "complete";
  task.phaseStatus = "done";
  for (const step of task.steps) {
    if (step.status === "pending" || step.status === "in-progress") {
      step.status = "skipped";
    }
  }
  if (opts.summary) {
    task.nextAction = opts.summary;
  } else if (
    task.snapshot.sourceMode === "derive-downstream" &&
    task.snapshot.derivePhase === "extract"
  ) {
    task.snapshot.deriveExpandOfferedAt = new Date().toISOString();
    task.nextAction =
      "Extract pass complete. Review SRS, then say expand SRS to full for Pass 2.";
  } else {
    task.nextAction = "Task complete";
  }

  touchTask(task);
  const taskPath = await saveTask(root, task);

  const index = await loadIndex(root);
  const slot = activeSlotFor(task.kind, task.workflow, task.contextRefs?.docType);
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

// ── generate workflow integration ───────────────────────────────────────────

export interface RecordGenerateWaveOptions {
  root?: string;
  taskId: string;
  waveId: string;
  status: WorkflowStepStatus;
  artifacts?: string[];
  blocker?: string | null;
}

export async function recordGenerateWaveProgress(
  opts: RecordGenerateWaveOptions,
): Promise<TaskUpdateResult> {
  const root = await resolveRoot(opts.root);
  const loaded = parseTask(await loadTask(root, opts.taskId));

  if (loaded.kind !== "generate") {
    throw new Error(`Task "${loaded.id}" is kind "${loaded.kind}", not generate`);
  }

  assertGenerateExecutionAllowed(loaded);

  const now = new Date().toISOString();
  const wavePatch: TaskUpdatePatch = {
    step: {
      id: opts.waveId,
      patch: {
        status: opts.status,
        completedAt: opts.status === "done" ? now : undefined,
        blocker: opts.blocker ?? null,
        artifacts: opts.artifacts,
      },
    },
  };

  if (opts.status === "blocked") {
    wavePatch.status = "blocked";
    wavePatch.blockers = [opts.blocker ?? `wave ${opts.waveId} blocked`];
  }

  let result = await runTaskUpdate({ root, taskId: opts.taskId, patch: wavePatch });

  if (opts.status !== "done") {
    return result;
  }

  const waves = result.task.steps.filter((s) => s.id.startsWith("wave-"));
  const allWavesDone = waves.every((s) => s.status === "done");
  if (allWavesDone) {
    return runTaskUpdate({
      root,
      taskId: opts.taskId,
      patch: {
        currentStepId: "extract",
        phase: "extract",
        phaseStatus: "in_progress",
        nextAction: defaultNextAction(result.task.workflow, "extract"),
        step: { id: "extract", patch: { status: "in-progress" } },
      },
    });
  }

  const nextWave = waves.find((s) => s.status === "pending");
  if (nextWave) {
    result = await runTaskUpdate({
      root,
      taskId: opts.taskId,
      patch: {
        currentStepId: nextWave.id,
        phase: "generate",
        phaseStatus: "in_progress",
        nextAction: nextWave.description,
        step: { id: nextWave.id, patch: { status: "in-progress" } },
      },
    });
  }

  return result;
}

// ── resolve-task integration ────────────────────────────────────────────────

export async function loadResolveExecutionContext(opts: {
  root?: string;
  taskId: string;
}): Promise<{
  task: TaskState;
  intent: string;
  goalSpec: GoalSpec;
  plan: TaskPlan;
}> {
  const { task } = await runTaskGet({ root: opts.root, taskId: opts.taskId });
  if (task.workflow !== "resolve") {
    throw new Error(`Task "${task.id}" uses workflow "${task.workflow}", not resolve`);
  }
  assertResolveExecutionAllowed(task);
  if (!task.plan || task.plan.kind !== "resolve") {
    throw new Error(`Task "${task.id}" has no stored resolve plan`);
  }
  if (!task.goal) {
    throw new Error(`Task "${task.id}" has no GoalSpec — set goal via task_update first`);
  }
  return {
    task,
    intent: task.trigger,
    goalSpec: task.goal,
    plan: structuredClone(task.plan.plan),
  };
}

export interface RecordResolveStepProgressOptions {
  root?: string;
  taskId: string;
  plan: TaskPlan;
  stepId: string;
  stepStatus: TaskStepStatus;
  artifacts?: string[];
  blocker?: string | null;
}

export async function recordResolveStepProgress(
  opts: RecordResolveStepProgressOptions,
): Promise<TaskUpdateResult> {
  const now = new Date().toISOString();
  const planStep = opts.plan.steps.find((s) => s.id === opts.stepId);
  const patch: TaskUpdatePatch = {
    plan: { kind: "resolve", plan: opts.plan },
  };

  if (planStep) {
    planStep.status = opts.stepStatus;
    if (opts.blocker) planStep.blockerReason = opts.blocker;
    else if (opts.stepStatus === "done") delete planStep.blockerReason;
  }

  const anyBlocked = opts.plan.steps.some((s) => s.status === "blocked");
  const allDone = opts.plan.steps.every((s) => s.status === "done");

  if (anyBlocked) {
    patch.status = "blocked";
    patch.step = {
      id: "execute",
      patch: {
        status: "blocked",
        blocker: opts.blocker ?? "execution step blocked",
        artifacts: opts.artifacts,
      },
    };
    patch.blockers = [opts.blocker ?? "execution step blocked"];
  } else if (allDone) {
    patch.step = {
      id: "execute",
      patch: { status: "done", completedAt: now, artifacts: opts.artifacts ?? [] },
    };
    patch.currentStepId = "report";
    patch.phase = "report";
    patch.phaseStatus = "in_progress";
    patch.nextAction = defaultNextAction("resolve", "report");
  } else {
    patch.step = {
      id: "execute",
      patch: { status: "in-progress", artifacts: opts.artifacts },
    };
  }

  return runTaskUpdate({ root: opts.root, taskId: opts.taskId, patch });
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
  const slot = activeSlotFor(task.kind, task.workflow, task.contextRefs?.docType);
  if (index.active[slot] === task.id) {
    delete index.active[slot];
  }
  pushRecent(index, task.id);
  await saveIndex(root, index);

  return { task, taskPath };
}

export { registerWorkCommands, registerTaskCommands } from "./work.js";
