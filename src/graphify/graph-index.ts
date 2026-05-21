import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { pathExists } from "../util/fs.js";

export interface GraphifyGraphNode {
  id: string;
  label?: string;
  norm_label?: string;
  source_file?: string;
  file_type?: string;
  community?: number;
}

export interface GraphifyGraphFile {
  nodes: GraphifyGraphNode[];
  links?: Array<{ source: string; target: string }>;
}

export interface GraphifyIndex {
  nodes: GraphifyGraphNode[];
  /** Repo-relative path (under data-source root) → graphify node ids in that file */
  byRepoPath: Map<string, string[]>;
  /** Lowercased label / norm_label → graphify node ids */
  byLabel: Map<string, string[]>;
}

export function graphifyNodeTargetId(nodeId: string): string {
  return `graphify:${nodeId}`;
}

export function isGraphifyNodeTarget(to: string): boolean {
  return to.startsWith("graphify:");
}

export function repoPathForGraphifyNode(
  node: GraphifyGraphNode,
  dataSourceRoot: string,
): string | undefined {
  const sf = node.source_file?.replace(/\\/g, "/").trim();
  if (!sf) {
    return undefined;
  }
  const root = dataSourceRoot.replace(/\\/g, "/").replace(/\/$/, "");
  if (sf.startsWith("docs/")) {
    return sf;
  }
  return `${root}/${sf.replace(/^\.\//, "")}`;
}

export async function loadGraphifyIndex(
  graphJsonPath: string,
  dataSourceRoot: string,
): Promise<GraphifyIndex | null> {
  if (!(await pathExists(graphJsonPath))) {
    return null;
  }
  const raw = JSON.parse(await readFile(graphJsonPath, "utf8")) as GraphifyGraphFile;
  const nodes = raw.nodes ?? [];
  const byRepoPath = new Map<string, string[]>();
  const byLabel = new Map<string, string[]>();

  const addToMap = (map: Map<string, string[]>, key: string, id: string) => {
    const list = map.get(key) ?? [];
    if (!list.includes(id)) {
      list.push(id);
      map.set(key, list);
    }
  };

  for (const node of nodes) {
    const path = repoPathForGraphifyNode(node, dataSourceRoot);
    if (path) {
      addToMap(byRepoPath, path, node.id);
    }
    for (const label of [node.label, node.norm_label]) {
      if (label?.trim()) {
        addToMap(byLabel, label.trim().toLowerCase(), node.id);
      }
    }
  }

  return { nodes, byRepoPath, byLabel };
}

export function defaultGraphifyJsonPath(projectRoot: string): string {
  return join(
    projectRoot,
    ".ai-spector/.docflow/graph/graphify-out/graph.json",
  );
}
