import { resolveProjectPaths } from "../../../core/util/paths.js";
import {
  runResolveTask,
  createGoalSpec,
  createPlan,
  type ExecutorMap,
  type ImpactSummary,
} from "../../../core/operations/resolve-task.js";
import {
  loadResolveExecutionContext,
  recordResolveStepProgress,
} from "../../../core/operations/task.js";
import { runIndex } from "../../../core/operations/index.js";
import { runGraphImpact } from "../../../core/operations/graph-impact.js";
import { runGraphMerge } from "../../../core/operations/graph-merge.js";
import { runGraphReport } from "../../../core/operations/graph-report.js";
import type { ResolveTaskSchema } from "../schemas.js";
import type { z } from "zod";

// Built-in executors available to the MCP resolve_task tool.
// Each key matches the `tool` field a caller puts in a TaskStep.
const MCP_EXECUTORS: ExecutorMap = {
  index: async (_args, root) => {
    await runIndex({ root, graphOnly: false, docsOnly: false });
    return { artifacts: [] };
  },
  graph_merge: async (_args, root) => {
    const result = await runGraphMerge({ root });
    return { artifacts: result.graphPath ? [result.graphPath] : [] };
  },
  graph_report: async (_args, root) => {
    await runGraphReport({ root });
    return { artifacts: [] };
  },
  graph_impact: async (args, root) => {
    await runGraphImpact({
      graphPath: String(args.graphPath ?? ""),
      rulesPath: String(args.rulesPath ?? ""),
      projectRoot: root,
      change: String(args.change ?? ""),
      originId: args.originId != null ? String(args.originId) : undefined,
      file: args.file != null ? String(args.file) : undefined,
    });
    return { artifacts: [] };
  },
};

export async function toolResolveTask(input: z.infer<typeof ResolveTaskSchema>) {
  const paths = await resolveProjectPaths(input.root);

  let intent: string;
  let goalSpec;
  let plan;

  if (input.taskId) {
    const ctx = await loadResolveExecutionContext({
      root: input.root ?? paths.root,
      taskId: input.taskId,
    });
    intent = ctx.intent;
    goalSpec = ctx.goalSpec;
    plan = ctx.plan;
  } else {
    if (!input.intent || !input.goalSpec || !input.plan) {
      throw new Error("Provide taskId or intent+goalSpec+plan");
    }
    const impactMap: ImpactSummary[] = input.plan.goal.scope.map((nodeId) => ({
      nodeId,
      directCallers: 0,
      riskLevel: "low" as const,
    }));
    goalSpec = createGoalSpec(
      input.goalSpec.trigger,
      input.goalSpec.domain,
      input.goalSpec.scope,
      input.goalSpec.criteria,
      input.goalSpec.notes,
    );
    plan = createPlan(goalSpec, input.plan.steps, impactMap);
    plan.approvedAt = new Date().toISOString();
    intent = input.intent;
  }

  const taskId = input.taskId;
  const onStepComplete = taskId
    ? async (event: import("../../../core/operations/resolve-task.js").ResolveStepProgressEvent) => {
        await recordResolveStepProgress({
          root: input.root ?? paths.root,
          taskId,
          plan: event.plan,
          stepId: event.stepId,
          stepStatus: event.status,
          artifacts: event.artifacts,
          blocker: event.issue ?? null,
        });
      }
    : undefined;

  const result = await runResolveTask({
    intent,
    goalSpec,
    plan,
    projectRoot: paths.root,
    graphPath: paths.graph,
    rulesPath: paths.rulesImpact,
    executors: MCP_EXECUTORS,
    dryRun: input.dryRun,
    onStepComplete,
  });

  return result;
}
