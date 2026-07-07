/**
 * work.ts — Alias layer for task operations.
 *
 * Exposes `runWork*` wrappers that map to the underlying `runTask*` functions.
 * `work_create` accepts kind "change" as an alias for "resolve".
 */

import { resolve } from "node:path";
import type { Command } from "commander";
import {
  runTaskCreate,
  runTaskList,
  runTaskGet,
  runTaskUpdate,
  runTaskApprovePlan,
  runTaskApproveImportPlan,
  runTaskApprovePackDesign,
  runTaskPause,
  runTaskResume,
  runTaskComplete,
  runTaskAbandon,
  runTaskStatus,
  recordGenerateWaveProgress,
  type TaskCreateOptions,
  type TaskCreateResult,
  type TaskListOptions,
  type TaskListResult,
  type TaskGetOptions,
  type TaskGetResult,
  type TaskUpdateOptions,
  type TaskUpdateResult,
  type TaskApprovePlanOptions,
  type TaskApprovePlanResult,
  type TaskPauseOptions,
  type TaskPauseResult,
  type TaskResumeOptions,
  type TaskResumeResult,
  type TaskCompleteOptions,
  type TaskCompleteResult,
  type TaskAbandonOptions,
  type TaskAbandonResult,
  type TaskStatusResult,
  type RecordGenerateWaveOptions,
  type TaskKind,
  type TaskStatus,
  type TaskUpdatePatch,
  type WorkflowId,
  type WorkflowStepStatus,
} from "./task.js";
import {
  formatTaskCreate,
  formatTaskGet,
  formatTaskList,
  formatTaskStatus,
  formatTaskSimple,
  formatTaskUpdate,
} from "../../interfaces/cli/format/task.js";

export type WorkKind = TaskKind | "change";

export type {
  TaskListResult,
  TaskGetResult,
  TaskUpdateResult,
  TaskApprovePlanResult,
  TaskPauseResult,
  TaskResumeResult,
  TaskCompleteResult,
  TaskAbandonResult,
  TaskStatusResult,
};

export type WorkCreateOptions = Omit<TaskCreateOptions, "kind"> & { kind: WorkKind };
export type WorkCreateResult = TaskCreateResult;

/** Create a work item. kind "change" is an alias for "resolve". */
export async function runWorkCreate(opts: WorkCreateOptions): Promise<WorkCreateResult> {
  const kind: TaskKind = opts.kind === "change" ? "resolve" : opts.kind;
  return runTaskCreate({ ...opts, kind });
}

export const runWorkList = runTaskList;
export type WorkListOptions = TaskListOptions;

export const runWorkGet = runTaskGet;
export type WorkGetOptions = TaskGetOptions;

export const runWorkUpdate = runTaskUpdate;
export type WorkUpdateOptions = TaskUpdateOptions;

export const runWorkApprovePlan = runTaskApprovePlan;
export type WorkApprovePlanOptions = TaskApprovePlanOptions;

/** Record a generate-wave step (alias for recordGenerateWaveProgress). */
export const runWorkRecordStep = recordGenerateWaveProgress;
export type WorkRecordStepOptions = RecordGenerateWaveOptions;

export const runWorkPause = runTaskPause;
export type WorkPauseOptions = TaskPauseOptions;

export const runWorkResume = runTaskResume;
export type WorkResumeOptions = TaskResumeOptions;

export const runWorkComplete = runTaskComplete;
export type WorkCompleteOptions = TaskCompleteOptions;

export const runWorkAbandon = runTaskAbandon;
export type WorkAbandonOptions = TaskAbandonOptions;

export const runWorkStatus = runTaskStatus;

export const runWorkApproveImportPlan = runTaskApproveImportPlan;
export const runWorkApprovePackDesign = runTaskApprovePackDesign;

const TASK_DEPRECATION_WARNING =
  "[deprecated] task — use `npx ai-spector work` instead\n";

function normalizeWorkKind(kind: string): TaskKind {
  return kind === "change" ? "resolve" : (kind as TaskKind);
}

