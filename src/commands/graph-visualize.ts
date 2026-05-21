import { exec } from "node:child_process";
import { promisify } from "node:util";
import { join } from "node:path";
import { writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { pathExists, readJson } from "../util/fs.js";
import { resolveProjectPaths } from "../util/paths.js";
import type { TraceabilityGraph } from "../types.js";
import {
  isKnowledgePayload,
  type AnalysisKnowledge,
} from "../graph/knowledge.js";
import { buildVisualizationHtml } from "../visualize/html.js";
import { computeGraphStats, computeKnowledgeStats } from "../visualize/stats.js";

const execAsync = promisify(exec);

export interface GraphVisualizeOptions {
  root?: string;
  graphPath?: string;
  knowledgePath?: string;
  output?: string;
  open?: boolean;
  skipKnowledge?: boolean;
}

export async function runGraphVisualize(opts: GraphVisualizeOptions): Promise<string> {
  const paths = await resolveProjectPaths(opts.root);
  const graphPath = opts.graphPath ?? paths.graph;
  const knowledgePath =
    opts.knowledgePath ??
    join(paths.root, ".ai-spector/.docflow/analysis/knowledge.json");
  const outputPath =
    opts.output ?? join(paths.root, ".ai-spector/views/graph-knowledge.html");

  const graph = await readJson<TraceabilityGraph>(graphPath);

  let knowledge: AnalysisKnowledge | null = null;
  if (!opts.skipKnowledge && (await pathExists(knowledgePath))) {
    const raw = await readJson<unknown>(knowledgePath);
    if (isKnowledgePayload(raw)) {
      knowledge = raw as AnalysisKnowledge;
    }
  }

  const html = buildVisualizationHtml({
    generatedAt: new Date().toISOString(),
    projectRoot: paths.root,
    graph,
    knowledge,
    graphStats: computeGraphStats(graph),
    knowledgeStats: computeKnowledgeStats(knowledge),
  });

  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, html, "utf8");

  console.log(`Wrote ${outputPath}`);
  console.log(`  ${graph.nodes.length} nodes, ${graph.edges.length} edges`);
  if (knowledge) {
    const k = computeKnowledgeStats(knowledge);
    console.log(
      `  knowledge: ${k.useCases} use cases, ${k.features} features, ${k.actors} actors`,
    );
  } else {
    console.log("  knowledge: (not loaded)");
  }
  console.log("");
  console.log("Open in a browser:");
  console.log(`  file://${outputPath}`);

  if (opts.open) {
    await openInBrowser(outputPath);
  }

  return outputPath;
}

async function openInBrowser(filePath: string): Promise<void> {
  const url = `file://${filePath}`;
  const platform = process.platform;
  try {
    if (platform === "darwin") {
      await execAsync(`open "${filePath}"`);
    } else if (platform === "win32") {
      await execAsync(`start "" "${filePath}"`, { shell: "cmd.exe" });
    } else {
      await execAsync(`xdg-open "${filePath}"`);
    }
    console.log(`Opened ${url}`);
  } catch (e) {
    console.warn(
      `Could not open browser automatically: ${e instanceof Error ? e.message : e}`,
    );
  }
}
