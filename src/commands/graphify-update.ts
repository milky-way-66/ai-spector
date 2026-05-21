import { spawn } from "node:child_process";
import { rm } from "node:fs/promises";
import { join, resolve } from "node:path";
import { loadDocflowConfig } from "../config/load.js";
import {
  filterSourcesByHashChange,
  resolveGraphifySources,
  type GraphifySourcesConfig,
} from "../graphify/sources.js";
import { pathExists, readJson, writeJson } from "../util/fs.js";

interface AnalyzeGraphifyConfig {
  version?: number;
  graphify?: GraphifySourcesConfig & {
    outputPath?: string;
    graphJsonPath?: string;
  };
}

export interface GraphifyUpdateOptions {
  root?: string;
  sourcePath?: string;
  removeStaleOutput?: boolean;
  /** Re-run graphify update on all configured sources even when content hash unchanged */
  force?: boolean;
}

export interface GraphifyUpdateResult {
  sourcesRun: string[];
  sourcesSkipped: string[];
  sourceHashes: Record<string, string>;
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

export async function runGraphifyUpdate(
  opts: GraphifyUpdateOptions = {},
): Promise<GraphifyUpdateResult> {
  const { root: projectRoot } = await loadDocflowConfig(opts.root);
  const configPath = join(projectRoot, ".ai-spector/.docflow/config/analyze.graphify.json");
  const config = await readJson<AnalyzeGraphifyConfig>(configPath);
  const g = config.graphify ?? {};

  const outputPath = resolve(
    projectRoot,
    g.outputPath ?? ".ai-spector/.docflow/graph/graphify-out",
  );

  const statePath = join(projectRoot, ".ai-spector/.docflow/state.json");
  const state = await readJson<Record<string, unknown>>(statePath).catch(() => ({
    version: 1,
    graphify: {},
  }));
  const graphifyState = (state.graphify as Record<string, unknown>) ?? {};
  const storedHashes = graphifyState.sourceHashes as Record<string, string> | undefined;

  let specs = resolveGraphifySources(g);
  if (opts.sourcePath) {
    specs = [{ path: opts.sourcePath, key: opts.sourcePath }];
  }

  const { toRun, hashes } = await filterSourcesByHashChange(
    projectRoot,
    specs,
    storedHashes,
    opts.force === true,
  );

  const sourcesRun: string[] = [];
  const sourcesSkipped = specs
    .filter((s) => !toRun.some((r) => r.key === s.key))
    .map((s) => s.path);

  if (toRun.length === 0) {
    console.log("Graphify update: all sources unchanged (use --force to re-index)");
    for (const s of specs) {
      console.log(`  ○ ${s.path} (hash ${hashes[s.key] ?? "—"})`);
    }
    return { sourcesRun, sourcesSkipped, sourceHashes: hashes };
  }

  const env = {
    ...process.env,
    GRAPHIFY_OUT: outputPath,
  };

  console.log(`Graphify update (${toRun.length} source(s), ${sourcesSkipped.length} unchanged)`);
  console.log(`  GRAPHIFY_OUT → ${g.outputPath ?? outputPath}`);
  console.log("  (do not pass --graph to graphify update — use GRAPHIFY_OUT instead)");
  console.log("");

  for (const spec of toRun) {
    const sourcePath = resolve(projectRoot, spec.path);
    if (!(await pathExists(sourcePath))) {
      console.log(`  ⊘ skip ${spec.path} (not found)`);
      continue;
    }

    console.log(`  ▶ ${spec.path} (hash ${hashes[spec.key] ?? "—"})`);
    const result = await runGraphifyCli(["update", spec.path], projectRoot, env);

    if (result.stdout.trim()) {
      console.log(result.stdout.trimEnd());
    }
    if (result.stderr.trim()) {
      console.error(result.stderr.trimEnd());
    }

    if (result.exitCode !== 0) {
      console.error("");
      console.error(`Failed: ${result.command} (exit ${result.exitCode})`);
      throw new Error(`graphify update failed for ${spec.path} (exit ${result.exitCode})`);
    }
    sourcesRun.push(spec.path);
  }

  const graphJson = join(outputPath, "graph.json");
  if (!(await pathExists(graphJson))) {
    throw new Error(
      `Expected graph.json at ${g.graphJsonPath ?? graphJson} after update — check Graphify install (graphify or uv + graphifyy)`,
    );
  }

  const primaryRel = g.defaultDataSource ?? "docs/data-source";
  const staleOut = join(resolve(projectRoot, primaryRel), "graphify-out");
  if (opts.removeStaleOutput !== false && (await pathExists(staleOut))) {
    await rm(staleOut, { recursive: true, force: true });
    console.log("");
    console.log(`Removed stale ${primaryRel}/graphify-out/ (wrong default location)`);
  }

  graphifyState.lastRunAt = new Date().toISOString();
  graphifyState.sourceHashes = hashes;
  graphifyState.sourcesRun = sourcesRun;
  state.graphify = graphifyState;
  await writeJson(statePath, state);

  console.log("");
  console.log(`OK — ${g.graphJsonPath ?? ".ai-spector/.docflow/graph/graphify-out/graph.json"}`);
  if (sourcesSkipped.length > 0) {
    console.log(`Skipped (unchanged): ${sourcesSkipped.join(", ")}`);
  }

  return { sourcesRun, sourcesSkipped, sourceHashes: hashes };
}
