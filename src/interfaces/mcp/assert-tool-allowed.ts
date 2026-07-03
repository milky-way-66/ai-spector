import { loadOrDeriveDocopsConfig } from "@/core/docops/config.js";
import { gateMcpTool } from "@/core/engine/gate-mcp.js";
import { resolveProjectPaths } from "@/core/util/paths.js";
import { McpPreconditionError } from "./mcp-precondition.js";

function capabilityDisabledHint(capability: string | undefined): string {
  return `Writer capability "${capability ?? "unknown"}" is disabled — enable it in docops.config.json for cloud contract tools, or use docops_status to review configuration.`;
}

export async function assertToolAllowed(toolName: string, root?: string): Promise<void> {
  const paths = await resolveProjectPaths(root);
  const config = await loadOrDeriveDocopsConfig(paths.root);
  const gate = gateMcpTool(toolName, config);
  if (!gate.allowed) {
    throw new McpPreconditionError(
      gate.reason ?? "Capability disabled",
      "capability_disabled",
      capabilityDisabledHint(gate.capability),
      ["docops_status", "workspace_check"],
    );
  }
}
