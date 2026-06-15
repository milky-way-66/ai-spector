import type { ReviewSessionFile, ReviewSessionPhase } from "../reviews/types.js";

export type WorkflowId =
  | "doc-review"
  | "resolve-comments"
  | "generate-srs"
  | "generate-basic-design"
  | "generate-prototype"
  | "resolve-task"
  | "task-router"
  | "spec-queue"
  | "graph-ops"
  | "search"
  | "setup-check";

export interface WorkflowRouteActiveTask {
  id: string;
  kind: string;
  planApproved: boolean;
}

export interface WorkflowRouteContext {
  reviewSession: ReviewSessionFile | null;
  activeTask: WorkflowRouteActiveTask | null;
}

export interface WorkflowRouteAskOption {
  id: string;
  label: string;
  skill: string;
  workflowId?: WorkflowId;
  tool?: string;
}

export interface WorkflowRouteHandoff {
  workflowId: WorkflowId;
  skill: string;
  phase: string;
  userGoal: string;
  resumeFromState: boolean;
  readBrief: string;
  runInBackground: boolean;
  allowedTools?: string[];
  forbiddenTools?: string[];
  context?: {
    reviewSessionPhase?: ReviewSessionPhase;
    activeLogicalPath?: string | null;
    activeTaskId?: string;
    planApproved?: boolean;
  };
}

export interface WorkflowRouteResult {
  skill: string;
  workflowId?: WorkflowId;
  confidence: "high" | "medium" | "low";
  matchedBy: string;
  message: string;
  handoff?: WorkflowRouteHandoff;
  nextTools?: string[];
  avoidTools?: string[];
  askUser?: { question: string; options: WorkflowRouteAskOption[] };
  context?: WorkflowRouteHandoff["context"];
}

const SKILL_TO_WORKFLOW: Record<string, WorkflowId> = {
  "ai-spector-review": "doc-review",
  "ai-spector-resolve-comments": "resolve-comments",
  "ai-spector-generate-srs": "generate-srs",
  "ai-spector-generate-basic-design": "generate-basic-design",
  "ai-spector-generate-prototype": "generate-prototype",
  "ai-spector-resolve-task": "resolve-task",
  "ai-spector-task": "task-router",
  "ai-spector-generate": "spec-queue",
  "ai-spector-graph": "graph-ops",
  "ai-spector-search": "search",
  "ai-spector-setup": "setup-check",
  "ai-spector-check": "setup-check",
};

const APPROVE_DISAMBIGUATION: WorkflowRouteAskOption[] = [
  {
    id: "doc_signoff",
    label: "Sign off a document (e.g. srs/01-overview)",
    skill: "ai-spector-review",
    workflowId: "doc-review",
    tool: "review_approve",
  },
  {
    id: "spec",
    label: "Approve an extracted spec (e.g. SPEC-003)",
    skill: "ai-spector-generate",
    workflowId: "spec-queue",
    tool: "spec_approve",
  },
  {
    id: "plan",
    label: "Go ahead with the plan we discussed",
    skill: "ai-spector-resolve-task",
    workflowId: "resolve-task",
    tool: "task_approve_plan",
  },
  {
    id: "comment",
    label: "Mark a comment thread done (e.g. C-012)",
    skill: "ai-spector-resolve-comments",
    workflowId: "resolve-comments",
    tool: "comments_resolve",
  },
];

const ACTIVE_REVIEW_PHASES = new Set<ReviewSessionPhase>([
  "queue",
  "reviewing",
  "awaiting_decision",
]);

function normalizeMessage(message: string): string {
  return message.trim().toLowerCase();
}

function hasActiveReviewSession(session: ReviewSessionFile | null): boolean {
  return !!session && ACTIVE_REVIEW_PHASES.has(session.phase);
}

function buildContext(ctx: WorkflowRouteContext): WorkflowRouteResult["context"] {
  return {
    ...(ctx.reviewSession ? { reviewSessionPhase: ctx.reviewSession.phase } : {}),
    ...(ctx.reviewSession ? { activeLogicalPath: ctx.reviewSession.activeLogicalPath } : {}),
    ...(ctx.activeTask ? { activeTaskId: ctx.activeTask.id } : {}),
    ...(ctx.activeTask ? { planApproved: ctx.activeTask.planApproved } : {}),
  };
}

function skillToWorkflowId(skill: string): WorkflowId | undefined {
  return SKILL_TO_WORKFLOW[skill];
}

