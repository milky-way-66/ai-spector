import type { ImpactResult } from "../graph/impact.js";
import { previewCommentBody } from "./anchor.js";
import type { WorkflowToolGuidance } from "../workflow/guidance.js";
import { buildCommentsInboxWorkflowGuidance } from "../workflow/guidance.js";
import type { CommentType, ThreadSummary } from "./types.js";
import { isDocumentAnchor, isPrototypeAnchor, threadCommentType } from "./types.js";

export interface CommentInboxItem {
  /** Short id for chat selection, e.g. C-001 */
  pickId: string;
  threadId: string;
  filePath: string;
  commentType: CommentType;
  docPath: string | null;
  status: string;
  language: string;
  /** Document line range or prototype `@url` label for legacy columns */
  lines: string;
  startLine: number;
  endLine: number;
  /** CSS selector @ url for prototype; undefined for document threads */
  location?: string;
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
  workflowGuidance: WorkflowToolGuidance;
  /** Pre-rendered pick list for IDE chat — agent should show this, not raw JSON or thread uuids */
  idePresentation: {
    mode: "thread_pick_list";
    markdown: string;
    rules: string[];
  };
}

export function buildCommentInbox(threads: ThreadSummary[]): CommentInbox {
  const inbox: CommentInboxItem[] = threads.map((t, index) => {
    const commentType = threadCommentType(t);
    if (commentType === "prototype" && isPrototypeAnchor(t.anchor)) {
      return {
        pickId: `C-${String(index + 1).padStart(3, "0")}`,
        threadId: t.threadId,
        filePath: t.filePath,
        commentType,
        docPath: t.docPath,
        status: t.status,
        language: "HTML",
        lines: `@${t.anchor.url}`,
        startLine: 0,
        endLine: 0,
        location: `${t.anchor.selector} @ ${t.anchor.url}`,
        excerpt: t.anchor.textExcerpt,
        preview: "(loading…)",
        replyCount: t.replyCount,
        originBranch: t.originBranch,
        version: t.version,
      };
    }
    const docAnchor = isDocumentAnchor(t.anchor) ? t.anchor : null;
    return {
      pickId: `C-${String(index + 1).padStart(3, "0")}`,
      threadId: t.threadId,
      filePath: t.filePath,
      commentType: "document" as const,
      docPath: t.docPath,
      status: t.status,
      language: docAnchor?.language ?? "",
      lines: docAnchor ? `${docAnchor.startLine}-${docAnchor.endLine}` : "?",
      startLine: docAnchor?.startLine ?? 0,
      endLine: docAnchor?.endLine ?? 0,
      excerpt: docAnchor?.lineExcerpt,
      preview: "(loading…)",
      replyCount: t.replyCount,
      originBranch: t.originBranch,
      version: t.version,
    };
  });

  const openCount = inbox.filter((i) => i.status === "open").length;

  return {
    inbox,
    count: inbox.length,
    openCount,
    prompt:
      inbox.length === 0
        ? "No open comment threads. Run git pull or check comments/."
        : "Reply with a pick id (e.g. C-001) to start the resolve workflow.",
    workflowGuidance: buildCommentsInboxWorkflowGuidance(openCount),
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

  const header = "| Pick | Type | Target | Location | Reviewer ask |";
  const sep = "|------|------|--------|----------|--------------|";
  const rows = inbox.map((item) => {
    const target = item.docPath ?? item.filePath;
    const location =
      item.commentType === "prototype"
        ? (item.location ?? item.lines)
        : `${item.lines} (${item.language})`;
    const ask = item.preview.replace(/\|/g, "\\|").replace(/\n/g, " ");
    const excerpt =
      item.excerpt && !ask.includes(item.excerpt.slice(0, 20))
        ? ` _(${item.excerpt.replace(/\|/g, "\\|").slice(0, 60)}…)_`
        : "";
    return `| **${item.pickId}** | ${item.commentType} | \`${target}\` | ${location.replace(/\|/g, "\\|")} | ${ask}${excerpt} |`;
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
    regenerate: impact.regenerate.length,
    review: impact.review.length,
    originId: impact.origin.id,
    originType: impact.origin.type,
    topRegenerate: impact.regenerate.slice(0, 8).map((e) => ({
      id: e.id,
      projectionPath: e.projectionPath,
    })),
    topReview: impact.review.slice(0, 5).map((e) => ({
      id: e.id,
      projectionPath: e.projectionPath,
    })),
  };
}

export interface CommentResolvePlan {
  pickId?: string;
  thread: import("./types.js").ThreadDetail;
  anchor: import("./anchor.js").DocAnchorContext | import("./anchor.js").PrototypeAnchorContext | null;
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
  anchor: import("./anchor.js").DocAnchorContext | import("./anchor.js").PrototypeAnchorContext | null,
  impact: ImpactResult | null,
  resolvedFrom?: { id: string; type: string; reason: string },
  pickId?: string,
): CommentResolvePlan {
  const firstComment = thread.comments.find((c) => !c.deletedAt);
  const ask = firstComment?.body ?? "(no comment body)";
  const commentType = threadCommentType(thread);
  const protoAnchor = isPrototypeAnchor(thread.anchor) ? thread.anchor : null;
  const docAnchor = isDocumentAnchor(thread.anchor) ? thread.anchor : null;

  const regenerateCommands =
    impact && impact.regenerate.length > 0
      ? [
          ...new Set(
            impact.regenerate
              .slice(0, 5)
              .map((e) => `/generate-srs from ${e.id}`),
          ),
        ]
      : [];

  const prototypePath =
    anchor && "prototypePath" in anchor ? anchor.prototypePath : thread.docPath;

  return {
    pickId,
    thread,
    anchor,
    impact,
    impactSummary: summarizeImpact(impact),
    resolvedFrom,
    workflow: {
      phases:
        commentType === "prototype"
          ? [
              "show_plan_in_chat",
              "propose_prototype_edit",
              "user_approval",
              "apply_edit_to_prototype_html",
              "git_commit_prototype_then_resolve_meta",
              "git_push",
            ]
          : [
              "show_plan_in_chat",
              "propose_doc_edit",
              "user_approval",
              "apply_edit_to_doc",
              "git_commit_doc_then_resolve_meta",
              "git_push",
              "optional_index_or_regen",
            ],
      suggestEdit: {
        docPath:
          commentType === "prototype"
            ? prototypePath
            : anchor && "docPath" in anchor
              ? anchor.docPath
              : thread.docPath,
        startLine: docAnchor?.startLine ?? 0,
        endLine: docAnchor?.endLine ?? 0,
        instruction:
          commentType === "prototype" && protoAnchor
            ? `Apply prototype review comment on ${protoAnchor.url} at ${protoAnchor.selector}: ${previewCommentBody(ask, 200)}`
            : docAnchor
              ? `Address reviewer comment at lines ${docAnchor.startLine}-${docAnchor.endLine}: ${previewCommentBody(ask, 200)}`
              : `Address reviewer comment: ${previewCommentBody(ask, 200)}`,
      },
      afterApply: {
        indexRefresh:
          commentType === "document" &&
          impact != null &&
          (impact.regenerate.length > 0 || impact.review.length > 0),
        regenerateCommands: commentType === "document" ? regenerateCommands : [],
      },
    },
  };
}

export function formatPlanForChat(plan: CommentResolvePlan): string {
  const t = plan.thread;
  const commentType = threadCommentType(t);
  const lines: string[] = [
    plan.pickId ? `# ${plan.pickId} → ${t.threadId}` : `# Thread ${t.threadId}`,
    "",
    `**Type:** ${commentType}`,
    `**File:** ${t.filePath} → ${t.docPath ?? "(unknown)"}`,
  ];

  if (commentType === "prototype" && isPrototypeAnchor(t.anchor)) {
    lines.push(
      `**Anchor:** ${t.anchor.selector} @ ${t.anchor.url}${t.anchor.tagName ? ` (${t.anchor.tagName})` : ""}`,
    );
    if (t.anchor.textExcerpt) {
      lines.push(`**Excerpt:** ${t.anchor.textExcerpt}`);
    }
  } else if (isDocumentAnchor(t.anchor)) {
    lines.push(`**Anchor:** lines ${t.anchor.startLine}-${t.anchor.endLine} (${t.anchor.language})`);
    if (t.anchor.lineExcerpt) {
      lines.push(`**Excerpt:** ${t.anchor.lineExcerpt}`);
    }
  }

  lines.push("", "**Comments:**");
  for (const c of t.comments) {
    if (c.deletedAt) {
      continue;
    }
    lines.push(`- ${c.authorId}: ${c.body}`);
  }

  if (plan.anchor && "anchoredText" in plan.anchor && plan.anchor.anchoredText) {
    lines.push("", "**Current text at anchor:**", "```markdown", plan.anchor.anchoredText, "```");
  } else if (plan.anchor && "htmlPreview" in plan.anchor) {
    lines.push("", "**Prototype HTML (preview):**", "```html", plan.anchor.htmlPreview, "```");
  }

  if (plan.impactSummary) {
    lines.push(
      "",
      "**Impact if you change this section:**",
      `- Regenerate: ${plan.impactSummary.regenerate}`,
      `- Review: ${plan.impactSummary.review}`,
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
  } else if (commentType === "document") {
    lines.push("", "**Impact:** (graph unavailable — run /index or /validate-graph first)");
  }

  lines.push(
    "",
    "**Next (IDE workflow):**",
    commentType === "prototype"
      ? "1. Propose a concrete HTML edit addressing the pinned element\n2. Wait for your approval\n3. Apply the edit to the prototype file\n4. Commit **prototype + comment meta in one commit** (amend) → push"
      : "1. Propose a concrete doc edit addressing the comment\n2. Wait for your approval\n3. Apply the edit\n4. Commit **doc + comment meta in one commit** (amend) → push",
  );

  return lines.join("\n");
}
