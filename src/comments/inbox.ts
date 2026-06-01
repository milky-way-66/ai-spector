import type { ImpactResult } from "../graph/impact.js";
import { previewCommentBody } from "./anchor.js";
import type { ThreadSummary } from "./types.js";

export interface CommentInboxItem {
  /** Short id for chat selection, e.g. C-001 */
  pickId: string;
  threadId: string;
  filePath: string;
  docPath: string | null;
  status: string;
  language: string;
  lines: string;
  startLine: number;
  endLine: number;
  excerpt?: string;
  /** First comment in thread (reviewer ask) */
  preview: string;
  replyCount: number;
  originBranch: string;
  version: number;
}

export interface CommentInbox {
  inbox: CommentInboxItem[];
  count: number;
  openCount: number;
  prompt: string;
  /** Pre-rendered pick list for IDE chat — agent should show this, not raw JSON or thread uuids */
  idePresentation: {
    mode: "thread_pick_list";
    markdown: string;
    rules: string[];
  };
}

export function buildCommentInbox(threads: ThreadSummary[]): CommentInbox {
  const inbox: CommentInboxItem[] = threads.map((t, index) => ({
    pickId: `C-${String(index + 1).padStart(3, "0")}`,
    threadId: t.threadId,
    filePath: t.filePath,
    docPath: t.docPath,
    status: t.status,
    language: t.anchor.language,
    lines: `${t.anchor.startLine}-${t.anchor.endLine}`,
    startLine: t.anchor.startLine,
    endLine: t.anchor.endLine,
    excerpt: t.anchor.lineExcerpt,
    preview: "(loading…)",
    replyCount: t.replyCount,
    originBranch: t.originBranch,
    version: t.version,
  }));

  return {
    inbox,
    count: inbox.length,
    openCount: inbox.filter((i) => i.status === "open").length,
    prompt:
      inbox.length === 0
        ? "No open comment threads. Run git pull or check comments/."
        : "Reply with a pick id (e.g. C-001) to start the resolve workflow.",
    idePresentation: buildIdePresentation(inbox),
  };
}

const IDE_PRESENTATION_RULES = [
  "Show only the markdown table below — one row per open thread (not per reply).",
  "Do not paste raw JSON or full thread uuids in chat.",
  "Use pick ids (C-001) for user selection; keep threadId internal until running plan/resolve.",
];

function buildIdePresentation(inbox: CommentInboxItem[]): CommentInbox["idePresentation"] {
  if (inbox.length === 0) {
    return {
      mode: "thread_pick_list",
      markdown: "_No open comment threads._",
      rules: IDE_PRESENTATION_RULES,
    };
  }

  const header = "| Pick | Document | Lines | Lang | Reviewer ask |";
  const sep = "|------|----------|-------|------|--------------|";
  const rows = inbox.map((item) => {
    const doc = item.docPath ?? item.filePath;
    const ask = item.preview.replace(/\|/g, "\\|").replace(/\n/g, " ");
    const excerpt =
      item.excerpt && !ask.includes(item.excerpt.slice(0, 20))
        ? ` _(${item.excerpt.replace(/\|/g, "\\|").slice(0, 60)}…)_`
        : "";
    return `| **${item.pickId}** | \`${doc}\` | ${item.lines} | ${item.language} | ${ask}${excerpt} |`;
  });

  return {
    mode: "thread_pick_list",
    markdown: [header, sep, ...rows].join("\n"),
    rules: IDE_PRESENTATION_RULES,
  };
}

export function enrichInboxPreviews(
  inbox: CommentInbox,
  firstComments: Map<string, string>,
): CommentInbox {
  const enrichedInbox = inbox.inbox.map((item) => {
    const body = firstComments.get(item.threadId);
    return body ? { ...item, preview: previewCommentBody(body) } : item;
  });
  return {
    ...inbox,
    inbox: enrichedInbox,
    idePresentation: buildIdePresentation(enrichedInbox),
  };
}

export function formatInboxForChat(inbox: CommentInbox): string {
  if (inbox.count === 0) {
    return "No open comment threads under comments/.";
  }

  return [
    `Open comment threads (${inbox.openCount}) — pick one:`,
    "",
    inbox.idePresentation.markdown,
    "",
    inbox.prompt,
  ].join("\n");
}

export interface ImpactSummary {
  regenerate: number;
  review: number;
  downstream: number;
  originId?: string;
  originType?: string;
  topRegenerate: Array<{ id: string; projectionPath?: string }>;
  topReview: Array<{ id: string; projectionPath?: string }>;
}

