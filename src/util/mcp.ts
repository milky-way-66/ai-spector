import { join } from "node:path";
import { pathExists, readJson, writeJson } from "./fs.js";

export interface CursorMcpConfig {
  mcpServers?: Record<string, McpServerEntry>;
}

export interface McpServerEntry {
  command: string;
  args?: string[];
  env?: Record<string, string>;
}

/** Graph JSON path relative to workspace (Cursor expands ${workspaceFolder}). */
export const GRAPHIFY_GRAPH_ARG =
  "${workspaceFolder}/.ai-spector/.docflow/graph/graphify-out/graph.json";

export function graphifyMcpServerEntry(): McpServerEntry {
  return {
    command: "uv",
    args: [
      "tool",
      "run",
      "--from",
      "graphifyy",
      "python",
      "-m",
      "graphify.serve",
      GRAPHIFY_GRAPH_ARG,
    ],
  };
}

/**
 * Ensure `.cursor/mcp.json` includes the Graphify server without removing other servers.
 */
export async function ensureGraphifyMcpConfig(projectRoot: string): Promise<string> {
  const mcpPath = join(projectRoot, ".cursor", "mcp.json");
  let config: CursorMcpConfig = { mcpServers: {} };

  if (await pathExists(mcpPath)) {
    try {
      config = await readJson<CursorMcpConfig>(mcpPath);
    } catch {
      config = { mcpServers: {} };
    }
  }

  if (!config.mcpServers) {
    config.mcpServers = {};
  }

  config.mcpServers.graphify = graphifyMcpServerEntry();
  await writeJson(mcpPath, config);
  return mcpPath;
}
