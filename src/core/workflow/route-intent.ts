import type { ReviewSessionFile, ReviewSessionPhase } from "../reviews/types.js";

export type WorkflowId =
  | "doc-review"
  | "resolve-comments"
  | "resolve-prototype-comments"
  | "generate-srs"
  | "generate-basic-design"
  | "generate-detail-design"
  | "generate-prototype"
  | "resolve-task"
  | "task-router"
  | "spec-queue"
  | "graph-ops"
  | "search"
  | "setup-check"
  | "course"
  | "lang-status"
  | "resolve-translation"
  | "template-import"
  | "adopt";

export interface WorkflowRouteActiveTask {
  id: string;
  kind: string;
  workflow?: string;
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
  "ai-spector-resolve-prototype-comments": "resolve-prototype-comments",
  "ai-spector-generate-srs": "generate-srs",
  "ai-spector-generate-basic-design": "generate-basic-design",
  "ai-spector-generate-detail-design": "generate-detail-design",
  "ai-spector-generate-prototype": "generate-prototype",
  "ai-spector-resolve-task": "resolve-task",
  "ai-spector-task": "task-router",
  "ai-spector-generate": "spec-queue",
  "ai-spector-graph": "graph-ops",
  "ai-spector-search": "search",
  "ai-spector-setup": "setup-check",
  "ai-spector-check": "setup-check",
  "ai-spector-course": "course",
  "ai-spector-lang-status": "lang-status",
  "ai-spector-resolve-translation": "resolve-translation",
  "ai-spector-template-import": "template-import",
  "ai-spector-adopt": "adopt",
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
  if (skill === "ai-spector-generate-srs" || skill === "ai-spector-generate-basic-design" || skill === "ai-spector-generate-detail-design") {
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
    return matchedBy === "clarifications" ? "clarify" : skill === "ai-spector-check" ? "check" : "setup";
  }
  if (skill === "ai-spector-course") {
    return "open";
  }
  if (skill === "ai-spector-lang-status") {
    return "queue";
  }
  if (skill === "ai-spector-resolve-translation") {
    return "translate";
  }
  if (skill === "ai-spector-template-import") {
    return "import";
  }
  return "start";
}

