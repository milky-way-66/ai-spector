import { readPrototypeAnchorContext } from "./anchor.js";
import { previewCommentBody } from "./anchor.js";
import type { CommentInboxItem } from "./inbox.js";
import type { CommentInbox } from "./inbox.js";
import { screenStemFromPrototypeUrl } from "./paths.js";
import { getThread } from "./storage.js";
import type { CommentListFilters } from "./filters.js";
import { threadMatchesFilters } from "./filters.js";
import type { ThreadDetail, ThreadSummary } from "./types.js";
import { isPrototypeAnchor, threadCommentType } from "./types.js";

export interface CommentBatchItem {
  batchId: string;
  screenStem: string;
  label: string;
  prototypePath: string | null;
  threadCount: number;
  pickIds: string[];
  threadIds: string[];
}

export interface BatchThreadPlan {
  pickId: string;
  threadId: string;
  filePath: string;
  version: number;
  screenStem: string | null;
  location: string;
  instruction: string;
  anchorState: string;
}

export interface BatchTargetPlan {
  prototypePath: string;
  screenStem: string;
  htmlPreview?: string;
  threadPickIds: string[];
}

export interface CommentBatchPlan {
  batchId?: string;
  scope: {
    mode: "screen" | "cross_screen";
    screens: string[];
    description: string;
  };
  filters: CommentListFilters;
  threads: BatchThreadPlan[];
  targets: BatchTargetPlan[];
  combinedInstruction: string;
  workflow: {
    phases: string[];
    clarify: string[];
    approachPrompt: string;
    executionPlanTemplate: string;
    approvalRequired: string;
  };
  resolveSteps: Array<{
    threadId: string;
    filePath: string;
    expectedVersion: number;
    pickId: string;
  }>;
}

const BATCH_WORKFLOW_PHASES = [
  "sync_git_pull",
  "show_batch_plan_in_chat",
  "clarify_scope_and_constraints",
  "propose_two_or_three_approaches",
  "user_picks_approach",
  "show_execution_plan_table",
  "wait_explicit_yes",
  "apply_prototype_edits",
  "validate_prototype_if_applicable",
  "git_commit_prototype_then_batch_resolve_meta",
  "git_push",
] as const;

function instructionFromThreadDetail(thread: ThreadDetail): string {
  const parts: string[] = [];
  for (const c of thread.comments) {
    if (c.deletedAt) {
      continue;
    }
    parts.push(c.body.trim());
  }
  return parts.join("\n\n").trim() || "(empty comment)";
}

function locationLabel(thread: ThreadDetail): string {
  if (isPrototypeAnchor(thread.anchor)) {
    return `${thread.anchor.selector} @ ${thread.anchor.url}`;
  }
  return thread.filePath;
}

export function buildPrototypeBatchGroups(inbox: CommentInboxItem[]): CommentBatchItem[] {
  const protoItems = inbox.filter((i) => i.commentType === "prototype");
  const byStem = new Map<string, CommentInboxItem[]>();

  for (const item of protoItems) {
    const url = item.location?.split(" @ ").pop() ?? item.lines.replace(/^@/, "");
    const stem = screenStemFromPrototypeUrl(url || item.filePath);
    const group = byStem.get(stem) ?? [];
    group.push(item);
    byStem.set(stem, group);
  }

  return [...byStem.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([screenStem, items], index) => ({
      batchId: `B-${String(index + 1).padStart(3, "0")}`,
      screenStem,
      label: `${screenStem} screen (${items.length} thread${items.length === 1 ? "" : "s"})`,
      prototypePath: items[0]?.docPath ?? null,
      threadCount: items.length,
      pickIds: items.map((i) => i.pickId),
      threadIds: items.map((i) => i.threadId),
    }));
}

export function resolveBatchPickId(
  inbox: CommentInbox,
  token: string,
): CommentBatchItem | undefined {
  const t = token.trim();
  return inbox.batches?.find((b) => b.batchId.toLowerCase() === t.toLowerCase());
}

