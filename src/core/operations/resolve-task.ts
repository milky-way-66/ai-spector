// Resolve Task workflow: intent → clarify → plan → execute → update state

export type TaskDomain =
  | "docs"
  | "prototype"
  | "graph"
  | "template"
  | "lang"
  | "index"
  | "comments"
  | "other";

export type TaskStepStatus = "pending" | "in-progress" | "done" | "blocked";
export type TaskRiskLevel = "low" | "medium" | "high" | "critical";

// ── Phase 2 output ────────────────────────────────────────────────────────────

export interface GoalSpec {
  trigger: string;
  domain: TaskDomain;
  scope: string[];         // file paths / node IDs expected to change
  criteria: string[];      // acceptance criteria ("done when…")
  notes?: string;          // extra context from clarification
}

// ── Phase 3 output ────────────────────────────────────────────────────────────

export interface TaskStep {
  id: string;
  description: string;
  tool: string;            // which run* function or MCP tool handles this
  args: Record<string, unknown>;
  status: TaskStepStatus;
  output?: unknown;
  blockerReason?: string;
}

export interface ImpactSummary {
  nodeId: string;
  directCallers: number;
  riskLevel: TaskRiskLevel;
}

export interface TaskPlan {
  id: string;
  goal: GoalSpec;
  steps: TaskStep[];
  impactMap: ImpactSummary[];
  riskLevel: TaskRiskLevel;
  approvedAt?: string;     // ISO timestamp
}

// ── Phase 4 output ────────────────────────────────────────────────────────────

export interface StepResult {
  stepId: string;
  status: TaskStepStatus;
  artifacts: string[];     // file paths written/modified
  issue?: string;
}

export interface ExecutionResult {
  planId: string;
  steps: StepResult[];
  artifacts: string[];
  issues: string[];
}

// ── Phase 5 output ────────────────────────────────────────────────────────────

export interface StateUpdate {
  planId: string;
  reindexed: string[];
  graphDiff: { added: number; removed: number; modified: number };
  commitSha?: string;
  summary: string;
}

// ── Top-level result ─────────────────────────────────────────────────────────

export interface ResolveTaskResult {
  plan: TaskPlan;
  execution: ExecutionResult;
  stateUpdate: StateUpdate;
  status: "complete" | "partial" | "blocked";
}

// ── Step executor ─────────────────────────────────────────────────────────────

// Callers inject a map of tool name → async function so that core stays free
// of interface-layer imports. The CLI and MCP handler each provide their own
// executor map built from the run* functions they already import.
export type StepExecutor = (
  args: Record<string, unknown>,
  projectRoot: string,
) => Promise<{ artifacts?: string[] }>;

export type ExecutorMap = Record<string, StepExecutor>;

// ── Options ──────────────────────────────────────────────────────────────────

export interface ResolveTaskOptions {
  intent: string;
  goalSpec: GoalSpec;
  plan: TaskPlan;
  projectRoot: string;
  graphPath: string;
  rulesPath: string;
  executors?: ExecutorMap;
  dryRun?: boolean;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function maxRisk(levels: TaskRiskLevel[]): TaskRiskLevel {
  const order: TaskRiskLevel[] = ["low", "medium", "high", "critical"];
  return levels.reduce(
    (max, lvl) => (order.indexOf(lvl) > order.indexOf(max) ? lvl : max),
    "low" as TaskRiskLevel,
  );
}

export function buildPlanId(): string {
  return `task-${Date.now().toString(36)}`;
}

export function createGoalSpec(
  intent: string,
  domain: TaskDomain,
  scope: string[],
  criteria: string[],
  notes?: string,
): GoalSpec {
  return { trigger: intent, domain, scope, criteria, notes };
}

export function createPlan(
  goal: GoalSpec,
  steps: Omit<TaskStep, "status">[],
  impactMap: ImpactSummary[],
): TaskPlan {
  const riskLevel = maxRisk(impactMap.map((i) => i.riskLevel));
  return {
    id: buildPlanId(),
    goal,
    steps: steps.map((s) => ({ ...s, status: "pending" })),
    impactMap,
    riskLevel,
  };
}

// ── Core runner ───────────────────────────────────────────────────────────────

export async function runResolveTask(
  opts: ResolveTaskOptions,
): Promise<ResolveTaskResult> {
  const { plan, projectRoot, executors = {}, dryRun = false } = opts;

  const stepResults: StepResult[] = [];
  const allArtifacts: string[] = [];
  const issues: string[] = [];

  for (const step of plan.steps) {
    step.status = "in-progress";

    if (dryRun) {
      stepResults.push({ stepId: step.id, status: "done", artifacts: [] });
      step.status = "done";
      continue;
    }

    const executor = executors[step.tool];
    if (!executor) {
      const msg = `No executor registered for tool "${step.tool}"`;
      step.status = "blocked";
      step.blockerReason = msg;
      issues.push(`Step ${step.id} blocked: ${msg}`);
      stepResults.push({ stepId: step.id, status: "blocked", artifacts: [], issue: msg });
      continue;
    }

    try {
      const out = await executor(step.args, projectRoot);
      const artifacts = out.artifacts ?? [];
      step.status = "done";
      step.output = out;
      stepResults.push({ stepId: step.id, status: "done", artifacts });
      allArtifacts.push(...artifacts);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      step.status = "blocked";
      step.blockerReason = msg;
      issues.push(`Step ${step.id} blocked: ${msg}`);
      stepResults.push({ stepId: step.id, status: "blocked", artifacts: [], issue: msg });
    }
  }

  const anyBlocked = stepResults.some((r) => r.status === "blocked");
  const allDone = stepResults.every((r) => r.status === "done");

  const execution: ExecutionResult = {
    planId: plan.id,
    steps: stepResults,
    artifacts: allArtifacts,
    issues,
  };

  const stateUpdate: StateUpdate = {
    planId: plan.id,
    reindexed: dryRun ? [] : allArtifacts,
    graphDiff: { added: 0, removed: 0, modified: allArtifacts.length },
    summary: dryRun
      ? `dry-run: ${plan.steps.length} steps planned, no changes written`
      : `${allArtifacts.length} file(s) changed across ${plan.steps.length} steps`,
  };

  return {
    plan,
    execution,
    stateUpdate,
    status: allDone ? "complete" : anyBlocked ? "blocked" : "partial",
  };
}
