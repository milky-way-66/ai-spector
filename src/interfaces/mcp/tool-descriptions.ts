/**
 * MCP tool descriptions for approve-like operations.
 * Kept in one module so routing cross-refs stay in sync (see tests/interfaces/mcp/tool-descriptions.test.ts).
 */

const SIBLING_REVIEW = "review_approve";
const SIBLING_SPEC = "spec_approve";
const SIBLING_TASK = "task_approve_plan";
const SIBLING_COMMENTS = "comments_resolve";

export const APPROVE_TOOL_DESCRIPTIONS = {
  review_approve: [
    "Formally sign off a document (internal track) — records approval and moves it to the client queue.",
    "",
    "WHEN: User wants document sign-off by logical path (e.g. srs/01-overview), after completing the ai-spector-review runbook (review_status + written review + user yes).",
    `NOT WHEN: SPEC-NNN or extracted spec queue (use ${SIBLING_SPEC}); user approved a TaskPlan table (use ${SIBLING_TASK}); comment thread C-NNN addressed (use ${SIBLING_COMMENTS}).`,
    `REQUIRES: review_status for the same logicalPath, review_session_ack_review after writing the review summary, then user yes.`,
    `SIBLING TOOLS: ${SIBLING_SPEC}, ${SIBLING_TASK}, ${SIBLING_COMMENTS}.`,
  ].join("\n"),

  spec_approve: [
    "Approve a pending extracted spec by id (e.g. SPEC-001) and merge its graph patch after validation.",
    "",
    "WHEN: After document generation stage 6 — user approves a queued spec from spec_list (extracted decisions/constraints).",
    `NOT WHEN: Formal document sign-off (use ${SIBLING_REVIEW}); task plan execution gate (use ${SIBLING_TASK}); resolving inline comment threads (use ${SIBLING_COMMENTS}).`,
    `SIBLING TOOLS: ${SIBLING_REVIEW}, ${SIBLING_TASK}, ${SIBLING_COMMENTS}.`,
  ].join("\n"),

  task_approve_plan: [
    "Mark the workflow task plan as approved — sets planApprovedAt and unlocks execute/generate steps.",
    "",
    "WHEN: User explicitly approves a GoalSpec + TaskPlan table during resolve-task or generate workflow (yes / go ahead / execute).",
    `NOT WHEN: Document sign-off by logical path (use ${SIBLING_REVIEW}); extracted spec SPEC-NNN (use ${SIBLING_SPEC}); comment thread done (use ${SIBLING_COMMENTS}).`,
    `SIBLING TOOLS: ${SIBLING_REVIEW}, ${SIBLING_SPEC}, ${SIBLING_COMMENTS}.`,
  ].join("\n"),

  comments_resolve: [
    "Mark an inline comment/feedback thread as resolved (the note or question has been addressed).",
    "",
    "WHEN: User resolves thread C-NNN or says feedback on anchored comments is addressed.",
    `NOT WHEN: Formal document sign-off (use ${SIBLING_REVIEW}); spec queue SPEC-NNN (use ${SIBLING_SPEC}); approving a task plan to execute (use ${SIBLING_TASK}).`,
    `SIBLING TOOLS: ${SIBLING_REVIEW}, ${SIBLING_SPEC}, ${SIBLING_TASK}.`,
  ].join("\n"),
} as const;

export type ApproveToolName = keyof typeof APPROVE_TOOL_DESCRIPTIONS;

export const REVIEW_WORKFLOW_TOOL_DESCRIPTIONS = {
  review_status: [
    "Formal document sign-off status (internal + client tracks), diff since last sign-off, and workflowGuidance for next steps.",
    "",
    "WHEN: Preparing or continuing document review before review_approve; user asks what changed since approval.",
    `NOT WHEN: Inline comment threads (comments_show / comments_list); extracted specs (spec_list); task plan state (task_get).`,
    "Returns readiness.structuralScan + readiness.outputChecklist when doc type is known — score each checklist item met/partial/missing in the review summary.",
    "Call before review_approve for the same logicalPath.",
  ].join("\n"),

  review_check: [
    "Scan formally signed-off documents for content changes; invalidate stale sign-offs and refresh the internal queue.",
    "",
    "WHEN: Start of /review session or after editing approved documents.",
    "NOT WHEN: Comment inbox; spec queue; task planning.",
  ].join("\n"),

  review_queue: [
    "List documents pending formal sign-off (internal and/or client approval queue).",
    "",
    "WHEN: User asks for review queue or which docs need sign-off.",
    "NOT WHEN: Comment threads (comments_inbox); extracted specs (spec_list).",
  ].join("\n"),

  review_reject: [
    "Dismiss a document from the formal sign-off queue without approving (e.g. trivial formatting).",
    "",
    "WHEN: User chooses Dismiss in the document review decision menu.",
    `NOT WHEN: Rejecting extracted specs (spec_reject); resolving comments (${SIBLING_COMMENTS}).`,
  ].join("\n"),

  review_list: [
    "List all documents with a formal sign-off record, filterable by status or path prefix.",
    "",
    "WHEN: Which SRS docs are signed off, approval status overview.",
    "NOT WHEN: Comment threads; spec queue.",
  ].join("\n"),

  review_session_start: [
    "Start or reset the persisted document review session (.session.json) — phase detect.",
    "",
    "WHEN: Beginning /review or user asks to start document review from scratch.",
    "NOT WHEN: Spec queue, task planning, comment threads.",
    "Optional if review_check is called first (also sets phase detect).",
  ].join("\n"),

  review_session_ack_review: [
    "Acknowledge that the structured review summary was written in chat — unlocks review_approve.",
    "",
    "WHEN: After Phase 4 review summary for activeLogicalPath from review_status.",
    `NOT WHEN: Before review_status; spec approval (spec_approve); plan approval (task_approve_plan).`,
    "REQUIRES: review_status for the same logicalPath in this session.",
  ].join("\n"),
} as const;
