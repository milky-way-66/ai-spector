import { ReviewPreconditionError } from "@/core/reviews/errors.js";
import { TaskPreconditionError } from "@/core/operations/task-gates.js";
import { McpPreconditionError } from "./mcp-precondition.js";

export interface McpToolErrorContent {
  content: Array<{ type: "text"; text: string }>;
  isError: true;
  [key: string]: unknown;
}

/** Serialize tool failures as structured JSON for agent self-correction. */
export function mcpToolErrorContent(err: unknown): McpToolErrorContent {
  if (err instanceof ReviewPreconditionError) {
    return {
      content: [{ type: "text", text: JSON.stringify(err.toPayload(), null, 2) }],
      isError: true,
    };
  }

  if (err instanceof TaskPreconditionError) {
    return {
      content: [{ type: "text", text: JSON.stringify(err.toPayload(), null, 2) }],
      isError: true,
    };
  }

  if (err instanceof McpPreconditionError) {
    return {
      content: [{ type: "text", text: JSON.stringify(err.toPayload(), null, 2) }],
      isError: true,
    };
  }

  const message = err instanceof Error ? err.message : String(err);
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify({ error: "TOOL_ERROR", message }, null, 2),
      },
    ],
    isError: true,
  };
}