function inferPhase(
  skill: string,
  ctx: WorkflowRouteContext,
  matchedBy: string,
): string {
  if (skill === "ai-spector-review") {
    return ctx.reviewSession?.phase ?? (matchedBy === "logical_path_signoff" ? "reviewing" : "detect");
  }
  if (skill === "ai-spector-resolve-comments") {
    return "inbox";
  }
  if (skill === "ai-spector-resolve-task") {
    if (ctx.activeTask?.planApproved) {
      return "execute";
    }
    if (ctx.activeTask) {
      return "awaiting_yes";
    }
    return "clarify";
  }
  if (skill === "ai-spector-generate-srs" || skill === "ai-spector-generate-basic-design") {
    if (ctx.activeTask?.planApproved) {
      return "approved";
    }
    if (ctx.activeTask) {
      return "plan";
    }
    return "bootstrap";
  }
  if (skill === "ai-spector-generate-prototype") {
    return "setup";
  }
  if (skill === "ai-spector-task") {
    return "list";
  }
  if (skill === "ai-spector-generate") {
    return "list";
  }
  if (skill === "ai-spector-graph" || skill === "ai-spector-search") {
    return "execute";
  }
  if (skill === "ai-spector-setup" || skill === "ai-spector-check") {
    return skill === "ai-spector-check" ? "check" : "setup";
  }
  return "start";
}

function buildHandoff(
  workflowId: WorkflowId,
  skill: string,
  userGoal: string,
  ctx: WorkflowRouteContext,
  matchedBy: string,
  allowedTools?: string[],
  forbiddenTools?: string[],
): WorkflowRouteHandoff {
  const hasPersistedState =
    !!ctx.reviewSession || !!ctx.activeTask;
  const gated = !["graph-ops", "search"].includes(workflowId);

  return {
    workflowId,
    skill,
    phase: inferPhase(skill, ctx, matchedBy),
    userGoal,
    resumeFromState: hasPersistedState,
    readBrief: `.cursor/subagents/${workflowId}.md`,
    runInBackground: !gated,
    ...(allowedTools?.length ? { allowedTools } : {}),
    ...(forbiddenTools?.length ? { forbiddenTools } : {}),
    context: buildContext(ctx),
  };
}

function result(
  skill: string,
  confidence: WorkflowRouteResult["confidence"],
  matchedBy: string,
  message: string,
  ctx: WorkflowRouteContext,
  extra?: Pick<WorkflowRouteResult, "nextTools" | "avoidTools" | "askUser">,
): WorkflowRouteResult {
  const workflowId = skillToWorkflowId(skill);
  const base: WorkflowRouteResult = {
    skill,
    confidence,
    matchedBy,
    message,
    context: buildContext(ctx),
    ...extra,
    ...(workflowId ? { workflowId } : {}),
  };

  if (workflowId && !extra?.askUser) {
    base.handoff = buildHandoff(
      workflowId,
      skill,
      message,
      ctx,
      matchedBy,
      extra?.nextTools,
      extra?.avoidTools,
    );
  }

  return base;
}

function ambiguousApprove(message: string, ctx: WorkflowRouteContext): WorkflowRouteResult {
  if (ctx.activeTask && !ctx.activeTask.planApproved) {
    return result(
      ctx.activeTask.kind === "generate" ? "ai-spector-generate-srs" : "ai-spector-resolve-task",
      "medium",
      "active_task_awaiting_plan",
      "Active task has a plan awaiting approval — use task_approve_plan after user says yes.",
      ctx,
      {
        nextTools: ["task_get", "task_approve_plan"],
        avoidTools: ["review_approve", "spec_approve", "comments_resolve"],
      },
    );
  }

  if (hasActiveReviewSession(ctx.reviewSession)) {
    const lp = ctx.reviewSession!.activeLogicalPath;
    return result(
      "ai-spector-review",
      "medium",
      "active_review_session",
      lp
        ? `Document review in progress for ${lp} — continue ai-spector-review runbook.`
        : "Document review session active — continue ai-spector-review runbook.",
      ctx,
      {
        nextTools:
          ctx.reviewSession!.phase === "awaiting_decision"
            ? ["review_approve", "review_reject"]
            : ["review_status", "readiness_scan", "readiness_output_checklist", "review_session_ack_review"],
        avoidTools: ["spec_approve", "task_approve_plan", "comments_resolve"],
      },
    );
  }

  return result(
    "ai-spector",
    "low",
    "ambiguous_approve",
    "Intent unclear — ask the user which approval type they mean.",
    ctx,
    {
      askUser: {
        question: "Which did you mean?",
        options: APPROVE_DISAMBIGUATION,
      },
      avoidTools: ["review_approve", "spec_approve", "task_approve_plan", "comments_resolve"],
    },
  );
}