function registerWorkSubcommands(group: Command, opts: { deprecated: boolean }): void {
  if (opts.deprecated) {
    group.hook("preAction", () => {
      process.stderr.write(TASK_DEPRECATION_WARNING);
    });
  }

  group
    .command("create")
    .description("Create a new workflow work item")
    .requiredOption(
      "-k, --kind <kind>",
      opts.deprecated
        ? "generate | resolve | import"
        : "generate | resolve | change | import",
    )
    .requiredOption(
      "-w, --workflow <workflow>",
      "generate-srs | generate-basic-design | generate-detail-design | resolve | template-import",
    )
    .requiredOption("-t, --trigger <text>", "User intent that started this work item")
    .option("-C, --cwd <path>", "Project root", process.cwd())
    .option("--doc-type <type>", "Doc type for generate workflows (e.g. srs)")
    .option("--force", "Replace existing active work item in the same slot")
    .option("--json", "JSON output")
    .action(async (cmdOpts) => {
      const result = await runWorkCreate({
        root: resolve(cmdOpts.cwd ?? process.cwd()),
        kind: cmdOpts.kind as WorkKind,
        workflow: cmdOpts.workflow as WorkflowId,
        trigger: cmdOpts.trigger,
        docType: cmdOpts.docType,
        force: cmdOpts.force,
      });
      if (cmdOpts.json) console.log(JSON.stringify(result, null, 2));
      else console.log(formatTaskCreate(result));
    });

  group
    .command("list")
    .description("List work items")
    .option("-C, --cwd <path>", "Project root", process.cwd())
    .option("-s, --status <status>", "Filter by status (comma-separated)")
    .option("-k, --kind <kind>", opts.deprecated ? "generate | resolve | import" : "generate | resolve | change | import")
    .option("-w, --workflow <workflow>", "Workflow id filter")
    .option("--recent", "Only work items in index.recent")
    .option(
      "--bootstrap-trigger <text>",
      "Create work item if workflow slot is empty (requires -k and -w)",
    )
    .option("--doc-type <type>", "Doc type when bootstrapping a generate work item")
    .option("--force", "Replace existing active work item when bootstrapping")
    .option("--json", "JSON output")
    .action(async (cmdOpts) => {
      const status = cmdOpts.status
        ? (cmdOpts.status as string).split(",").map((s: string) => s.trim()) as TaskStatus[]
        : undefined;
      const bootstrapTrigger = cmdOpts.bootstrapTrigger as string | undefined;
      if (bootstrapTrigger && (!cmdOpts.kind || !cmdOpts.workflow)) {
        throw new Error("--bootstrap-trigger requires -k/--kind and -w/--workflow");
      }
      const kind = cmdOpts.kind ? normalizeWorkKind(cmdOpts.kind as string) : undefined;
      const bootstrapKind = cmdOpts.kind ? normalizeWorkKind(cmdOpts.kind as string) : undefined;
      const result = await runWorkList({
        root: resolve(cmdOpts.cwd ?? process.cwd()),
        status: status?.length === 1 ? status[0] : status,
        kind,
        workflow: cmdOpts.workflow as WorkflowId | undefined,
        recentOnly: cmdOpts.recent,
        bootstrap: bootstrapTrigger
          ? {
              kind: bootstrapKind!,
              workflow: cmdOpts.workflow as WorkflowId,
              trigger: bootstrapTrigger,
              docType: cmdOpts.docType as string | undefined,
              force: Boolean(cmdOpts.force),
            }
          : undefined,
      });
      if (cmdOpts.json) console.log(JSON.stringify(result, null, 2));
      else console.log(formatTaskList(result));
    });

  group
    .command("status")
    .description("Show active workflow work item slots (generate / resolve / import)")
    .option("-C, --cwd <path>", "Project root", process.cwd())
    .option("--json", "JSON output")
    .action(async (cmdOpts) => {
      const result = await runWorkStatus({
        root: resolve(cmdOpts.cwd ?? process.cwd()),
      });
      if (cmdOpts.json) console.log(JSON.stringify(result, null, 2));
      else console.log(formatTaskStatus(result));
    });

  group
    .command("get <taskId>")
    .description("Get full work item state")
    .option("-C, --cwd <path>", "Project root", process.cwd())
    .option("--json", "JSON output")
    .action(async (taskId, cmdOpts) => {
      const result = await runWorkGet({
        root: resolve(cmdOpts.cwd ?? process.cwd()),
        taskId,
      });
      if (cmdOpts.json) console.log(JSON.stringify(result, null, 2));
      else console.log(formatTaskGet(result));
    });

  group
    .command("update <taskId>")
    .description("Patch work item state (pass --patch as JSON)")
    .option("-C, --cwd <path>", "Project root", process.cwd())
    .option("--patch <json>", "JSON patch object (TaskUpdatePatch)")
    .option("--json", "JSON output")
    .action(async (taskId, cmdOpts) => {
      if (!cmdOpts.patch) {
        throw new Error("--patch is required (JSON object)");
      }
      const patch = JSON.parse(cmdOpts.patch as string) as TaskUpdatePatch;
      const result = await runWorkUpdate({
        root: resolve(cmdOpts.cwd ?? process.cwd()),
        taskId,
        patch,
      });
      if (cmdOpts.json) console.log(JSON.stringify(result, null, 2));
      else console.log(formatTaskUpdate(result));
    });

  group
    .command("approve <taskId>")
    .description("Approve the work item plan and advance to the next step")
    .option("-C, --cwd <path>", "Project root", process.cwd())
    .option("--by <email>", "Approver email override (default: git user.email)")
    .option("--username <name>", "Approver name override (default: git user.name)")
    .option("--role <role>", "Actor role: user | client (default: user)")
    .option("--plan <json>", "Plan JSON (StoredPlan) if not already set on work item")
    .option("--json", "JSON output")
    .action(async (taskId, cmdOpts) => {
      const result = await runWorkApprovePlan({
        root: resolve(cmdOpts.cwd ?? process.cwd()),
        taskId,
        plan: cmdOpts.plan ? JSON.parse(cmdOpts.plan as string) : undefined,
        by: cmdOpts.by,
        username: cmdOpts.username,
        role: cmdOpts.role,
      });
      if (cmdOpts.json) console.log(JSON.stringify(result, null, 2));
      else console.log(formatTaskSimple("Approved plan for", result));
    });

  group
    .command("approve-import-plan <taskId>")
    .description("Import work item: approve manifest plan after user yes (not work approve)")
    .option("-C, --cwd <path>", "Project root", process.cwd())
    .option("--plan <json>", "ImportPlan JSON (StoredPlan kind import) if not already on work item")
    .option("--json", "JSON output")
    .action(async (taskId, cmdOpts) => {
      const result = await runWorkApproveImportPlan({
        root: resolve(cmdOpts.cwd ?? process.cwd()),
        taskId,
        plan: cmdOpts.plan ? JSON.parse(cmdOpts.plan as string) : undefined,
      });
      if (cmdOpts.json) console.log(JSON.stringify(result, null, 2));
      else console.log(formatTaskSimple("Approved import manifest plan for", result));
    });

  group
    .command("approve-pack-design <taskId>")
    .description("Import work item: record approved pack design spec path after user yes")
    .option("-C, --cwd <path>", "Project root", process.cwd())
    .requiredOption(
      "--design-spec <path>",
      "Relative path to approved pack design spec (e.g. docs/superpowers/specs/…-pack-design.md)",
    )
    .option("--json", "JSON output")
    .action(async (taskId, cmdOpts) => {
      const result = await runWorkApprovePackDesign({
        root: resolve(cmdOpts.cwd ?? process.cwd()),
        taskId,
        designSpecPath: cmdOpts.designSpec as string,
      });
      if (cmdOpts.json) console.log(JSON.stringify(result, null, 2));
      else console.log(formatTaskSimple("Approved pack design spec for", result));
    });

  group
    .command("pause <taskId>")
    .description("Pause a work item")
    .option("-C, --cwd <path>", "Project root", process.cwd())
    .option("--json", "JSON output")
    .action(async (taskId, cmdOpts) => {
      const result = await runWorkPause({
        root: resolve(cmdOpts.cwd ?? process.cwd()),
        taskId,
      });
      if (cmdOpts.json) console.log(JSON.stringify(result, null, 2));
      else console.log(formatTaskSimple("Paused", result));
    });

  group
    .command("resume <taskId>")
    .description("Resume a paused work item (validates workspace and drift)")
    .option("-C, --cwd <path>", "Project root", process.cwd())
    .option("--json", "JSON output")
    .action(async (taskId, cmdOpts) => {
      const result = await runWorkResume({
        root: resolve(cmdOpts.cwd ?? process.cwd()),
        taskId,
      });
      if (cmdOpts.json) console.log(JSON.stringify(result, null, 2));
      else {
        const lines = [
          `Resume ${result.task.id} — canContinue: ${result.canContinue}`,
          `  workspace: ${result.workspaceOk ? "ok" : "errors"}`,
          `  drift:     ${result.drift.length} file(s)`,
          `  stale:     ${result.staleContextIds.join(", ") || "none"}`,
          `  next:      ${result.suggestedNext}`,
        ];
        if (result.drift.length > 0) {
          for (const d of result.drift) {
            lines.push(`    ${d.kind}: ${d.path}`);
          }
        }
        console.log(lines.join("\n"));
      }
    });

  group
    .command("complete <taskId>")
    .description("Mark a work item complete")
    .option("-C, --cwd <path>", "Project root", process.cwd())
    .option("--summary <text>", "Completion summary")
    .option("--json", "JSON output")
    .action(async (taskId, cmdOpts) => {
      const result = await runWorkComplete({
        root: resolve(cmdOpts.cwd ?? process.cwd()),
        taskId,
        summary: cmdOpts.summary,
      });
      if (cmdOpts.json) console.log(JSON.stringify(result, null, 2));
      else console.log(formatTaskSimple("Completed", result));
    });

  const recordStep = group
    .command("record-step <taskId> <stepId>")
    .description("Record generate step progress (e.g. wave-1 done with artifacts)");
  if (opts.deprecated) {
    recordStep
      .alias("record-wave")
      .description("Record generate wave progress (deprecated alias — use record-step)");
  }
  recordStep
    .option("-C, --cwd <path>", "Project root", process.cwd())
    .option("-s, --status <status>", "done | in-progress | blocked", "done")
    .option("--artifacts <paths>", "Comma-separated doc paths written this step")
    .option("--blocker <text>", "Blocker message when status is blocked")
    .option("--json", "JSON output")
    .action(async (taskId, stepId, cmdOpts) => {
      const result = await runWorkRecordStep({
        root: resolve(cmdOpts.cwd ?? process.cwd()),
        taskId,
        waveId: stepId,
        status: cmdOpts.status as WorkflowStepStatus,
        artifacts: cmdOpts.artifacts
          ? (cmdOpts.artifacts as string).split(",").map((p: string) => p.trim()).filter(Boolean)
          : undefined,
        blocker: cmdOpts.blocker ?? null,
      });
      if (cmdOpts.json) console.log(JSON.stringify(result, null, 2));
      else console.log(formatTaskUpdate(result));
    });

  group
    .command("abandon <taskId>")
    .description("Abandon a work item")
    .option("-C, --cwd <path>", "Project root", process.cwd())
    .option("--reason <text>", "Why the work item was abandoned")
    .option("--json", "JSON output")
    .action(async (taskId, cmdOpts) => {
      const result = await runWorkAbandon({
        root: resolve(cmdOpts.cwd ?? process.cwd()),
        taskId,
        reason: cmdOpts.reason,
      });
      if (cmdOpts.json) console.log(JSON.stringify(result, null, 2));
      else console.log(formatTaskSimple("Abandoned", result));
    });
}

/** Register the primary `work` CLI command group. */
export function registerWorkCommands(program: Command): void {
  const work = program
    .command("work")
    .description("Workflow work item state (persist plan/progress across sessions)");
  registerWorkSubcommands(work, { deprecated: false });
}

/** Register deprecated `task` CLI command group (delegates to runWork* handlers). */
export function registerTaskCommands(program: Command): void {
  const task = program
    .command("task")
    .description("Workflow task state (deprecated — use `work`)");
  registerWorkSubcommands(task, { deprecated: true });
}
