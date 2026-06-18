import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { TaskState } from "./task.js";
import { isImportClarifyComplete } from "../template/import-aspects.js";
import { validateStagedGenerateSkill } from "../template/scan-inference.js";
import { TaskPreconditionError } from "./task-gates.js";

function stepStatus(task: TaskState, stepId: string): string {
  return task.steps.find((s) => s.id === stepId)?.status ?? "missing";
}

export interface ImportInstallGateOptions {
  root: string;
  legacy?: boolean;
}

/** Load active import task for slot `import`, if any. */
export async function findActiveImportTask(
  loadActiveTask: (slot: string) => Promise<TaskState | null>,
): Promise<TaskState | null> {
  return loadActiveTask("import");
}

export function assertImportClarifyComplete(task: TaskState): void {
  if (task.kind !== "import") return;
  const coverage = task.plan?.kind === "import" ? task.plan.plan.aspectCoverage : undefined;
  const supplemental =
    task.plan?.kind === "import" ? task.plan.plan.supplementalQuestions : undefined;
  if (!coverage?.length) {
    throw new TaskPreconditionError(
      "snapshot_missing",
      `Import task "${task.id}" has no aspect coverage — run template_infer first.`,
      "Call MCP template_infer({}), review aspect coverage + supplemental questions with user, store in import plan via task_update.",
      ["template_infer", "task_update"],
      task,
      "clarify",
    );
  }
  if (!isImportClarifyComplete({ aspectCoverage: coverage, supplementalQuestions: supplemental })) {
    throw new TaskPreconditionError(
      "step_incomplete",
      `Import task "${task.id}" clarify incomplete — resolve aspect gaps and open supplemental questions.`,
      "Confirm each aspect (scan evidence + unlocks). Resolve supplementalQuestions or add more via task_update if the scan needs it. Then mark clarify done.",
      ["template_infer", "task_update", "context_record"],
      task,
      "clarify",
    );
  }
}

export function assertTaskApprovePackDesignAllowed(task: TaskState): void {
  if (task.kind !== "import") {
    throw new TaskPreconditionError(
      "step_premature",
      `task_approve_pack_design is only for import tasks (got kind "${task.kind}").`,
      "Use task_approve_design_spec for resolve Full tier.",
      ["task_approve_design_spec"],
      task,
    );
  }
  if (stepStatus(task, "check") !== "done") {
    throw new TaskPreconditionError(
      "step_incomplete",
      `Import task "${task.id}" — complete check before pack design approval.`,
      "Run workspace_check, mark check done.",
      ["workspace_check", "task_update"],
      task,
      "check",
    );
  }
  assertImportClarifyComplete(task);
  if (stepStatus(task, "clarify") !== "done") {
    throw new TaskPreconditionError(
      "step_incomplete",
      `Import task "${task.id}" — complete clarify before pack design approval.`,
      "Confirm aspect coverage + supplemental questions, mark clarify done.",
      ["template_infer", "task_update"],
      task,
      "clarify",
    );
  }
}

export function assertTaskApproveImportPlanAllowed(
  task: TaskState,
): asserts task is TaskState & { plan: { kind: "import"; plan: import("./import-plan.js").ImportPlan } } {
  if (task.kind !== "import") {
    throw new TaskPreconditionError(
      "step_premature",
      `task_approve_import_plan is only for import tasks (got kind "${task.kind}").`,
      "Use task_approve_plan for generate/resolve workflows.",
      ["task_approve_plan"],
      task,
    );
  }
  if (task.planApprovedAt) {
    throw new TaskPreconditionError(
      "plan_already_approved",
      `Import task "${task.id}" manifest plan already approved.`,
      "Continue with refine-templates → template_install. Do not call task_approve_import_plan again.",
      ["task_get", "template_install"],
      task,
    );
  }
  if (!task.plan || task.plan.kind !== "import") {
    throw new TaskPreconditionError(
      "plan_missing",
      `Import task "${task.id}" has no import plan to approve.`,
      "Store ImportPlan via task_update after manifest briefing.",
      ["task_update"],
      task,
      "manifest-plan",
    );
  }
  if (!task.snapshot.packDesignSpecApprovedAt) {
    throw new TaskPreconditionError(
      "snapshot_missing",
      `Import task "${task.id}" — pack design spec not approved.`,
      "Get user approval on pack design spec, then task_approve_pack_design.",
      ["task_approve_pack_design"],
      task,
      "design",
    );
  }
  if (stepStatus(task, "manifest-briefing") !== "done") {
    throw new TaskPreconditionError(
      "step_incomplete",
      `Import task "${task.id}" — complete manifest-briefing before plan approval.`,
      "Brief each manifest row with user, mark manifest-briefing done.",
      ["task_update"],
      task,
      "manifest-briefing",
    );
  }
  if (!task.snapshot.manifestPlanPresentedAt) {
    throw new TaskPreconditionError(
      "snapshot_missing",
      `Import task "${task.id}" — manifest table not presented.`,
      "Show manifest table in chat, set snapshot.manifestPlanPresentedAt.",
      ["task_update"],
      task,
      "manifest-plan",
    );
  }
  const manifestStep = task.steps.find((s) => s.id === "manifest-plan");
  if (manifestStep?.status === "done") {
    throw new TaskPreconditionError(
      "step_premature",
      `Import task "${task.id}" manifest-plan already marked done without approval.`,
      "Use task_approve_import_plan after user yes — not task_update on manifest-plan.",
      ["task_approve_import_plan"],
      task,
      "manifest-plan",
    );
  }
}

export async function assertImportInstallAllowed(
  task: TaskState | null,
  opts: { root: string; legacy?: boolean; stagingDir: string },
): Promise<void> {
  if (opts.legacy) return;

  if (!task || task.kind !== "import") {
    throw new Error(
      'template install requires an active import task (task_create kind "import") or pass --legacy to bypass gates.',
    );
  }

  if (stepStatus(task, "manifest-plan") !== "done" || !task.planApprovedAt) {
    throw new TaskPreconditionError(
      "plan_not_approved",
      `Cannot install — import manifest plan not approved for task "${task.id}".`,
      "Present manifest table and call task_approve_import_plan after user confirms.",
      ["task_approve_import_plan"],
      task,
      "manifest-plan",
    );
  }

  const manifestPath = join(opts.stagingDir, "manifest.json");
  const skillPath = join(opts.stagingDir, "generate-skill.md");
  if (!existsSync(manifestPath)) {
    throw new TaskPreconditionError(
      "snapshot_missing",
      "staging manifest.json missing.",
      "Write manifest to .ai-spector/packs/.staging/manifest.json before install.",
      ["task_update"],
      task,
      "install",
    );
  }
  if (!existsSync(skillPath)) {
    throw new TaskPreconditionError(
      "snapshot_missing",
      "staging generate-skill.md missing.",
      "Complete write-skill step before install.",
      ["task_update"],
      task,
      "install",
    );
  }

  const skillText = await readFile(skillPath, "utf8");
  const skillCheck = validateStagedGenerateSkill(skillText);
  if (!skillCheck.ok) {
    throw new TaskPreconditionError(
      "plan_invalid",
      `generate-skill.md missing gated-flow patterns: ${skillCheck.missing.join(", ")}`,
      "Add task_list, readiness-criteria, workflow-setup, context-readiness, generate-workflow, task_approve_plan to the skill.",
      ["task_update"],
      task,
      "write-skill",
    );
  }
}