export function resolveThreadPicks(
  inbox: CommentInbox,
  tokens: string[],
): CommentInboxItem[] {
  const picked: CommentInboxItem[] = [];
  const seen = new Set<string>();
  for (const raw of tokens) {
    const token = raw.trim();
    if (!token) {
      continue;
    }
    const batch = resolveBatchPickId(inbox, token);
    if (batch) {
      for (const pickId of batch.pickIds) {
        const item = inbox.inbox.find((i) => i.pickId === pickId);
        if (item && !seen.has(item.threadId)) {
          seen.add(item.threadId);
          picked.push(item);
        }
      }
      continue;
    }
    const item = inbox.inbox.find((i) => i.pickId.toLowerCase() === token.toLowerCase());
    if (item && !seen.has(item.threadId)) {
      seen.add(item.threadId);
      picked.push(item);
    }
  }
  return picked;
}

export async function buildCommentBatchPlan(opts: {
  projectRoot: string;
  inbox: CommentInbox;
  picks?: string[];
  batchId?: string;
  screen?: string;
  filters: CommentListFilters;
}): Promise<CommentBatchPlan> {
  let selected: CommentInboxItem[] = [];

  if (opts.batchId) {
    const batch = resolveBatchPickId(opts.inbox, opts.batchId);
    if (!batch) {
      throw new Error(`Unknown batch id: ${opts.batchId}. Run comments inbox --group screen --json`);
    }
    selected = resolveThreadPicks(opts.inbox, [opts.batchId]);
  } else if (opts.picks?.length) {
    selected = resolveThreadPicks(opts.inbox, opts.picks);
  } else if (opts.screen) {
    selected = opts.inbox.inbox.filter(
      (i) =>
        i.commentType === "prototype" &&
        (i.location?.toLowerCase().includes(opts.screen!.toLowerCase()) ||
          i.lines.toLowerCase().includes(opts.screen!.toLowerCase())),
    );
  }

  if (selected.length === 0) {
    throw new Error(
      "No threads matched batch selection. Use B-00N, --picks C-001,C-002, or --screen login.",
    );
  }

  const protoOnly = selected.every((i) => i.commentType === "prototype");
  if (!protoOnly) {
    throw new Error("Batch plan currently supports prototype threads only.");
  }

  const threadPlans: BatchThreadPlan[] = [];
  const targetsByPath = new Map<string, BatchTargetPlan>();

  for (const item of selected) {
    const detail = await getThread(opts.projectRoot, item.filePath, item.threadId);
    if (!detail) {
      throw new Error(`Thread not found: ${item.threadId}`);
    }
    const url = isPrototypeAnchor(detail.anchor) ? detail.anchor.url : "";
    const stem = url ? screenStemFromPrototypeUrl(url) : null;
    const instruction = instructionFromThreadDetail(detail);
    threadPlans.push({
      pickId: item.pickId,
      threadId: item.threadId,
      filePath: item.filePath,
      version: item.version,
      screenStem: stem,
      location: locationLabel(detail),
      instruction,
      anchorState: detail.anchor.anchorState ?? "active",
    });

    const prototypePath = detail.docPath;
    if (prototypePath && stem) {
      let target = targetsByPath.get(prototypePath);
      if (!target) {
        let htmlPreview: string | undefined;
        if (isPrototypeAnchor(detail.anchor)) {
          const anchorCtx = await readPrototypeAnchorContext(
            opts.projectRoot,
            detail.filePath,
            detail.anchor,
          );
          htmlPreview = anchorCtx?.htmlPreview;
        }
        target = {
          prototypePath,
          screenStem: stem,
          htmlPreview,
          threadPickIds: [],
        };
        targetsByPath.set(prototypePath, target);
      }
      target.threadPickIds.push(item.pickId);
    }
  }

  const screens = [...new Set(threadPlans.map((t) => t.screenStem).filter(Boolean))] as string[];
  const scopeMode = screens.length <= 1 ? "screen" : "cross_screen";
  const scopeDescription =
    scopeMode === "screen"
      ? `Resolve all open prototype comments on **${screens[0] ?? "screen"}** (${selected.length} thread(s)).`
      : `Resolve prototype comments across **${screens.join(", ")}** (${selected.length} thread(s), ${targetsByPath.size} HTML file(s)).`;

  const combinedInstruction = threadPlans
    .map(
      (t, i) =>
        `${i + 1}. [${t.pickId}] ${t.location}\n   ${previewCommentBody(t.instruction, 500)}`,
    )
    .join("\n\n");

  const targetSummary = [...targetsByPath.values()]
    .map((t) => `- \`${t.prototypePath}\` (${t.screenStem}, ${t.threadPickIds.length} comment(s))`)
    .join("\n");

  return {
    batchId: opts.batchId,
    scope: {
      mode: scopeMode,
      screens,
      description: scopeDescription,
    },
    filters: opts.filters,
    threads: threadPlans,
    targets: [...targetsByPath.values()],
    combinedInstruction,
    workflow: {
      phases: [...BATCH_WORKFLOW_PHASES],
      clarify: [
        "Confirm scope: this screen only, or include related screens?",
        "Style constraints: design tokens, no new CDN, match prototype/DESIGN.md?",
        "How to handle drifted/missing anchors — edit current HTML or skip?",
      ],
      approachPrompt:
        "Propose **2–3 concrete approaches** (e.g. inline style vs class vs shared token). " +
        "Include trade-offs (risk, reuse, scope). Do not edit files until user picks an approach.",
      executionPlanTemplate: [
        "1. Edit prototype HTML file(s):",
        targetSummary,
        "2. Optional: `npx ai-spector prototype manifest --strict`",
        "3. Commit HTML → `comments batch-resolve` for picks: " +
          threadPlans.map((t) => t.pickId).join(", "),
        "4. Amend commit with all comment meta under comments/prototype/…",
      ].join("\n"),
      approvalRequired:
        "Wait for explicit **yes** / **go ahead** after the execution plan table. No file edits before that.",
    },
    resolveSteps: threadPlans.map((t) => ({
      threadId: t.threadId,
      filePath: t.filePath,
      expectedVersion: t.version,
      pickId: t.pickId,
    })),
  };
}