export function summarizeImpact(impact: ImpactResult | null): ImpactSummary | null {
  if (!impact) {
    return null;
  }
  return {
    regenerate: impact.affected.regenerate.length,
    review: impact.affected.review.length,
    downstream: impact.affected.downstream.length,
    originId: impact.origin.id,
    originType: impact.origin.type,
    topRegenerate: impact.affected.regenerate.slice(0, 8).map((e) => ({
      id: e.id,
      projectionPath: e.projectionPath,
    })),
    topReview: impact.affected.review.slice(0, 5).map((e) => ({
      id: e.id,
      projectionPath: e.projectionPath,
    })),
  };
}

export interface CommentResolvePlan {
  pickId?: string;
  thread: import("./types.js").ThreadDetail;
  anchor: import("./anchor.js").DocAnchorContext | null;
  impact: ImpactResult | null;
  impactSummary: ImpactSummary | null;
  resolvedFrom?: { id: string; type: string; reason: string };
  workflow: {
    phases: string[];
    suggestEdit: {
      docPath: string | null;
      startLine: number;
      endLine: number;
      instruction: string;
    };
    afterApply: {
      indexRefresh?: boolean;
      regenerateCommands?: string[];
    };
  };
}

export function buildResolvePlan(
  thread: import("./types.js").ThreadDetail,
  anchor: import("./anchor.js").DocAnchorContext | null,
  impact: ImpactResult | null,
  resolvedFrom?: { id: string; type: string; reason: string },
  pickId?: string,
): CommentResolvePlan {
  const firstComment = thread.comments.find((c) => !c.deletedAt);
  const ask = firstComment?.body ?? "(no comment body)";

  const regenerateCommands =
    impact && impact.affected.regenerate.length > 0
      ? [
          ...new Set(
            impact.affected.regenerate
              .slice(0, 5)
              .map((e) => `/generate-srs from ${e.id}`),
          ),
        ]
      : [];

  return {
    pickId,
    thread,
    anchor,
    impact,
    impactSummary: summarizeImpact(impact),
    resolvedFrom,
    workflow: {
      phases: [
        "show_plan_in_chat",
        "propose_doc_edit",
        "user_approval",
        "apply_edit_to_doc",
        "git_commit_doc_then_resolve_meta",
        "git_push",
        "optional_index_or_regen",
      ],
      suggestEdit: {
        docPath: anchor?.docPath ?? thread.docPath,
        startLine: thread.anchor.startLine,
        endLine: thread.anchor.endLine,
        instruction: `Address reviewer comment at lines ${thread.anchor.startLine}-${thread.anchor.endLine}: ${previewCommentBody(ask, 200)}`,
      },
      afterApply: {
        indexRefresh: impact != null && (impact.affected.regenerate.length > 0 || impact.affected.review.length > 0),
        regenerateCommands,
      },
    },
  };
}

export function formatPlanForChat(plan: CommentResolvePlan): string {
  const t = plan.thread;
  const lines: string[] = [
    plan.pickId ? `# ${plan.pickId} → ${t.threadId}` : `# Thread ${t.threadId}`,
    "",
    `**File:** ${t.filePath} → ${t.docPath ?? "(unknown)"}`,
    `**Anchor:** lines ${t.anchor.startLine}-${t.anchor.endLine} (${t.anchor.language})`,
  ];

  if (t.anchor.lineExcerpt) {
    lines.push(`**Excerpt:** ${t.anchor.lineExcerpt}`);
  }

  lines.push("", "**Comments:**");
  for (const c of t.comments) {
    if (c.deletedAt) {
      continue;
    }
    lines.push(`- ${c.authorId}: ${c.body}`);
  }

  if (plan.anchor?.anchoredText) {
    lines.push("", "**Current text at anchor:**", "```markdown", plan.anchor.anchoredText, "```");
  }

  if (plan.impactSummary) {
    lines.push(
      "",
      "**Impact if you change this section:**",
      `- Regenerate: ${plan.impactSummary.regenerate}`,
      `- Review: ${plan.impactSummary.review}`,
      `- Downstream: ${plan.impactSummary.downstream}`,
    );
    if (plan.resolvedFrom) {
      lines.push(`- Graph seed: \`${plan.resolvedFrom.id}\` (${plan.resolvedFrom.reason})`);
    }
    if (plan.impactSummary.topRegenerate.length > 0) {
      lines.push("", "Top regen targets:");
      for (const e of plan.impactSummary.topRegenerate) {
        lines.push(`- \`${e.id}\`${e.projectionPath ? ` → ${e.projectionPath}` : ""}`);
      }
    }
  } else {
    lines.push("", "**Impact:** (graph unavailable — run /index or /validate-graph first)");
  }

  lines.push(
    "",
    "**Next (IDE workflow):**",
    "1. Propose a concrete doc edit addressing the comment",
    "2. Wait for your approval",
    "3. Apply the edit",
    "4. Commit **doc + comment meta in one commit** (amend) → push",
  );

  return lines.join("\n");
}