/** Rule-based skill/MCP routing from user message + persisted session/task context. */
export function classifyWorkflowIntent(
  message: string,
  ctx: WorkflowRouteContext,
): WorkflowRouteResult {
  const msg = normalizeMessage(message);
  if (!msg) {
    return result(
      "ai-spector",
      "low",
      "empty_message",
      "No message to classify — ask the user what they want to do.",
      ctx,
    );
  }

  // Active review session overrides generic "continue"/"resume"
  if (hasActiveReviewSession(ctx.reviewSession)) {
    const continueLike =
      /\b(continue|resume|go ahead|looks good|approve|yes|next)\b/.test(msg) &&
      !/\b(task|generation|spec|c-\d+)\b/.test(msg);
    if (continueLike || /\b(review|sign.?off|queue)\b/.test(msg) || msg.startsWith("/review")) {
      return result(
        "ai-spector-review",
        "high",
        "active_review_session",
        "Active document review session — follow ai-spector-review runbook.",
        ctx,
        {
          nextTools: ["review_status", "review_queue", "review_check"],
          avoidTools: ["spec_approve", "task_approve_plan", "comments_resolve"],
        },
      );
    }
  }

  if (msg.startsWith("/review") || /\breview queue\b/.test(msg) || /\bpending client\b/.test(msg)) {
    return result(
      "ai-spector-review",
      "high",
      "review_command",
      "Document sign-off workflow — ai-spector-review.",
      ctx,
      {
        nextTools: ["review_check", "review_queue"],
        avoidTools: ["spec_approve", "task_approve_plan", "comments_resolve"],
      },
    );
  }

  if (/\bspec-\d{3}\b/i.test(message) && /\b(approve|reject|review)\b/.test(msg)) {
    return result(
      "ai-spector-generate",
      "high",
      "spec_id",
      "Extracted spec queue — use spec_approve / spec_reject, not review_approve.",
      ctx,
      {
        nextTools: ["spec_list", "spec_approve"],
        avoidTools: ["review_approve", "task_approve_plan", "comments_resolve"],
      },
    );
  }

  if (/\bc-\d{3}\b/i.test(message) || /\b(resolve|inbox|open thread|comment thread)\b/.test(msg)) {
    return result(
      "ai-spector-resolve-comments",
      "high",
      "comment_thread",
      "Comment thread workflow — ai-spector-resolve-comments.",
      ctx,
      {
        nextTools: ["comments_inbox", "comments_show", "comments_resolve"],
        avoidTools: ["review_approve", "spec_approve", "task_approve_plan"],
      },
    );
  }

  if (
    /\b(srs|bd|dd)\/[\w.-]+/.test(msg) &&
    /\b(approve|sign.?off|review status|what changed)\b/.test(msg)
  ) {
    return result(
      "ai-spector-review",
      "high",
      "logical_path_signoff",
      "Document sign-off by logical path — ai-spector-review before review_approve.",
      ctx,
      {
        nextTools: ["review_status", "review_check"],
        avoidTools: ["spec_approve", "task_approve_plan", "comments_resolve"],
      },
    );
  }

  if (/\bgenerate\b.*\bsrs\b/.test(msg) || /\bwrite chapter\b/.test(msg) || /\bdag wave\b/.test(msg) || /\bgenerate basic design\b/.test(msg)) {
    return result(
      "ai-spector-generate-srs",
      "high",
      "full_generate",
      "Full generation workflow — create/resume task, plan gate, then generate.",
      ctx,
      {
        nextTools: ["task_list", "workspace_check"],
        avoidTools: ["review_approve", "resolve_task"],
      },
    );
  }

  if (
    /\b(add|update|change|modify|extend)\b/.test(msg) ||
    /\b(i want to|we need to|create task)\b/.test(msg)
  ) {
    return result(
      "ai-spector-resolve-task",
      "high",
      "incremental_change",
      "Incremental change — clarify, plan, task_approve_plan, then execute.",
      ctx,
      {
        nextTools: ["task_create", "task_list"],
        avoidTools: ["review_approve", "spec_approve"],
      },
    );
  }

  if (/\b(resume|continue|active tasks?|pick up|in progress)\b/.test(msg)) {
    return result(
      "ai-spector-task",
      "medium",
      "task_resume",
      "Task resume — list active tasks and route to generate or resolve skill.",
      ctx,
      { nextTools: ["task_list", "task_status"] },
    );
  }

  if (
    /\b(approve|looks good|go ahead|yes)\b/.test(msg) &&
    !/\b(srs|bd|dd|spec|c-)\b/.test(msg)
  ) {
    return ambiguousApprove(message, ctx);
  }

  if (/\b(analyze|index|validate graph|graph impact|semantic search)\b/.test(msg)) {
    const skill = /\b(search|find docs|mentions of)\b/.test(msg)
      ? "ai-spector-search"
      : "ai-spector-graph";
    return result(skill, "medium", "graph_or_search", `Route to ${skill}.`, ctx);
  }

  if (/\b(setup|init|bootstrap|check workspace)\b/.test(msg)) {
    const skill = /\bcheck\b/.test(msg) ? "ai-spector-check" : "ai-spector-setup";
    return result(skill, "medium", "setup_or_check", `Route to ${skill}.`, ctx);
  }

  return result(
    "ai-spector",
    "low",
    "fallback",
    "No strong match — read _skill-router.md or ask one clarifying question.",
    ctx,
    {
      askUser: {
        question: "What would you like to do?",
        options: [
          { id: "review", label: "Review / sign off documents", skill: "ai-spector-review", workflowId: "doc-review" },
          { id: "generate", label: "Generate or update documentation", skill: "ai-spector-generate", workflowId: "generate-srs" },
          { id: "comments", label: "Resolve comment threads", skill: "ai-spector-resolve-comments", workflowId: "resolve-comments" },
          { id: "graph", label: "Graph, index, or search", skill: "ai-spector-graph", workflowId: "graph-ops" },
        ],
      },
    },
  );
}
