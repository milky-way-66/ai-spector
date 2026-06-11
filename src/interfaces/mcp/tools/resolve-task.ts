import { resolveProjectPaths } from "../../../core/util/paths.js";
import {
  runResolveTask,
  createGoalSpec,
  createPlan,
  type ExecutorMap,
  type ImpactSummary,
} from "../../../core/operations/resolve-task.js";
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

  // Rebuild impactMap from scope items so the core runner can compute riskLevel.
  // MCP callers can pass pre-computed impactMap via plan; here we provide a
  // zero-impact default so the runner can proceed without a graph query.
  const impactMap: ImpactSummary[] = input.plan.goal.scope.map((nodeId) => ({
    nodeId,
    directCallers: 0,
    riskLevel: "low" as const,
  }));

  const goalSpec = createGoalSpec(
    input.goalSpec.trigger,
    input.goalSpec.domain,
    input.goalSpec.scope,
    input.goalSpec.criteria,
    input.goalSpec.notes,
  );

  const plan = createPlan(goalSpec, input.plan.steps, impactMap);
  plan.approvedAt = new Date().toISOString();

  const result = await runResolveTask({
    intent: input.intent,
    goalSpec,
    plan,
    projectRoot: paths.root,
    graphPath: paths.graph,
    rulesPath: paths.rulesImpact,
    executors: MCP_EXECUTORS,
    dryRun: input.dryRun,
  });

  return result;
}
