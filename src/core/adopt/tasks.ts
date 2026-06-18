import { join, resolve } from "node:path";
import { loadDocflowConfig } from "../config/load.js";
import { discoverMarkdownFiles } from "../index/docs-build.js";
import {
  buildTaskId,
  taskFilePath,
  taskIndexPath,
  type TaskIndex,
  type TaskState,
  type TaskStep,
} from "../operations/task.js";
import {
  activeSlotFor,
  getWorkflowTemplate,
  type WorkflowId,
} from "../operations/task-templates.js";
import { loadAdoptSetup } from "./setup.js";
import { pathExists, readJson, writeJsonAtomic } from "../util/fs.js";

const RECENT_MAX = 20;

type AdoptDocType = "srs" | "basic-design" | "detail-design";

const CANONICAL_DOC_RE: Record<AdoptDocType, RegExp> = {
  srs: /^docs\/srs\/[^/]+\/.+\.md$/i,
  "basic-design": /^docs\/basic-design\/[^/]+\/.+\.md$/i,
  "detail-design": /^docs\/detail-design\/[^/]+\/.+\.md$/i,
};

const WORKFLOW_FOR_DOC: Record<AdoptDocType, WorkflowId> = {
  srs: "generate-srs",
  "basic-design": "generate-basic-design",
  "detail-design": "generate-detail-design",
};

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

function pushRecent(index: TaskIndex, taskId: string): void {
  index.recent = [taskId, ...index.recent.filter((id) => id !== taskId)].slice(0, RECENT_MAX);
}

async function listCanonicalDocPaths(root: string, docType: AdoptDocType): Promise<string[]> {
  const relRoot = `docs/${docType}`;
  if (!(await pathExists(join(root, relRoot)))) {
    return [];
  }
  const files = await discoverMarkdownFiles(root, relRoot).catch(() => []);
  const re = CANONICAL_DOC_RE[docType];
  return files.filter((f) => re.test(f.relativePath)).map((f) => f.relativePath);
}

function buildCompletedGenerateSteps(
  workflow: WorkflowId,
  now: string,
  artifacts: string[],
): TaskStep[] {
  const template = getWorkflowTemplate(workflow);
  const steps: TaskStep[] = [];

  for (const s of template.steps) {
    if (s.id === "generate-waves") {
      steps.push({
        id: "wave-1",
        phase: "generate",
        description: "Generate documents in DAG waves",
        status: "done",
        completedAt: now,
        blocker: null,
        artifacts,
      });
      continue;
    }
    steps.push({
      id: s.id,
      phase: s.phase,
      description: s.description,
      status: "done",
      completedAt: now,
      blocker: null,
      artifacts: [],
    });
  }

  return steps;
}

async function createCompletedAdoptTask(
  root: string,
  index: TaskIndex,
  docType: AdoptDocType,
  artifacts: string[],
): Promise<string> {
  const workflow = WORKFLOW_FOR_DOC[docType];
  const now = new Date().toISOString();
  const steps = buildCompletedGenerateSteps(workflow, now, artifacts);
  const lastStep = steps[steps.length - 1]!;

  const task: TaskState = {
    version: 1,
    id: buildTaskId(),
    kind: "generate",
    workflow,
    status: "complete",
    createdAt: now,
    updatedAt: now,
    trigger: "adopt:migration",
    phase: lastStep.phase,
    phaseStatus: "done",
    goal: null,
    plan: null,
    planApprovedAt: now,
    steps,
    currentStepId: lastStep.id,
    nextAction: "Task complete",
    blockers: [],
    contextRefs: {
      docType,
      contextFile: `context/${docType}.json`,
      extractedFile: `extracted/${docType}.json`,
    },
    snapshot: {
      workspaceCheckAt: now,
      adoptedAt: now,
      readinessReportShown: true,
      briefingConfirmedAt: now,
      planPresentedAt: now,
      extractOffered: true,
    },
  };

  await writeJsonAtomic(taskFilePath(root, task.id), task);
  pushRecent(index, task.id);
  return task.id;
}

export async function createAdoptCompletedTasks(opts: { root: string }): Promise<{
  srs?: string;
  basicDesign?: string;
  detailDesign?: string;
}> {
  const root = await resolveRoot(opts.root);
  const index = await loadIndex(root);
  const result: { srs?: string; basicDesign?: string; detailDesign?: string } = {};

  const srsPaths = await listCanonicalDocPaths(root, "srs");
  if (srsPaths.length > 0) {
    result.srs = await createCompletedAdoptTask(root, index, "srs", srsPaths);
  }

  const basicDesignPaths = await listCanonicalDocPaths(root, "basic-design");
  if (basicDesignPaths.length > 0) {
    result.basicDesign = await createCompletedAdoptTask(
      root,
      index,
      "basic-design",
      basicDesignPaths,
    );
  }

  const detailDesignPaths = await listCanonicalDocPaths(root, "detail-design");
  if (detailDesignPaths.length > 0) {
    result.detailDesign = await createCompletedAdoptTask(
      root,
      index,
      "detail-design",
      detailDesignPaths,
    );
  }

  if (result.srs || result.basicDesign || result.detailDesign) {
    await writeJsonAtomic(taskIndexPath(root), index);
  }

  return result;
}

export async function hasAdoptTaskCoverage(root: string, slot: string): Promise<boolean> {
  const setup = await loadAdoptSetup(root);
  if (setup.items["migration.complete"]?.done) {
    return true;
  }

  const index = await loadIndex(root);
  for (const taskId of index.recent ?? []) {
    const taskPath = taskFilePath(root, taskId);
    if (!(await pathExists(taskPath))) continue;
    const task = await readJson<TaskState>(taskPath).catch(() => null);
    if (!task || task.status !== "complete") continue;
    if (!task.snapshot?.adoptedAt) continue;
    const expectedSlot = activeSlotFor(
      task.kind,
      task.workflow,
      task.contextRefs?.docType,
    );
    if (expectedSlot === slot) return true;
  }
  return false;
}
