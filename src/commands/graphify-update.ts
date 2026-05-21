import { spawn } from "node:child_process";
import { rm } from "node:fs/promises";
import { join, resolve } from "node:path";
import { loadDocflowConfig } from "../config/load.js";
import { pathExists, readJson } from "../util/fs.js";

interface AnalyzeGraphifyConfig {
  version?: number;
  graphify?: {
    defaultDataSource?: string;
    outputPath?: string;
    graphJsonPath?: string;
  };
}

export interface GraphifyUpdateOptions {
  root?: string;
  sourcePath?: string;
  removeStaleOutput?: boolean;
}

function runCommand(
  command: string,
  args: string[],
  cwd: string,
  env: NodeJS.ProcessEnv,
): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, {
      cwd,
      env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout?.on("data", (chunk: Buffer) => {
      stdout += chunk.toString();
    });
    child.stderr?.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => {
      resolvePromise({
        exitCode: code ?? 1,
        stdout,
        stderr,
      });
    });
  });
}

async function runGraphifyCli(
  args: string[],
  cwd: string,
  env: NodeJS.ProcessEnv,
): Promise<{ exitCode: number; stdout: string; stderr: string; command: string }> {
  try {
    const direct = await runCommand("graphify", args, cwd, env);
    return { ...direct, command: `graphify ${args.join(" ")}` };
  } catch {
    const uvArgs = ["tool", "run", "--from", "graphifyy", "graphify", ...args];
    const viaUv = await runCommand("uv", uvArgs, cwd, env);
    return { ...viaUv, command: `uv ${uvArgs.join(" ")}` };
  }
}

export async function runGraphifyUpdate(opts: GraphifyUpdateOptions): Promise<void> {
  const { root: projectRoot } = await loadDocflowConfig(opts.root);
  const configPath = join(projectRoot, ".ai-spector/.docflow/config/analyze.graphify.json");
  const config = await readJson<AnalyzeGraphifyConfig>(configPath);
  const g = config.graphify ?? {};

  const sourceRel = opts.sourcePath ?? g.defaultDataSource ?? "docs/data-source";
  const sourcePath = resolve(projectRoot, sourceRel);
  const outputPath = resolve(
    projectRoot,
    g.outputPath ?? ".ai-spector/.docflow/graph/graphify-out",
  );

  if (!(await pathExists(sourcePath))) {
    throw new Error(`Data source not found: ${sourcePath}`);
  }

  const env = {
    ...process.env,
    GRAPHIFY_OUT: outputPath,
  };

  console.log(`Graphify update: ${sourceRel}`);
  console.log(`  GRAPHIFY_OUT → ${g.outputPath ?? outputPath}`);
  console.log("  (do not pass --graph to graphify update — use GRAPHIFY_OUT instead)");
  console.log("");

  const result = await runGraphifyCli(["update", sourceRel], projectRoot, env);

  if (result.stdout.trim()) {
    console.log(result.stdout.trimEnd());
  }
  if (result.stderr.trim()) {
    console.error(result.stderr.trimEnd());
  }

  if (result.exitCode !== 0) {
    console.error("");
    console.error(`Failed: ${result.command} (exit ${result.exitCode})`);
    throw new Error(`graphify update failed with exit code ${result.exitCode}`);
  }

  const graphJson = join(
    outputPath,
    "graph.json",
  );
  if (!(await pathExists(graphJson))) {
    throw new Error(
      `Expected graph.json at ${g.graphJsonPath ?? graphJson} after update — check Graphify install (graphify or uv + graphifyy)`,
    );
  }

  const staleOut = join(sourcePath, "graphify-out");
  if (opts.removeStaleOutput !== false && (await pathExists(staleOut))) {
    await rm(staleOut, { recursive: true, force: true });
    console.log("");
    console.log(`Removed stale ${sourceRel}/graphify-out/ (wrong default location)`);
  }

  console.log("");
  console.log(`OK — ${g.graphJsonPath ?? ".ai-spector/.docflow/graph/graphify-out/graph.json"}`);
}