function skillReadBrief(skill: string, matchedBy?: string): string {
  if (skill === "ai-spector-generate") {
    return ".cursor/skills/ai-spector/references/extract-specs.md";
  }
  if (skill === "ai-spector-check" && matchedBy === "clarifications") {
    return ".cursor/skills/ai-spector/references/context-store.md";
  }
  const runbookSkills = new Set([
    "ai-spector-review",
    "ai-spector-resolve-comments",
    "ai-spector-generate-srs",
    "ai-spector-generate-basic-design",
    "ai-spector-generate-detail-design",
    "ai-spector-generate-prototype",
    "ai-spector-resolve-task",
    "ai-spector-task",
    "ai-spector-setup",
    "ai-spector-resolve-translation",
    "ai-spector-template-import",
  ]);
  if (skill === "ai-spector-course") {
    return ".cursor/skills/ai-spector-course/references/course-guide.md";
  }
  if (runbookSkills.has(skill)) {
    return `.cursor/skills/${skill}/references/runbook.md`;
  }
  return `.cursor/skills/${skill}/SKILL.md`;
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
  const gated = !["graph-ops", "search", "course", "lang-status"].includes(workflowId);

  return {
    workflowId,
    skill,
    phase: inferPhase(skill, ctx, matchedBy),
    userGoal,
    resumeFromState: hasPersistedState,
    readBrief: skillReadBrief(skill, matchedBy),
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

const REVIEW_AVOID_TOOLS = ["spec_approve", "task_approve_plan", "comments_resolve"] as const;

function isPrototypeCommentResolveIntent(msg: string, message: string): boolean {
  return (
    /\bb-\d{3}\b/i.test(message) ||
    /\b(resolve|fix|address)\b.*\bprototype\b.*\bcomments?\b/i.test(message) ||
    /\bprototype\b.*\bcomments?\b.*\b(resolve|fix|batch)\b/i.test(message) ||
    /\bresolve\b.*\bcomments?\b.*\b(screen|login|home)\b/i.test(message) ||
    /\b(login|home|index)\s+screen\b.*\bcomments?\b/i.test(message) ||
    /\bbatch\b.*\bprototype\b.*\bcomments?\b/i.test(message)
  );
}

function isCommentThreadIntent(msg: string, message: string): boolean {
  return (
    /\bc-\d{3}\b/i.test(message) ||
    /\b(resolve comments?|fix c-\d+)\b/i.test(message) ||
    /\b(inbox|open thread|comment thread)\b/.test(msg) ||
    /\breview comments?\b/.test(msg)
  );
}

function isLogicalPathSignoff(msg: string): boolean {
  return (
    /\b(srs|bd|dd|basic-design|detail-design)\/[\w.-]+/.test(msg) &&
    /\b(approve|sign.?off|review status|what changed)\b/.test(msg)
  );
}

function isDocReviewIntent(msg: string): boolean {
  return (
    msg.startsWith("/review") ||
    /\breview queue\b/.test(msg) ||
    /\bpending client\b/.test(msg) ||
    /\bpending review\b/.test(msg) ||
    /\breview documents?\b/.test(msg) ||
    /\breview docs?\b/.test(msg) ||
    /\bapprove (the )?(doc|document)\b/.test(msg) ||
    /\b(has|have) .+ been approved\b/.test(msg) ||
    /\bwhich docs? .+ reviewed\b/.test(msg) ||
    /\breview status\b/.test(msg) ||
    /\bwhat changed since (last )?approval\b/.test(msg) ||
    /\bapprove (the )?srs\b/.test(msg) ||
    /\bapprove (the )?basic design\b/.test(msg) ||
    /\bapprove (the )?detail design\b/.test(msg)
  );
}

function isTaskResumeIntent(msg: string): boolean {
  return (
    /\b(resume|continue|pick up)\b/.test(msg) ||
    /\bactive tasks?\b/.test(msg) ||
    /\btasks? (are |in )?active\b/.test(msg) ||
    /\bin progress\b/.test(msg) ||
    /\bwhat tasks?\b/.test(msg) ||
    /\bpause task\b/.test(msg)
  );
}

function isIncrementalChangeIntent(msg: string): boolean {
  // "I want to generate detail design" must not steal full-generate routing.
  if (
    isGenerateSrsIntent(msg) ||
    isGenerateBasicDesignIntent(msg) ||
    isGenerateDetailDesignIntent(msg) ||
    isGeneratePrototypeIntent(msg)
  ) {
    return false;
  }
  return (
    /\b(add|update|change|modify|extend)\b/.test(msg) ||
    /\b(i want to|we need to|create task)\b/.test(msg)
  );
}

function isDeriveSrsIntent(msg: string): boolean {
  return (
    /\bbackfill srs\b/.test(msg) ||
    /\bgenerate srs from\b/.test(msg) ||
    /\bexpand srs\b/.test(msg) ||
    /\bderive srs\b/.test(msg) ||
    /\bfill srs gaps\b/.test(msg)
  );
}

function isDeriveBasicDesignIntent(msg: string): boolean {
  return (
    /\bgenerate basic design from detail\b/.test(msg) ||
    /\bbackfill basic design\b/.test(msg) ||
    /\bderive basic design\b/.test(msg)
  );
}

function isGenerateSrsIntent(msg: string): boolean {
  return (
    isDeriveSrsIntent(msg) ||
    /\bgenerate\b.*\bsrs\b/.test(msg) ||
    /\bwrite (chapter|use cases?)\b/.test(msg) ||
    /\bdag wave\b/.test(msg)
  );
}

function isGenerateBasicDesignIntent(msg: string): boolean {
  if (isDeriveSrsIntent(msg)) {
    return false;
  }
  return (
    isDeriveBasicDesignIntent(msg) ||
    /\bgenerate basic design\b/.test(msg) ||
    /\b(screen list|api design|wireframes?|basic design)\b/.test(msg) ||
    /\bgenerate\b.*\b(screens?|apis?|wireframes?)\b/.test(msg)
  );
}

function isGenerateDetailDesignIntent(msg: string): boolean {
  return (
    /\bgenerate detail design\b/.test(msg) ||
    /\b(feature[- ]level design|implementation spec)\b/.test(msg) ||
    /\bdetail design\b/.test(msg) ||
    /\bdd\/[\w.-]+/.test(msg)
  );
}

function isGeneratePrototypeIntent(msg: string): boolean {
  return (
    /\b(html mockup|html prototype|prototype)\b/.test(msg) ||
    /\b(help me pick a theme|show me themes)\b/.test(msg)
  );
}

function isSpecQueueIntent(msg: string): boolean {
  return /\bpending specs?\b/.test(msg) || /\bspec queue\b/.test(msg);
}

function isLangStatusIntent(msg: string): boolean {
  return (
    /\bpending translations?\b/.test(msg) ||
    /\bwhat'?s stale in\b/.test(msg) ||
    /\btranslation (status|queue)\b/.test(msg)
  );
}

function isResolveTranslationIntent(msg: string): boolean {
  return (
    /\bresolve translations?\b/.test(msg) ||
    /\bsync translations?\b/.test(msg) ||
    /\bupdate (jp|vi|en) from\b/.test(msg) ||
    /\b(sync|update) (stale )?(jp|vi|en)\b/.test(msg)
  );
}

function isAdoptIntent(msg: string): boolean {
  return (
    /\bcontinue adopt\b/.test(msg) ||
    /\badopt\b/.test(msg) ||
    /\balign\b.*\blegacy\b/.test(msg) ||
    /\bmigrate\b.*\b(existing|legacy)\b/.test(msg) ||
    /\bwrong srs folder\b/.test(msg) ||
    /\blegacy srs\b/.test(msg) ||
    /\bmigrate\b.*\bai-?spector\b.*\bstructure\b/.test(msg)
  );
}

function isTemplateImportIntent(msg: string): boolean {
  return (
    /\b(import|install) template\b/.test(msg) ||
    /\btemplate pack\b/.test(msg) ||
    /\bset up template\b/.test(msg) ||
    /\bcustom template\b/.test(msg)
  );
}

function isCourseIntent(msg: string): boolean {
  return (
    /\b(open the course|learn ai-spector|walkthrough|tutorial)\b/.test(msg) ||
    /\bhow do i use\b/.test(msg) ||
    /\b(mở khóa học|khóa học)\b/.test(msg)
  );
}

function isClarificationIntent(msg: string): boolean {
  return (
    /\bstale clarifications?\b/.test(msg) ||
    /\bopen questions?\b/.test(msg) ||
    /\bwhat did i answer\b/.test(msg) ||
    /\bcontext store\b/.test(msg)
  );
}

function isWorkspaceCheckIntent(msg: string): boolean {
  return (
    /\bcheck (my )?workspace\b/.test(msg) ||
    /\bpre-commit\b/.test(msg) ||
    /\bwhy did pre-commit\b/.test(msg) ||
    /\bis the project set up correctly\b/.test(msg)
  );
}

function isSetupIntent(msg: string): boolean {
  return /\b(setup|init|bootstrap)\b/.test(msg) && !isWorkspaceCheckIntent(msg);
}

function isGraphIntent(msg: string): boolean {
  return (
    /\b(analyze|data source|knowledge graph)\b/.test(msg) ||
    /\b(validate|re-?index|sync) (the )?graph\b/.test(msg) ||
    /\bre-?index\b/.test(msg) ||
    /\bgraph (validate|impact|errors?|report)\b/.test(msg) ||
    /\bshow the graph\b/.test(msg) ||
    /\bwhat'?s impacted\b/.test(msg) ||
    /\bwhat should i regenerate\b/.test(msg)
  );
}

function isSearchIntent(msg: string): boolean {
  return (
    /\b(find all mentions|which docs describe|find docs about)\b/.test(msg) ||
    /\bmentions of\b/.test(msg) ||
    /\bsemantic search\b/.test(msg) ||
    (/\b(search|find)\b/.test(msg) && /\b(docs?|concept|topic)\b/.test(msg))
  );
}

function skillForGenerateTask(workflow?: string): string {
  switch (workflow) {
    case "generate-basic-design":
      return "ai-spector-generate-basic-design";
    case "generate-detail-design":
      return "ai-spector-generate-detail-design";
    case "generate-prototype":
      return "ai-spector-generate-prototype";
    default:
      return "ai-spector-generate-srs";
  }
}

function ambiguousApprove(message: string, ctx: WorkflowRouteContext): WorkflowRouteResult {
  if (ctx.activeTask && !ctx.activeTask.planApproved) {
    const skill =
      ctx.activeTask.kind === "generate"
        ? skillForGenerateTask(ctx.activeTask.workflow)
        : "ai-spector-resolve-task";
    return result(
      skill,
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

  if (isLogicalPathSignoff(msg)) {
    return result(
      "ai-spector-review",
      "high",
      "logical_path_signoff",
      "Document sign-off by logical path — ai-spector-review before review_approve.",
      ctx,
      {
        nextTools: ["review_status", "review_check"],
        avoidTools: [...REVIEW_AVOID_TOOLS],
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

  if (isSpecQueueIntent(msg)) {
    return result(
      "ai-spector-generate",
      "high",
      "spec_queue",
      "Extracted spec queue — list pending specs before approve/reject.",
      ctx,
      {
        nextTools: ["spec_list"],
        avoidTools: ["review_approve", "task_approve_plan", "comments_resolve"],
      },
    );
  }

  if (isResolveTranslationIntent(msg)) {
    return result(
      "ai-spector-resolve-translation",
      "high",
      "resolve_translation",
      "Translation sync workflow — process queue then re-index.",
      ctx,
      { nextTools: ["lang_queue", "index"] },
    );
  }

  if (isPrototypeCommentResolveIntent(msg, message)) {
    return result(
      "ai-spector-resolve-prototype-comments",
      "high",
      "prototype_comment_batch",
      "Prototype comment batch workflow — clarify, approaches, yes, then HTML + batch-resolve.",
      ctx,
      {
        nextTools: ["comments_facets", "comments_inbox", "comments_batch_plan", "comments_batch_resolve"],
        avoidTools: ["review_approve", "spec_approve", "task_approve_plan"],
      },
    );
  }

  if (isCommentThreadIntent(msg, message)) {
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

  if (isDocReviewIntent(msg)) {
    return result(
      "ai-spector-review",
      "high",
      "doc_review_intent",
      "Document sign-off workflow — ai-spector-review.",
      ctx,
      {
        nextTools: ["review_check", "review_queue"],
        avoidTools: [...REVIEW_AVOID_TOOLS],
      },
    );
  }

  if (isAdoptIntent(msg)) {
    return result(
      "ai-spector-adopt",
      "high",
      "adopt_legacy",
      "Legacy doc alignment — gated adopt task: scan → task_approve_adopt_plan → apply → index.",
      ctx,
      {
        nextTools: ["task_create", "workspace_check", "adopt_scan"],
        avoidTools: ["task_approve_plan", "review_approve"],
      },
    );
  }

  if (isTaskResumeIntent(msg)) {
    return result(
      "ai-spector-task",
      "medium",
      "task_resume",
      "Task resume — list active tasks and route to generate or resolve skill.",
      ctx,
      { nextTools: ["task_list", "task_status"] },
    );
  }

  if (isIncrementalChangeIntent(msg)) {
    return result(
      "ai-spector-resolve-task",
      "high",
      "incremental_change",
      "Incremental change — propose tier (task_confirm_tier) → clarify → plan → task_approve_plan → execute → verify.",
      ctx,
      {
        nextTools: ["task_create", "task_list"],
        avoidTools: ["review_approve", "spec_approve"],
      },
    );
  }

  if (isGeneratePrototypeIntent(msg)) {
    return result(
      "ai-spector-generate-prototype",
      "high",
      "generate_prototype",
      "Prototype workflow — theme picker, setup, HTML screens.",
      ctx,
      {
        nextTools: ["task_list", "workspace_check"],
        avoidTools: ["review_approve", "resolve_task"],
      },
    );
  }

  if (isGenerateBasicDesignIntent(msg)) {
    return result(
      "ai-spector-generate-basic-design",
      "high",
      "generate_basic_design",
      "Basic design generation — create/resume task, plan gate, then generate.",
      ctx,
      {
        nextTools: ["task_list", "workspace_check"],
        avoidTools: ["review_approve", "resolve_task"],
      },
    );
  }

  if (isGenerateDetailDesignIntent(msg)) {
    return result(
      "ai-spector-generate-detail-design",
      "high",
      "generate_detail_design",
      "Detail design generation — gated generate flow (check → clarify → briefing → plan) — NOT resolve-task tier workflow.",
      ctx,
      {
        nextTools: ["task_list", "workspace_check"],
        avoidTools: ["review_approve", "resolve_task"],
      },
    );
  }

  if (isGenerateSrsIntent(msg)) {
    return result(
      "ai-spector-generate-srs",
      "high",
      "full_generate",
      "Full SRS generation — create/resume task, plan gate, then generate.",
      ctx,
      {
        nextTools: ["task_list", "workspace_check"],
        avoidTools: ["review_approve", "resolve_task"],
      },
    );
  }

  if (isLangStatusIntent(msg)) {
    return result(
      "ai-spector-lang-status",
      "medium",
      "lang_status",
      "Translation queue status — read-only lang_queue.",
      ctx,
      { nextTools: ["lang_queue"] },
    );
  }

  if (isTemplateImportIntent(msg)) {
    return result(
      "ai-spector-template-import",
      "high",
      "template_import",
      "Template pack import workflow.",
      ctx,
      { nextTools: ["workspace_check"] },
    );
  }

  if (isCourseIntent(msg)) {
    return result(
      "ai-spector-course",
      "medium",
      "course",
      "Open AI Spector interactive course.",
      ctx,
      { nextTools: [] },
    );
  }

  if (isClarificationIntent(msg)) {
    return result(
      "ai-spector-check",
      "medium",
      "clarifications",
      "Clarification queue — list and resolve stored answers.",
      ctx,
      { nextTools: ["context_list", "context_resolve"] },
    );
  }

  if (isWorkspaceCheckIntent(msg)) {
    return result(
      "ai-spector-check",
      "medium",
      "workspace_check",
      "Workspace structure and clarification audit.",
      ctx,
      { nextTools: ["workspace_check", "context_list"] },
    );
  }

  if (isSetupIntent(msg)) {
    return result(
      "ai-spector-setup",
      "medium",
      "setup",
      "Project setup and bootstrap.",
      ctx,
      { nextTools: ["workspace_check"] },
    );
  }

  if (isSearchIntent(msg)) {
    return result(
      "ai-spector-search",
      "medium",
      "search",
      "Semantic doc search or fuzzy graph lookup.",
      ctx,
      { nextTools: ["docs_search", "graph_query_fuzzy"] },
    );
  }

  if (isGraphIntent(msg)) {
    return result(
      "ai-spector-graph",
      "medium",
      "graph_ops",
      "Graph analyze, index, validate, or impact.",
      ctx,
      { nextTools: ["graph_validate", "index", "graph_impact"] },
    );
  }

  if (/\bhelp me approve\b/.test(msg)) {
    return ambiguousApprove(message, ctx);
  }

  if (
    /\b(approve|looks good|go ahead|yes)\b/.test(msg) &&
    !/\b(srs|bd|dd|spec|c-)\b/.test(msg)
  ) {
    return ambiguousApprove(message, ctx);
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