export function formatBatchPlanForChat(plan: CommentBatchPlan): string {
  const lines: string[] = [
    `# Batch plan — ${plan.scope.description}`,
    "",
    `**Scope:** ${plan.scope.mode} (${plan.scope.screens.join(", ") || "n/a"})`,
    `**Threads:** ${plan.threads.length}`,
    "",
    "## Comments to address",
    "",
    plan.combinedInstruction,
    "",
    "## Target files",
    "",
    ...plan.targets.map(
      (t) =>
        `- \`${t.prototypePath}\` — screen **${t.screenStem}** (${t.threadPickIds.join(", ")})`,
    ),
    "",
    "## Workflow (do not skip)",
    "",
    ...plan.workflow.phases.map((p, i) => `${i + 1}. ${p}`),
    "",
    "### Clarify first",
    ...plan.workflow.clarify.map((q) => `- ${q}`),
    "",
    "### Then propose approaches",
    plan.workflow.approachPrompt,
    "",
    "### Execution plan (after approach picked)",
    plan.workflow.executionPlanTemplate,
    "",
    plan.workflow.approvalRequired,
  ];

  if (plan.targets.some((t) => t.htmlPreview)) {
    lines.push("", "## HTML preview (first target)", "");
    const first = plan.targets.find((t) => t.htmlPreview);
    if (first?.htmlPreview) {
      lines.push("```html", first.htmlPreview, "```");
    }
  }

  return lines.join("\n");
}

export function threadsForBatchResolve(
  allThreads: ThreadSummary[],
  filters: CommentListFilters,
  picks: string[],
  inbox: CommentInbox,
): ThreadSummary[] {
  const items = resolveThreadPicks(inbox, picks);
  const allowed = new Set(items.map((i) => i.threadId));
  return allThreads.filter(
    (t) => allowed.has(t.threadId) && threadMatchesFilters(t, filters),
  );
}
