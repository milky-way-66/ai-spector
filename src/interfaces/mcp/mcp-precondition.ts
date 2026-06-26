export interface McpPreconditionPayload {
  error: "PRECONDITION_FAILED";
  reason: string;
  message: string;
  hint: string;
  userMessage: string;
  suggestedTools: string[];
}

/** Thrown when an MCP tool is blocked by docops capability gating. */
export class McpPreconditionError extends Error {
  readonly code = "PRECONDITION_FAILED" as const;

  constructor(
    message: string,
    public readonly reason = "capability_disabled",
    public readonly hint = "Enable the capability in docops.config.json or use a different tool.",
    public readonly suggestedTools: string[] = ["workspace_check"],
  ) {
    super(message);
    this.name = "McpPreconditionError";
  }

  get userMessage(): string {
    return this.message;
  }

  toPayload(): McpPreconditionPayload {
    return {
      error: this.code,
      reason: this.reason,
      message: this.message,
      hint: this.hint,
      userMessage: this.userMessage,
      suggestedTools: this.suggestedTools,
    };
  }
}
