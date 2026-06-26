import { loadOrDeriveDocopsConfig } from "@/core/docops/config.js";
import { gateMcpTool } from "@/core/engine/gate-mcp.js";
import { resolveProjectPaths } from "@/core/util/paths.js";
import { McpPreconditionError } from "./mcp-precondition.js";

export async function assertToolAllowed(toolName: string, root?: string): Promise<void> {
  const paths = await resolveProjectPaths(root);
  const config = await loadOrDeriveDocopsConfig(paths.root);
  const gate = gateMcpTool(toolName, config);
  if (!gate.allowed) {
    throw new McpPreconditionError(gate.reason ?? "Capability disabled");
  }
}
